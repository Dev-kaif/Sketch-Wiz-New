"use client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AiResponsePanelProps {
    response: string;
    onClose: () => void;
}

function formatAIResponse(response: string): string {
    try {
        const parsed = JSON.parse(response);
        return Object.entries(parsed)
            .map(([key, value]) => {
                const formattedValue =
                    typeof value === "object" && value !== null
                        ? JSON.stringify(value, null, 2)
                        : value;
                return `${key}: ${formattedValue}`;
            })
            .join("\n");
    } catch {
        return response;
    }
}

export default function AiResponsePanel({ response, onClose }: AiResponsePanelProps) {
    return (
        <div className="fixed right-4 bottom-4 z-50 w-96 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                <h3 className="text-sm font-semibold text-white">AI Result</h3>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-7 w-7 text-zinc-400 hover:text-white"
                >
                    <X size={16} />
                </Button>
            </div>
            <ScrollArea className="h-64 p-4">
                <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono">
                    {formatAIResponse(response)}
                </pre>
            </ScrollArea>
        </div>
    );
}