"use client";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

const basicColors = [
    "#ffffff", "#ff4d4d", "#4dff4d",
    "#4d9fff", "#ffeb3b", "#ff66ff", "#00e5ff",
];

interface SettingsPanelProps {
    strokeColor: string;
    strokeWidth: number;
    isEraser: boolean;
    onColorChange: (color: string) => void;
    onWidthChange: (width: number) => void;
}

export default function SettingsPanel({
    strokeColor,
    strokeWidth,
    isEraser,
    onColorChange,
    onWidthChange,
}: SettingsPanelProps) {
    return (
        <div className="absolute z-50 top-16 left-4 w-60 p-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl text-white">
            <h2 className="mb-4 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                Stroke Settings
            </h2>

            <div className="mb-5">
                <Label className="text-sm mb-2 block">
                    Width: {strokeWidth}px
                </Label>
                <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[strokeWidth]}
                    onValueChange={(val) => onWidthChange(val[0]!)}
                />
            </div>

            {!isEraser && (
                <>
                    <div className="mb-4">
                        <Label className="text-sm mb-2 block">Color</Label>
                        <input
                            type="color"
                            value={strokeColor}
                            onChange={(e) => onColorChange(e.target.value)}
                            className="w-full h-9 rounded-md border border-zinc-700 bg-zinc-800 cursor-pointer"
                        />
                    </div>

                    <div>
                        <Label className="text-sm mb-2 block">Quick Colors</Label>
                        <div className="flex flex-wrap gap-2">
                            {basicColors.map((col) => (
                                <button
                                    key={col}
                                    onClick={() => onColorChange(col)}
                                    style={{ backgroundColor: col }}
                                    className={`w-6 h-6 rounded-full border-2 transition-all ${strokeColor.toLowerCase() === col.toLowerCase()
                                        ? "border-indigo-400 scale-110"
                                        : "border-zinc-600"
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}