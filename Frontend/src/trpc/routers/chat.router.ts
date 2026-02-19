import { createTRPCRouter, protectedProcedure } from "../init";

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import prisma from "@/lib/db";

export const chatRouter = createTRPCRouter({
    save: protectedProcedure
        .input(z.object({
            roomId: z.number(),
            message: z.any()
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

            await prisma.chat.create({
                data: {
                    roomId: input.roomId,
                    userId: ctx.userId,
                    message: input.message,
                },
            });

            return { message: "Chat saved" };
        }),
});