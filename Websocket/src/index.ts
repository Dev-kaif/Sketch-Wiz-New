import WS, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";

import {
    User,
    ClientMessage,
    ServerMessage,
    CanvasState,
    RoomId,
    AuthPayload,
} from "./types";

const JWT_SECRET = process.env.JWT_SECRET!;

const wss = new WebSocketServer({ port: 8000 });


// Connected users
const users: User[] = [];

// Optional in-memory room state (for new joiners)
const roomStates = new Map<RoomId, CanvasState>();


function broadcastToRoom(
    roomId: RoomId,
    data: ServerMessage,
    sender?: WS
) {
    users.forEach((u) => {
        if (u.rooms.includes(roomId) && u.ws !== sender) {
            u.ws.send(JSON.stringify(data));
        }
    });
}

// connection
wss.on("connection", (socket, request) => {
    try {
        const url = request.url;
        const queryParam = new URLSearchParams(url?.split("?")[1]);
        const token = queryParam.get("token");

        if (!token) throw new Error("Token not provided");

        const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
        const userId = decoded.id;

        if (!userId) throw new Error("Invalid token");

        const user: User = { ws: socket, rooms: [], userId };
        users.push(user);


        socket.on("message", (data) => {
            const parsedData = JSON.parse(
                data.toString()
            ) as ClientMessage;

            switch (parsedData.type) {

                case "join_room": {
                    if (!user.rooms.includes(parsedData.roomId)) {
                        user.rooms.push(parsedData.roomId);
                    }

                    // Send in-memory snapshot ONLY
                    const state = roomStates.get(parsedData.roomId);

                    const msg: ServerMessage = {
                        type: "canvas_snapshot",
                        roomId: parsedData.roomId,
                        state: state ?? null,
                    };

                    socket.send(JSON.stringify(msg));
                    break;
                }


                case "leave_room": {
                    user.rooms = user.rooms.filter(
                        (id) => id !== parsedData.roomId
                    );
                    break;
                }


                case "canvas_update": {
                    const { roomId, message } = parsedData;

                    // Update memory
                    roomStates.set(roomId, message);

                    // Broadcast to others
                    broadcastToRoom(
                        roomId,
                        {
                            type: "canvas_update",
                            roomId,
                            state: message,
                        },
                        socket
                    );

                    break;
                }


                case "chat": {
                    broadcastToRoom(
                        parsedData.roomId,
                        {
                            type: "chat",
                            message: parsedData.message,
                            roomId: parsedData.roomId,
                        },
                        socket
                    );

                    break;
                }


                case "ai": {
                    broadcastToRoom(parsedData.roomId, {
                        type: "ai",
                        message: parsedData.message,
                        roomId: parsedData.roomId,
                    });

                    break;
                }

                case "ai_image_request": {
                    broadcastToRoom(parsedData.roomId, {
                        type: "ai_image_result",
                        roomId: parsedData.roomId,
                        job: {
                            jobId: parsedData.jobId,
                            status: "pending",
                        },
                    }, socket);
                    break;
                }
            }
        });


        socket.on("close", () => {
            const index = users.indexOf(user);
            if (index !== -1) users.splice(index, 1);
        });
    } catch {
        socket.close();
    }
});
