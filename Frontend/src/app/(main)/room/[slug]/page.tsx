"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import { Settings, LogOut, Play, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CanvasEngine } from "@/components/canvas/CanvasEngine";
import { Shape, DrawingMode } from "@/components/canvas/types";
import Toolbar from "@/components/canvas/ui/Toolbar";
import SettingsPanel from "@/components/canvas/ui/SettingsPanel";
import AiResponsePanel from "@/components/canvas/ui/AiResponsePanel";
import useSocket from "@/hooks/useSocket";
import { useGetCanvas, useSaveCanvas } from "@/hooks/useCanvas";
import { useSaveChat } from "@/hooks/useChat";
import { useCreateJob, usePollJob } from "@/hooks/useJob";
import { useGetRoomBySlug, useClearCanvas, useWSToken } from "@/hooks/useRoom";
import { useSolveCanvas } from "@/hooks/useAi";
import { authClient } from "@/lib/auth-client";

export default function RoomPage() {
    const params = useParams();
    const slug = params.slug as string;
    const router = useRouter();

    const { data: token } = useWSToken();

    // room
    const { data: roomData } = useGetRoomBySlug(slug);
    const roomId = roomData?.room?.id ?? null;

    // canvas
    const { data: canvasData } = useGetCanvas(roomId ?? 0);

    // socket
    const { socket, isConnected } = useSocket(token!);

    // mutations
    const saveCanvas = useSaveCanvas();
    const saveChat = useSaveChat();
    const createJob = useCreateJob();
    const clearCanvas = useClearCanvas();
    const solveCanvas = useSolveCanvas();

    // refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<CanvasEngine | null>(null);
    const modeRef = useRef<DrawingMode>(null);
    const strokeColorRef = useRef("#ffffff");
    const strokeWidthRef = useRef(3);

    // ui state
    const [mode, setMode] = useState<DrawingMode>(null);
    const [strokeColor, setStrokeColor] = useState("#ffffff");
    const [strokeWidth, setStrokeWidth] = useState(3);
    const [showSettings, setShowSettings] = useState(false);
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [dimensions, setDimensions] = useState<{
        width: number;
        height: number;
    } | null>(null);
    const [isImprovingAi, setIsImprovingAi] = useState(false);
    const [pollingJobId, setPollingJobId] = useState<string | null>(null);
    const [pendingBounds, setPendingBounds] = useState<{
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);

    // polling
    const { data: jobResult } = usePollJob(pollingJobId);

    // window resize
    useEffect(() => {
        const update = () =>
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    // sync refs
    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
    useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);

    // debounced canvas save
    const debouncedSave = useDebouncedCallback(() => {
        if (!engineRef.current || !roomId) return;
        saveCanvas.mutate({
            roomId,
            state: engineRef.current.getState(),
        });
    }, 2000);

    // initialize engine
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !dimensions || !socket || !roomId) return;

        const safeRoomId = roomId as number;
        const initialShapes: Shape[] = canvasData?.state
            ? (canvasData.state as { elements: Shape[] }).elements ?? []
            : [];

        const engine = new CanvasEngine({
            canvas,
            modeRef,
            strokeColorRef,
            strokeWidthRef,
            socket,
            roomId: safeRoomId,
            initialShapes,
            onShapeAdded: (shape: Shape) => {
                saveChat.mutate({ roomId: safeRoomId, message: shape as any });
                debouncedSave();
            },
            onCanvasChanged: debouncedSave,
            onAiResponse: (response: string) => setAiResponse(response),
        });

        engineRef.current = engine;
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "join_room", roomId: safeRoomId }));
        }
        return () => {
            engine.destroy();
            engineRef.current = null;
        };
    }, [dimensions, socket, roomId, canvasData]);

    // handle polling result
    useEffect(() => {
        if (!jobResult) return;

        if (jobResult.status === "done" && jobResult.signedUrl && pendingBounds) {
            const newImageShape: Shape = {
                id: crypto.randomUUID(),
                type: "image",
                x: pendingBounds.x,
                y: pendingBounds.y,
                width: pendingBounds.width,
                height: pendingBounds.height,
                src: jobResult.signedUrl,
            };
            engineRef.current?.addShapeLocally(newImageShape);
            socket?.send(JSON.stringify({
                type: "chat",
                roomId,
                message: newImageShape,
            }));
            setPollingJobId(null);
            setPendingBounds(null);
            setIsImprovingAi(false);
            toast.success("Image improved!");
        }

        if (jobResult.status === "failed") {
            setPollingJobId(null);
            setPendingBounds(null);
            setIsImprovingAi(false);
            toast.error("Image generation failed");
        }
    }, [jobResult]);

    // solve via tRPC
    const handleSolve = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas || !socket || !roomId) return;

        const base64 = await new Promise<string>((resolve) => {
            canvas.toBlob((blob) => {
                if (!blob) return;
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            }, "image/png");
        });

        const data = await solveCanvas.mutateAsync({
            image: base64,
            roomId: roomId as number,
        });

        const result = JSON.stringify(data.result[0]);
        setAiResponse(result);
        socket.send(JSON.stringify({ type: "ai", roomId, message: result }));
    }, [socket, roomId, solveCanvas]);

    // improve via Inngest
    const handleImprove = useCallback(async () => {
        if (!engineRef.current || !roomId) return;

        const selectedInfo = engineRef.current.getSelectedShapesInfo();
        if (selectedInfo.length === 0) {
            toast.info("Select shapes to improve first");
            return;
        }

        const base64 = await engineRef.current.captureSelectedAreaBase64();
        if (!base64) {
            toast.error("Failed to capture selection");
            return;
        }

        let minX = Infinity, minY = Infinity,
            maxX = -Infinity, maxY = -Infinity;
        selectedInfo.forEach(({ bounds }) => {
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        setPendingBounds({
            x: minX, y: minY,
            width: maxX - minX,
            height: maxY - minY,
        });

        selectedInfo.forEach(({ shape }) =>
            engineRef.current?.deleteShapeById(shape.id)
        );

        setIsImprovingAi(true);

        const { jobId } = await createJob.mutateAsync({
            roomId: roomId as number,
            image: base64,
        });
        setPollingJobId(jobId);
        socket?.send(JSON.stringify({
            type: "ai_image_request",
            roomId,
            jobId,
        }));
    }, [roomId, socket]);

    if (!dimensions) return null;

    return (
        <div className="relative bg-black w-screen h-screen overflow-hidden">
            <canvas
                ref={canvasRef}
                width={dimensions.width}
                height={dimensions.height}
                className="absolute top-0 left-0 bg-black"
            />

            <Toolbar mode={mode} onModeChange={setMode} />

            <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings((p) => !p)}
                className="absolute z-30 top-4 left-4 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white"
            >
                <Settings size={18} />
            </Button>

            {showSettings && (
                <SettingsPanel
                    strokeColor={strokeColor}
                    strokeWidth={strokeWidth}
                    isEraser={mode === "eraser"}
                    onColorChange={setStrokeColor}
                    onWidthChange={setStrokeWidth}
                />
            )}

            <div className="absolute z-30 top-4 right-4 flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={handleImprove}
                    disabled={isImprovingAi}
                    className="rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-indigo-600 hover:text-white"
                >
                    {isImprovingAi
                        ? <Loader2 size={14} className="animate-spin mr-1" />
                        : <Play size={14} className="mr-1" />
                    }
                    {isImprovingAi ? "Improving..." : "Improve"}
                </Button>

                <Button
                    size="sm"
                    onClick={handleSolve}
                    disabled={solveCanvas.isPending}
                    className="rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-indigo-600 hover:text-white"
                >
                    {solveCanvas.isPending
                        ? <Loader2 size={14} className="animate-spin mr-1" />
                        : <Play size={14} className="mr-1" />
                    }
                    {solveCanvas.isPending ? "Solving..." : "Solve"}
                </Button>

                <Button
                    size="sm"
                    onClick={() => clearCanvas.mutate({ roomId: roomId! })}
                    disabled={!roomId || clearCanvas.isPending}
                    className="rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 hover:bg-red-600 hover:text-white"
                >
                    <Trash2 size={14} className="mr-1" />
                    Clear
                </Button>

                <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => router.push("/dashboard")}
                    className="rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white"
                >
                    <LogOut size={16} />
                </Button>
            </div>

            {aiResponse && (
                <AiResponsePanel
                    response={aiResponse}
                    onClose={() => setAiResponse(null)}
                />
            )}

            <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-xs text-zinc-500">
                    {isConnected ? "Connected" : "Disconnected"}
                </span>
            </div>
        </div>
    );
}