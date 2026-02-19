import { createTRPCRouter, protectedProcedure } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import prisma from "@/lib/db";

export const canvasRouter = createTRPCRouter({

    // Debounced save from client
    save: protectedProcedure
        .input(z.object({
            roomId: z.number(),
            state: z.object({
                elements: z.array(z.any()),
                version: z.number(),
                lastUpdated: z.number(),
            }),
        }))
        .mutation(async ({ input, ctx }) => {

            const member = await prisma.roomMember.findUnique({
                where: {
                    roomId_userId: {
                        roomId: input.roomId,
                        userId: ctx.userId
                    }
                },
            });

            if (!member) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this room" });
            }

            const canvas = await prisma.canvas.upsert({
                where: {
                    roomId: input.roomId
                },
                update: {
                    state: input.state
                },
                create: {
                    roomId: input.roomId,
                    state: input.state
                },
            });
            return { canvas };
        }),

    // Load canvas state on join
    get: protectedProcedure
        .input(z.object({
            roomId: z.number()
        }))
        .query(async ({ input, ctx }) => {

            const member = await prisma.roomMember.findUnique({
                where: {
                    roomId_userId: {
                        roomId: input.roomId,
                        userId: ctx.userId
                    }
                },
            });

            if (!member) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this room" });
            }

            const canvas = await prisma.canvas.findUnique({
                where: {
                    roomId: input.roomId
                },
            });

            const state = canvas?.state as {
                elements: unknown[];
                version: number;
                lastUpdated: number;
            } | null;

            return { state };
        }),
});