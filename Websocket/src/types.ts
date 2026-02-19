import { JwtPayload } from "jsonwebtoken";
import WS from "ws";

export type RoomId = number;
export type UserId = number;

export interface CanvasElement {
    id: string;
    type: "rectangle" | "ellipse" | "line" | "arrow" | "text" | "free";
    x: number;
    y: number;
    width?: number;
    height?: number;
    points?: { x: number; y: number }[];
    text?: string;
    strokeColor?: string;
    fillColor?: string;
}

export interface CanvasState {
    elements: CanvasElement[];
    version: number;
    lastUpdated: number;
}

export interface ChatMessage {
    text: string;
    createdAt: number;
}

export interface AIMessage {
    prompt: string;
    result?: string;
}

export interface AuthPayload extends JwtPayload {
    id: UserId;
}

export interface User {
    ws: WS;
    rooms: RoomId[];
    userId: number;
}


export type ClientMessage =
    | { type: "join_room"; roomId: RoomId }
    | { type: "leave_room"; roomId: RoomId }
    | { type: "chat"; roomId: RoomId; message: ChatMessage }
    | { type: "ai"; roomId: RoomId; message: AIMessage }
    | { type: "canvas_update"; roomId: RoomId; message: CanvasState };

export type ServerMessage =
    | { type: "canvas_snapshot"; roomId: RoomId; state: CanvasState | null }
    | { type: "canvas_update"; roomId: RoomId; state: CanvasState }
    | { type: "chat"; roomId: RoomId; message: ChatMessage }
    | { type: "ai"; roomId: RoomId; message: AIMessage };
