import { drawShape, getShapeBounds } from "./drawShape";
import {
    CanvasEngineOptions,
    CanvasState,
    DrawState,
    DrawingMode,
    SelectedShapeInfo,
    Shape,
} from "./types";

export class CanvasEngine {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private modeRef: React.RefObject<DrawingMode>;
    private strokeColorRef: React.RefObject<string>;
    private strokeWidthRef: React.RefObject<number>;
    private socket: WebSocket;
    private roomId: number;

    // callbacks to component
    private onShapeAdded: (shape: Shape) => void;
    private onCanvasChanged: () => void;
    private onAiResponse: (response: string) => void;

    private state: DrawState;
    private renderRequested = false;
    private activeTextCleanup: (() => void) | null = null;
    private version = 0;

    constructor(options: CanvasEngineOptions) {
        const {
            canvas,
            modeRef,
            strokeColorRef,
            strokeWidthRef,
            socket,
            roomId,
            initialShapes = [],
            onShapeAdded,
            onCanvasChanged,
            onAiResponse,
        } = options;

        this.canvas = canvas;
        this.modeRef = modeRef;
        this.strokeColorRef = strokeColorRef;
        this.strokeWidthRef = strokeWidthRef;
        this.socket = socket;
        this.roomId = roomId;
        this.onShapeAdded = onShapeAdded;
        this.onCanvasChanged = onCanvasChanged;
        this.onAiResponse = onAiResponse;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context not available");
        this.ctx = ctx;

        this.state = {
            shapes: [...initialShapes],
            offsetX: 0,
            offsetY: 0,
            scale: 1,
            isDrawing: false,
            isPanning: false,
            isFreehandDrawing: false,
            isErasing: false,
            startX: 0,
            startY: 0,
            panStartX: 0,
            panStartY: 0,
            freehandPoints: [],
            eraserPoints: [],
            currentX: undefined,
            currentY: undefined,
            textPreview: undefined,
            selectedShapeIds: [],
            isMarqueeSelecting: false,
            marqueeStartX: 0,
            marqueeStartY: 0,
            marqueeCurrentX: 0,
            marqueeCurrentY: 0,
        };

        this.bindEvents();
        this.scheduleRender();
        this.setupSocketListener();
    }

    // Public API

    public addShapeLocally(shape: Shape) {
        this.state.shapes.push(shape);
        this.scheduleRender();
    }

    public deleteShapeById(id: string) {
        const index = this.state.shapes.findIndex((s) => s.id === id);
        if (index !== -1) {
            this.state.shapes.splice(index, 1);
            this.state.selectedShapeIds = this.state.selectedShapeIds.filter(
                (sid) => sid !== id
            );
            this.scheduleRender();
        }
    }

    public isCanvasEmpty(): boolean {
        return this.state.shapes.length === 0;
    }

    public getSelectedShapesInfo(): SelectedShapeInfo[] {
        const infos: SelectedShapeInfo[] = [];
        this.state.selectedShapeIds.forEach((id) => {
            const index = this.state.shapes.findIndex((s) => s.id === id);
            if (index !== -1) {
                const shape = this.state.shapes[index]!;
                const bounds = getShapeBounds(this.ctx, shape);
                if (bounds) {
                    infos.push({ shape, index, bounds });
                }
            }
        });
        return infos;
    }

    public getState(): CanvasState {
        return {
            elements: this.state.shapes,
            version: this.version,
            lastUpdated: Date.now(),
        };
    }

    public captureSelectedAreaBase64(): Promise<string | null> {
        return new Promise((resolve) => {
            if (this.state.selectedShapeIds.length === 0) {
                resolve(null);
                return;
            }

            // calculate combined bounding box
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            const selectedShapes: Shape[] = [];

            this.state.selectedShapeIds.forEach((id) => {
                const shape = this.state.shapes.find((s) => s.id === id);
                if (shape) {
                    const bounds = getShapeBounds(this.ctx, shape);
                    if (bounds) {
                        minX = Math.min(minX, bounds.x);
                        minY = Math.min(minY, bounds.y);
                        maxX = Math.max(maxX, bounds.x + bounds.width);
                        maxY = Math.max(maxY, bounds.y + bounds.height);
                        selectedShapes.push(shape);
                    }
                }
            });

            if (selectedShapes.length === 0) {
                resolve(null);
                return;
            }

            const padding = 10;
            const tempCanvas = document.createElement("canvas");
            const tempCtx = tempCanvas.getContext("2d");
            if (!tempCtx) {
                resolve(null);
                return;
            }

            tempCanvas.width = maxX - minX + padding * 2;
            tempCanvas.height = maxY - minY + padding * 2;
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.save();
            tempCtx.translate(-minX + padding, -minY + padding);

            selectedShapes.forEach((shape) => {
                drawShape(tempCtx, shape, () => { });
            });

            tempCtx.restore();

            // return base64 directly instead of blob
            const base64 = tempCanvas.toDataURL("image/png");
            tempCanvas.remove();
            resolve(base64);
        });
    }

    public destroy() {
        this.unbindEvents();
        if (this.activeTextCleanup) {
            this.activeTextCleanup();
        }
    }

    // Socket

    private setupSocketListener() {
        this.socket.onmessage = (e) => {
            const data = JSON.parse(e.data);

            if (data.type === "canvas_update" && data.state) {
                // another user updated canvas — merge their shapes
                const incomingElements: Shape[] = data.state.elements ?? [];
                this.state.shapes = incomingElements;
                this.scheduleRender();
                return;
            }

            if (data.type === "chat" && data.message) {
                const shape = data.message as Shape;
                this.state.shapes.push(shape);
                this.scheduleRender();
                return;
            }

            if (data.type === "ai") {
                this.onAiResponse(data.message);
                return;
            }

            if (data.type === "ai_image_result" && data.job?.status === "done") {
                // another room member finished an AI job
                // component handles this via polling, WS just notifies
                return;
            }
        };
    }

    private sendShapeMessage(shape: Shape) {
        this.socket.send(
            JSON.stringify({ type: "chat", roomId: this.roomId, message: shape })
        );
    }

    // Rendering

    private scheduleRender() {
        if (!this.renderRequested) {
            this.renderRequested = true;
            requestAnimationFrame(() => {
                this.renderRequested = false;
                this.renderAll();
            });
        }
    }

    private renderAll() {
        const { ctx, canvas, state } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(state.offsetX, state.offsetY);
        ctx.scale(state.scale, state.scale);

        // 1. draw all shapes
        state.shapes.forEach((shape) => {
            drawShape(ctx, shape, () => this.scheduleRender());
        });

        // 2. draw selection highlights
        state.selectedShapeIds.forEach((id) => {
            const shape = state.shapes.find((s) => s.id === id);
            if (shape) {
                const bounds = getShapeBounds(ctx, shape);
                if (bounds) {
                    ctx.save();
                    ctx.strokeStyle = "#00aaff";
                    ctx.lineWidth = 2 / state.scale;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
                    ctx.restore();
                }
            }
        });

        // 3. draw marquee selection
        if (state.isMarqueeSelecting) {
            ctx.save();
            ctx.strokeStyle = "#00aaff";
            ctx.lineWidth = 1 / state.scale;
            ctx.setLineDash([2, 2]);
            const x = Math.min(state.marqueeStartX, state.marqueeCurrentX);
            const y = Math.min(state.marqueeStartY, state.marqueeCurrentY);
            const w = Math.abs(state.marqueeCurrentX - state.marqueeStartX);
            const h = Math.abs(state.marqueeCurrentY - state.marqueeStartY);
            ctx.strokeRect(x, y, w, h);
            ctx.restore();
        }

        // 4. shape preview while drawing
        if (
            state.isDrawing &&
            state.currentX !== undefined &&
            state.currentY !== undefined
        ) {
            ctx.save();
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.shadowColor = this.strokeColorRef.current!;
            ctx.strokeStyle = this.strokeColorRef.current!;
            ctx.lineWidth = this.strokeWidthRef.current!;
            this.drawPreview(
                ctx,
                state.startX,
                state.startY,
                state.currentX,
                state.currentY
            );
            ctx.restore();
        }

        // 5. freehand preview
        if (state.isFreehandDrawing && state.freehandPoints.length > 0) {
            ctx.save();
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.shadowColor = this.strokeColorRef.current!;
            ctx.strokeStyle = this.strokeColorRef.current!;
            ctx.lineWidth = this.strokeWidthRef.current!;
            ctx.beginPath();
            ctx.moveTo(
                state.freehandPoints[0]?.x ?? 0,
                state.freehandPoints[0]?.y ?? 0
            );
            state.freehandPoints.forEach((pt, i) => {
                if (i > 0) ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();
            ctx.restore();
        }

        // 6. eraser preview
        if (state.isErasing && state.eraserPoints.length > 0) {
            ctx.save();
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineJoin = "round";
            ctx.lineCap = "round";
            ctx.lineWidth = this.strokeWidthRef.current! * 10;
            ctx.beginPath();
            ctx.moveTo(
                state.eraserPoints[0]?.x ?? 0,
                state.eraserPoints[0]?.y ?? 0
            );
            state.eraserPoints.forEach((pt, i) => {
                if (i > 0) ctx.lineTo(pt.x, pt.y);
            });
            ctx.stroke();
            ctx.restore();
        }

        // 7. text preview
        if (state.textPreview) {
            ctx.save();
            const fontSize = this.strokeWidthRef.current! * 10;
            ctx.font = `${fontSize}px Arial`;
            ctx.fillStyle = this.strokeColorRef.current!;
            const displayText = state.textPreview.showCursor
                ? state.textPreview.text + "|"
                : state.textPreview.text;
            displayText.split("\n").forEach((line, i) => {
                ctx.fillText(
                    line,
                    state.textPreview!.x,
                    state.textPreview!.y + i * fontSize * 1.2
                );
            });
            ctx.restore();
        }

        ctx.restore();
    }

    private drawPreview(
        ctx: CanvasRenderingContext2D,
        startX: number,
        startY: number,
        currentX: number,
        currentY: number
    ) {
        const mode = this.modeRef.current;
        switch (mode) {
            case "rect":
                ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
                break;

            case "circle": {
                const centerX = (startX + currentX) / 2;
                const centerY = (startY + currentY) / 2;
                const radiusX = Math.abs(currentX - startX) / 2;
                const radiusY = Math.abs(currentY - startY) / 2;
                ctx.beginPath();
                ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }

            case "line":
            case "arrow":
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(currentX, currentY);
                ctx.stroke();
                break;

            case "triangle": {
                const dx = currentX - startX;
                const dy = currentY - startY;
                const midX = (startX + currentX) / 2;
                const midY = (startY + currentY) / 2;
                const thirdX = midX - dy * (Math.sqrt(3) / 2);
                const thirdY = midY + dx * (Math.sqrt(3) / 2);
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(currentX, currentY);
                ctx.lineTo(thirdX, thirdY);
                ctx.closePath();
                ctx.stroke();
                break;
            }
        }
    }

    // Coordinate Helper

    private clientToWorld(clientX: number, clientY: number) {
        return {
            x: (clientX - this.state.offsetX) / this.state.scale,
            y: (clientY - this.state.offsetY) / this.state.scale,
        };
    }

    // Event Binding

    private boundHandleMouseDown = (e: MouseEvent) => this.handleMouseDown(e);
    private boundHandleMouseMove = (e: MouseEvent) => this.handleMouseMove(e);
    private boundHandleMouseUp = (e: MouseEvent) => this.handleMouseUp(e);
    private boundHandleWheel = (e: WheelEvent) => this.handleWheel(e);
    private boundHandleDoubleClick = (e: MouseEvent) => this.handleDoubleClick(e);
    private boundPreventContext = (e: MouseEvent) => e.preventDefault();

    private bindEvents() {
        this.canvas.addEventListener("mousedown", this.boundHandleMouseDown);
        this.canvas.addEventListener("mousemove", this.boundHandleMouseMove);
        this.canvas.addEventListener("mouseup", this.boundHandleMouseUp);
        this.canvas.addEventListener("wheel", this.boundHandleWheel, { passive: false });
        this.canvas.addEventListener("dblclick", this.boundHandleDoubleClick);
        this.canvas.addEventListener("contextmenu", this.boundPreventContext);
    }

    private unbindEvents() {
        this.canvas.removeEventListener("mousedown", this.boundHandleMouseDown);
        this.canvas.removeEventListener("mousemove", this.boundHandleMouseMove);
        this.canvas.removeEventListener("mouseup", this.boundHandleMouseUp);
        this.canvas.removeEventListener("wheel", this.boundHandleWheel);
        this.canvas.removeEventListener("dblclick", this.boundHandleDoubleClick);
        this.canvas.removeEventListener("contextmenu", this.boundPreventContext);
    }

    // Mouse Handlers

    private handleMouseDown(e: MouseEvent) {
        const { x: worldX, y: worldY } = this.clientToWorld(e.clientX, e.clientY);
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;

        if (this.state.textPreview && this.modeRef.current === "text") {
            this.activeTextCleanup?.();
            return;
        }

        if (e.button === 2) {
            this.state.isPanning = true;
            this.state.panStartX = e.clientX - this.state.offsetX;
            this.state.panStartY = e.clientY - this.state.offsetY;
            this.state.selectedShapeIds = [];
            this.state.isMarqueeSelecting = false;
            this.scheduleRender();
            return;
        }

        switch (this.modeRef.current) {
            case "select":
                this.handleSelectionStart(worldX, worldY, isCtrlOrCmd);
                break;
            case "freehand":
            case "eraser":
                this.startFreehandOrEraser(worldX, worldY, this.modeRef.current);
                break;
            case "rect":
            case "circle":
            case "line":
            case "triangle":
            case "arrow":
                this.startDrawingMode(worldX, worldY);
                break;
            case null:
                this.state.selectedShapeIds = [];
                this.state.isMarqueeSelecting = false;
                this.scheduleRender();
                break;
        }
    }

    private handleMouseMove(e: MouseEvent) {
        const { x: worldX, y: worldY } = this.clientToWorld(e.clientX, e.clientY);

        if (this.state.isErasing) {
            this.state.eraserPoints.push({ x: worldX, y: worldY });
        } else if (this.state.isFreehandDrawing) {
            this.state.freehandPoints.push({ x: worldX, y: worldY });
        } else if (this.state.isDrawing) {
            this.state.currentX = worldX;
            this.state.currentY = worldY;
        } else if (this.state.isPanning) {
            this.state.offsetX = e.clientX - this.state.panStartX;
            this.state.offsetY = e.clientY - this.state.panStartY;
        } else if (
            this.modeRef.current === "select" &&
            this.state.isMarqueeSelecting
        ) {
            this.state.marqueeCurrentX = worldX;
            this.state.marqueeCurrentY = worldY;
        } else {
            return;
        }

        this.scheduleRender();
    }

    private handleMouseUp(e: MouseEvent) {
        const { x: worldX, y: worldY } = this.clientToWorld(e.clientX, e.clientY);
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;

        if (e.button === 2 && this.state.isPanning) {
            this.state.isPanning = false;
            return;
        }

        switch (this.modeRef.current) {
            case "freehand":
                if (this.state.isFreehandDrawing) this.finalizeFreehandDrawing();
                break;
            case "eraser":
                if (this.state.isErasing) this.finalizeEraserDrawing();
                break;
            case "rect":
            case "circle":
            case "line":
            case "triangle":
            case "arrow":
                if (this.state.isDrawing) this.finalizeDrawingMode(worldX, worldY);
                break;
            case "select":
                if (this.state.isMarqueeSelecting)
                    this.endMarqueeSelection(worldX, worldY, isCtrlOrCmd);
                break;
        }
    }

    private handleWheel(e: WheelEvent) {
        e.preventDefault();
        const zoomIntensity = 0.001;
        let newScale = this.state.scale - e.deltaY * zoomIntensity;
        newScale = Math.max(0.4, Math.min(1, newScale));

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - this.state.offsetX) / this.state.scale;
        const worldY = (mouseY - this.state.offsetY) / this.state.scale;

        this.state.offsetX = mouseX - worldX * newScale;
        this.state.offsetY = mouseY - worldY * newScale;
        this.state.scale = newScale;
        this.scheduleRender();
    }

    private handleDoubleClick(e: MouseEvent) {
        if (this.modeRef.current !== "text") return;
        if (this.activeTextCleanup) this.activeTextCleanup();

        const { x: worldX, y: worldY } = this.clientToWorld(e.clientX, e.clientY);
        this.state.textPreview = { x: worldX, y: worldY, text: "", showCursor: true };
        this.scheduleRender();

        const cursorInterval = setInterval(() => {
            if (this.state.textPreview) {
                this.state.textPreview.showCursor = !this.state.textPreview.showCursor;
                this.scheduleRender();
            }
        }, 500);

        const handleKeydown = (event: KeyboardEvent) => {
            if (!this.state.textPreview) return;
            if (event.key === "Enter") {
                this.state.textPreview.text += "\n";
                event.preventDefault();
            } else if (event.key === "Backspace") {
                this.state.textPreview.text = this.state.textPreview.text.slice(0, -1);
            } else if (event.key.length === 1) {
                this.state.textPreview.text += event.key;
            }
            this.scheduleRender();
        };

        const handleTextCancel = () => cleanup();

        const cleanup = () => {
            clearInterval(cursorInterval);
            if (this.state.textPreview && this.state.textPreview.text.trim().length > 0) {
                const newShape: Shape = {
                    id: crypto.randomUUID(),
                    type: "text",
                    x: this.state.textPreview.x,
                    y: this.state.textPreview.y,
                    content: this.state.textPreview.text,
                    strokeColor: this.strokeColorRef.current!,
                    strokeWidth: this.strokeWidthRef.current!,
                };
                this.state.shapes.push(newShape);
                this.sendShapeMessage(newShape);
                this.onShapeAdded(newShape);
                this.onCanvasChanged();
                this.version++;
            }
            this.state.textPreview = undefined;
            document.removeEventListener("keydown", handleKeydown);
            this.canvas.removeEventListener("mousedown", handleTextCancel);
            this.scheduleRender();
            this.activeTextCleanup = null;
        };

        document.addEventListener("keydown", handleKeydown);
        this.canvas.addEventListener("mousedown", handleTextCancel);
        this.activeTextCleanup = cleanup;
    }

    // Selection

    private handleSelectionStart(
        worldX: number,
        worldY: number,
        isCtrlOrCmd: boolean
    ) {
        let clickedShapeId: string | null = null;

        for (let i = this.state.shapes.length - 1; i >= 0; i--) {
            const shape = this.state.shapes[i]!;
            const bounds = getShapeBounds(this.ctx, shape);
            if (
                bounds &&
                worldX >= bounds.x &&
                worldX <= bounds.x + bounds.width &&
                worldY >= bounds.y &&
                worldY <= bounds.y + bounds.height
            ) {
                clickedShapeId = shape.id;
                break;
            }
        }

        if (clickedShapeId) {
            const isAlreadySelected =
                this.state.selectedShapeIds.includes(clickedShapeId);
            if (isCtrlOrCmd) {
                this.state.selectedShapeIds = isAlreadySelected
                    ? this.state.selectedShapeIds.filter((id) => id !== clickedShapeId)
                    : [...this.state.selectedShapeIds, clickedShapeId];
            } else {
                this.state.selectedShapeIds = [clickedShapeId];
            }
            this.state.isMarqueeSelecting = false;
        } else {
            this.state.isMarqueeSelecting = true;
            this.state.marqueeStartX = worldX;
            this.state.marqueeStartY = worldY;
            this.state.marqueeCurrentX = worldX;
            this.state.marqueeCurrentY = worldY;
            if (!isCtrlOrCmd) this.state.selectedShapeIds = [];
        }

        this.scheduleRender();
    }

    private endMarqueeSelection(
        worldX: number,
        worldY: number,
        isCtrlOrCmd: boolean
    ) {
        this.state.isMarqueeSelecting = false;

        const rectX = Math.min(this.state.marqueeStartX, worldX);
        const rectY = Math.min(this.state.marqueeStartY, worldY);
        const rectW = Math.abs(worldX - this.state.marqueeStartX);
        const rectH = Math.abs(worldY - this.state.marqueeStartY);

        if (!isCtrlOrCmd) this.state.selectedShapeIds = [];

        this.state.shapes.forEach((shape) => {
            const bounds = getShapeBounds(this.ctx, shape);
            if (bounds) {
                const intersects =
                    rectX < bounds.x + bounds.width &&
                    rectX + rectW > bounds.x &&
                    rectY < bounds.y + bounds.height &&
                    rectY + rectH > bounds.y;
                if (intersects && !this.state.selectedShapeIds.includes(shape.id)) {
                    this.state.selectedShapeIds.push(shape.id);
                }
            }
        });

        this.state.marqueeStartX = 0;
        this.state.marqueeStartY = 0;
        this.state.marqueeCurrentX = 0;
        this.state.marqueeCurrentY = 0;
        this.scheduleRender();
    }

    // Drawing Helpers

    private startFreehandOrEraser(
        worldX: number,
        worldY: number,
        mode: "freehand" | "eraser"
    ) {
        this.state.selectedShapeIds = [];
        this.state.isMarqueeSelecting = false;
        const points = [{ x: worldX, y: worldY }];
        if (mode === "eraser") {
            this.state.isErasing = true;
            this.state.eraserPoints = points;
        } else {
            this.state.isFreehandDrawing = true;
            this.state.freehandPoints = points;
        }
        this.scheduleRender();
    }

    private startDrawingMode(worldX: number, worldY: number) {
        this.state.selectedShapeIds = [];
        this.state.isMarqueeSelecting = false;
        this.state.isDrawing = true;
        this.state.startX = worldX;
        this.state.startY = worldY;
        this.state.currentX = worldX;
        this.state.currentY = worldY;
        this.scheduleRender();
    }

    private finalizeFreehandDrawing() {
        this.state.isFreehandDrawing = false;
        if (this.state.freehandPoints.length > 0) {
            const newShape: Shape = {
                id: crypto.randomUUID(),
                type: "freehand",
                points: this.state.freehandPoints,
                strokeColor: this.strokeColorRef.current!,
                strokeWidth: this.strokeWidthRef.current!,
            };
            this.state.shapes.push(newShape);
            this.sendShapeMessage(newShape);
            this.onShapeAdded(newShape);
            this.onCanvasChanged();
            this.version++;
        }
        this.state.freehandPoints = [];
        this.scheduleRender();
    }

    private finalizeEraserDrawing() {
        this.state.isErasing = false;
        if (this.state.eraserPoints.length > 0) {
            const newShape: Shape = {
                id: crypto.randomUUID(),
                type: "eraser",
                points: this.state.eraserPoints,
                size: this.strokeWidthRef.current! * 10,
            };
            this.state.shapes.push(newShape);
            this.sendShapeMessage(newShape);
            this.onShapeAdded(newShape);
            this.onCanvasChanged();
            this.version++;
        }
        this.state.eraserPoints = [];
        this.scheduleRender();
    }

    private finalizeDrawingMode(finalX: number, finalY: number) {
        this.state.isDrawing = false;
        let newShape: Shape | null = null;
        const id = crypto.randomUUID();
        const strokeColor = this.strokeColorRef.current!;
        const strokeWidth = this.strokeWidthRef.current!;
        const { startX, startY } = this.state;

        switch (this.modeRef.current) {
            case "rect":
                newShape = {
                    id, type: "rectangle",
                    x: startX, y: startY,
                    width: finalX - startX,
                    height: finalY - startY,
                    strokeColor, strokeWidth,
                };
                break;

            case "circle": {
                const centerX = (startX + finalX) / 2;
                const centerY = (startY + finalY) / 2;
                newShape = {
                    id, type: "circle",
                    x: centerX, y: centerY,
                    radiusX: Math.abs(finalX - startX) / 2,
                    radiusY: Math.abs(finalY - startY) / 2,
                    strokeColor, strokeWidth,
                };
                break;
            }

            case "line":
                newShape = {
                    id, type: "line",
                    x1: startX, y1: startY,
                    x2: finalX, y2: finalY,
                    strokeColor, strokeWidth,
                };
                break;

            case "triangle": {
                const dx = finalX - startX;
                const dy = finalY - startY;
                const midX = (startX + finalX) / 2;
                const midY = (startY + finalY) / 2;
                newShape = {
                    id, type: "triangle",
                    x1: startX, y1: startY,
                    x2: finalX, y2: finalY,
                    x3: midX - dy * (Math.sqrt(3) / 2),
                    y3: midY + dx * (Math.sqrt(3) / 2),
                    strokeColor, strokeWidth,
                };
                break;
            }

            case "arrow":
                newShape = {
                    id, type: "arrow",
                    x1: startX, y1: startY,
                    x2: finalX, y2: finalY,
                    strokeColor, strokeWidth,
                };
                break;
        }

        if (newShape) {
            this.state.shapes.push(newShape);
            this.sendShapeMessage(newShape);
            this.onShapeAdded(newShape);
            this.onCanvasChanged();
            this.version++;
        }

        this.state.currentX = undefined;
        this.state.currentY = undefined;
        this.scheduleRender();
    }
}