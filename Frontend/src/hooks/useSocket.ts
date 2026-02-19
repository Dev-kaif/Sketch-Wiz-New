"use client";
import { useEffect, useRef, useState } from "react";

export default function useSocket(token: string | null) {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!token) return;

        const ws = new WebSocket(
            `${process.env.NEXT_PUBLIC_WS_URL}/ws?token=${token}`
        );

        ws.onopen = () => setIsConnected(true);
        ws.onclose = () => setIsConnected(false);
        ws.onerror = (e) => console.error("WebSocket error:", e);

        socketRef.current = ws;
        setSocket(ws);

        return () => {
            ws.close();
        };
    }, [token]);

    return { socket, isConnected };
}