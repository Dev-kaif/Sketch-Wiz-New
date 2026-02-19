"use client";
import {
    Circle,
    Eraser,
    Minus,
    MoveRight,
    Pencil,
    RectangleHorizontal,
    Triangle,
    TypeOutline,
    MousePointer2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type DrawingMode =
    | "rect"
    | "circle"
    | "line"
    | "triangle"
    | "freehand"
    | "text"
    | "eraser"
    | "arrow"
    | "select"
    | null;

interface ToolbarProps {
    mode: DrawingMode;
    onModeChange: (mode: DrawingMode) => void;
}

const tools = [
    { name: "select" as DrawingMode, icon: <MousePointer2 size={18} />, label: "Select" },
    { name: "rect" as DrawingMode, icon: <RectangleHorizontal size={18} />, label: "Rectangle" },
    { name: "circle" as DrawingMode, icon: <Circle size={18} />, label: "Circle" },
    { name: "line" as DrawingMode, icon: <Minus size={18} />, label: "Line" },
    { name: "arrow" as DrawingMode, icon: <MoveRight size={18} />, label: "Arrow" },
    { name: "triangle" as DrawingMode, icon: <Triangle size={18} />, label: "Triangle" },
    { name: "freehand" as DrawingMode, icon: <Pencil size={18} />, label: "Freehand" },
    { name: "text" as DrawingMode, icon: <TypeOutline size={18} />, label: "Text" },
    { name: "eraser" as DrawingMode, icon: <Eraser size={18} />, label: "Eraser" },
];

export default function Toolbar({ mode, onModeChange }: ToolbarProps) {
    return (
        <TooltipProvider>
            <div className="absolute z-40 top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-2 rounded-full bg-zinc-900 border border-zinc-700 shadow-lg">
                {tools.map((tool) => (
                    <Tooltip key={tool.name}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onModeChange(tool.name)}
                                className={`rounded-full w-9 h-9 transition-colors ${mode === tool.name
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                    }`}
                            >
                                {tool.icon}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            <p>{tool.label}</p>
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </TooltipProvider>
    );
}