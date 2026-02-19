import { roomRouter } from "./room.router";
import { canvasRouter } from "./canvas.router";
import { chatRouter } from "./chat.router";
import { jobRouter } from "./job.router";
import { createTRPCRouter } from "../init";
import { aiRouter } from "./ai.router";

export const appRouter = createTRPCRouter({
    room: roomRouter,
    canvas: canvasRouter,
    chat: chatRouter,
    job: jobRouter,
    ai: aiRouter,
});

export type AppRouter = typeof appRouter;