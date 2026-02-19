export type Point = { x: number; y: number };

export type DrawingMode =
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

export type Shape =
    | {
        id: string;
        type: "rectangle";
        x: number;
        y: number;
        width: number;
        height: number;
        strokeColor: string;
        strokeWidth: number;
    }
    | {
        id: string;
        type: "circle";
        x: number;
        y: number;
        radiusX: number;
        radiusY: number;
        strokeColor: string;
        strokeWidth: number;
    }
    | {
        id: string;
        type: "line";
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        strokeColor: string;
        strokeWidth: number;
    }
    | {
        id: string;
        type: "triangle";
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        x3: number;
        y3: number;
        strokeColor: string;
        strokeWidth: number;
    }
    | {
        id: string;
        type: "freehand";
        points: Point[];
        strokeColor: string;
        strokeWidth: number;
    }
    | {
        id: string;
        type: "text";
        x: number;
        y: number;
        content: string;
        strokeColor: string;
        strokeWidth: number;
    }
    | {
        id: string;
        type: "eraser";
        points: Point[];
        size: number;
    }
    | {
        id: string;
        type: "arrow";
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        strokeColor: string;
        strokeWidth: number;
    }
    | {
        id: string;
        type: "image";
        x: number;
        y: number;
        width: number;
        height: number;
        src: string;
    };

export interface CanvasState {
    elements: Shape[];
    version: number;
    lastUpdated: number;
}

export interface DrawState {
    shapes: Shape[];
    offsetX: number;
    offsetY: number;
    scale: number;
    isDrawing: boolean;
    isPanning: boolean;
    isFreehandDrawing: boolean;
    isErasing: boolean;
    startX: number;
    startY: number;
    panStartX: number;
    panStartY: number;
    freehandPoints: Point[];
    eraserPoints: Point[];
    currentX?: number;
    currentY?: number;
    textPreview?: {
        x: number;
        y: number;
        text: string;
        showCursor: boolean;
    };
    selectedShapeIds: string[];
    isMarqueeSelecting: boolean;
    marqueeStartX: number;
    marqueeStartY: number;
    marqueeCurrentX: number;
    marqueeCurrentY: number;
}

export interface SelectedShapeInfo {
    shape: Shape;
    index: number;
    bounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface CanvasEngineOptions {
    canvas: HTMLCanvasElement;
    modeRef: React.RefObject<DrawingMode>;
    strokeColorRef: React.RefObject<string>;
    strokeWidthRef: React.RefObject<number>;
    socket: WebSocket;
    roomId: number;
    initialShapes?: Shape[];
    onShapeAdded: (shape: Shape) => void;
    onCanvasChanged: () => void;
    onAiResponse: (response: string) => void;
}