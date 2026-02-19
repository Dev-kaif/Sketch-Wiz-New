import { Shape } from "./types";

// image cache lives outside so it persists across renders
const imageCache: { [src: string]: HTMLImageElement } = {};

function scheduleRerenderOnImageLoad(
    src: string,
    onLoad: () => void
): HTMLImageElement {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = onLoad;
    img.onerror = () => console.error("Failed to load image:", src);
    img.src = src;
    imageCache[src] = img;
    return img;
}

export function drawShape(
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    onImageLoad?: () => void
) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowBlur = 2;

    switch (shape.type) {
        case "rectangle": {
            ctx.shadowColor = shape.strokeColor;
            ctx.strokeStyle = shape.strokeColor;
            ctx.lineWidth = shape.strokeWidth;
            ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            break;
        }

        case "circle": {
            ctx.shadowColor = shape.strokeColor;
            ctx.strokeStyle = shape.strokeColor;
            ctx.lineWidth = shape.strokeWidth;
            ctx.beginPath();
            ctx.ellipse(
                shape.x,
                shape.y,
                shape.radiusX,
                shape.radiusY,
                0,
                0,
                Math.PI * 2
            );
            ctx.stroke();
            break;
        }

        case "line": {
            ctx.shadowColor = shape.strokeColor;
            ctx.strokeStyle = shape.strokeColor;
            ctx.lineWidth = shape.strokeWidth;
            ctx.beginPath();
            ctx.moveTo(shape.x1, shape.y1);
            ctx.lineTo(shape.x2, shape.y2);
            ctx.stroke();
            break;
        }

        case "triangle": {
            ctx.shadowColor = shape.strokeColor;
            ctx.strokeStyle = shape.strokeColor;
            ctx.lineWidth = shape.strokeWidth;
            ctx.beginPath();
            ctx.moveTo(shape.x1, shape.y1);
            ctx.lineTo(shape.x2, shape.y2);
            ctx.lineTo(shape.x3, shape.y3);
            ctx.closePath();
            ctx.stroke();
            break;
        }

        case "freehand": {
            ctx.shadowColor = shape.strokeColor;
            ctx.strokeStyle = shape.strokeColor;
            ctx.lineWidth = shape.strokeWidth;
            ctx.beginPath();
            ctx.moveTo(shape.points[0]?.x ?? 0, shape.points[0]?.y ?? 0);
            shape.points.forEach((p, i) => {
                if (i > 0) ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
            break;
        }

        case "text": {
            const fontSize = shape.strokeWidth * 10;
            ctx.font = `${fontSize}px Arial`;
            ctx.fillStyle = shape.strokeColor;
            const lines = shape.content.split("\n");
            lines.forEach((line, i) => {
                ctx.fillText(line, shape.x, shape.y + i * fontSize * 1.2);
            });
            break;
        }

        case "eraser": {
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineWidth = shape.size;
            ctx.beginPath();
            ctx.moveTo(shape.points[0]?.x ?? 0, shape.points[0]?.y ?? 0);
            shape.points.forEach((p, i) => {
                if (i > 0) ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
            break;
        }

        case "arrow": {
            ctx.shadowColor = shape.strokeColor;
            ctx.strokeStyle = shape.strokeColor;
            ctx.lineWidth = shape.strokeWidth;
            ctx.beginPath();
            ctx.moveTo(shape.x1, shape.y1);
            ctx.lineTo(shape.x2, shape.y2);
            ctx.stroke();

            const dx = shape.x2 - shape.x1;
            const dy = shape.y2 - shape.y1;
            const angle = Math.atan2(dy, dx);
            const headLength = Math.max(10, shape.strokeWidth * 5);

            ctx.beginPath();
            ctx.moveTo(shape.x2, shape.y2);
            ctx.lineTo(
                shape.x2 - headLength * Math.cos(angle - Math.PI / 7),
                shape.y2 - headLength * Math.sin(angle - Math.PI / 7)
            );
            ctx.lineTo(
                shape.x2 - headLength * Math.cos(angle + Math.PI / 7),
                shape.y2 - headLength * Math.sin(angle + Math.PI / 7)
            );
            ctx.closePath();
            ctx.fillStyle = shape.strokeColor;
            ctx.fill();
            break;
        }

        case "image": {
            let img = imageCache[shape.src];
            if (!img) {
                img = scheduleRerenderOnImageLoad(shape.src, () => {
                    onImageLoad?.();
                });
            }
            if (img.complete && img.naturalWidth !== 0) {
                ctx.drawImage(img, shape.x, shape.y, shape.width, shape.height);
            }
            break;
        }
    }

    ctx.restore();
}

export function getShapeBounds(
    ctx: CanvasRenderingContext2D,
    shape: Shape
): { x: number; y: number; width: number; height: number } | null {
    switch (shape.type) {
        case "rectangle":
            return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };

        case "circle":
            return {
                x: shape.x - shape.radiusX,
                y: shape.y - shape.radiusY,
                width: shape.radiusX * 2,
                height: shape.radiusY * 2,
            };

        case "line":
        case "arrow": {
            const minX = Math.min(shape.x1, shape.x2);
            const maxX = Math.max(shape.x1, shape.x2);
            const minY = Math.min(shape.y1, shape.y2);
            const maxY = Math.max(shape.y1, shape.y2);
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }

        case "triangle": {
            const minX = Math.min(shape.x1, shape.x2, shape.x3);
            const maxX = Math.max(shape.x1, shape.x2, shape.x3);
            const minY = Math.min(shape.y1, shape.y2, shape.y3);
            const maxY = Math.max(shape.y1, shape.y2, shape.y3);
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        }

        case "freehand":
        case "eraser": {
            if (shape.points.length === 0) return null;
            let minX = Infinity, maxX = -Infinity;
            let minY = Infinity, maxY = -Infinity;
            shape.points.forEach((p) => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            });
            const padding =
                (shape.type === "freehand" ? shape.strokeWidth : shape.size) / 2 + 2;
            return {
                x: minX - padding,
                y: minY - padding,
                width: maxX - minX + padding * 2,
                height: maxY - minY + padding * 2,
            };
        }

        case "text": {
            const fontSize = shape.strokeWidth * 10;
            const lines = shape.content.split("\n");
            let maxWidth = 0;
            lines.forEach((line) => {
                maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
            });
            return {
                x: shape.x,
                y: shape.y - fontSize * 0.8,
                width: maxWidth,
                height: lines.length * fontSize * 1.2,
            };
        }

        case "image":
            return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };

        default:
            return null;
    }
}

export function clearImageCache() {
    Object.keys(imageCache).forEach((key) => delete imageCache[key]);
}