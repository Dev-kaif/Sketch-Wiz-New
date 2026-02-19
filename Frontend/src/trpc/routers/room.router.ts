import { createTRPCRouter, protectedProcedure } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcrypt";
import prisma from "@/lib/db";
import jwt from "jsonwebtoken"

export const roomRouter = createTRPCRouter({
    // Create room
    create: protectedProcedure
        .input(z.object({
            slug: z.string().min(3).max(30),
            password: z.string().min(6).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const passwordHash = input.password
                ? await bcrypt.hash(input.password, 10)
                : null;
            try {
                const room = await prisma.room.create({
                    data: {
                        slug: input.slug,
                        adminId: ctx.userId,
                        passwordHash,
                        members: {
                            create: { userId: ctx.userId }
                        }
                    },
                });
                return { room };
            } catch {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "Room with this slug already exists",
                });
            }
        }),

    // Join room via slug + password
    join: protectedProcedure
        .input(z.object({
            slug: z.string(),
            password: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {

            const room = await prisma.room.findUnique({
                where: { slug: input.slug },
            });

            if (!room) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
            }

            if (room.passwordHash) {

                if (!input.password) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "Password required" });
                }

                const valid = await bcrypt.compare(input.password, room.passwordHash);

                if (!valid) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "Invalid password" });
                }

            } else {

                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "This room requires an invite link"
                });
            }

            await prisma.roomMember.upsert({
                where: {
                    roomId_userId: {
                        roomId: room.id,
                        userId: ctx.userId
                    }
                },
                update: {},
                create: {
                    roomId: room.id,
                    userId: ctx.userId
                },
            });
            return { room };
        }),

    // Join via invite token
    joinByInvite: protectedProcedure
        .input(z.object({
            inviteToken: z.string()
        }))
        .mutation(async ({ input, ctx }) => {

            const room = await prisma.room.findUnique({
                where: {
                    inviteToken: input.inviteToken
                },
            });

            if (!room) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite link" });
            }

            await prisma.roomMember.upsert({
                where: {
                    roomId_userId: {
                        roomId: room.id,
                        userId: ctx.userId
                    }
                },
                update: {},
                create: {
                    roomId: room.id,
                    userId: ctx.userId
                },
            });
            return { room };
        }),

    // Get all rooms user is member of
    getAll: protectedProcedure
        .query(async ({ ctx }) => {

            const memberships = await prisma.roomMember.findMany({
                where: {
                    userId: ctx.userId
                },
                include: {
                    room: true
                },
            });

            return { rooms: memberships.map((m) => m.room) };
        }),

    // Get room by id
    getById: protectedProcedure
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

            const messages = await prisma.chat.findMany({
                where: {
                    roomId: input.roomId
                },
                orderBy: {
                    createdAt: "asc"
                },
            });
            return { messages };
        }),

    // Get room by slug
    getBySlug: protectedProcedure
        .input(z.object({
            slug: z.string()
        }))
        .query(async ({ input }) => {

            const room = await prisma.room.findUnique({
                where: {
                    slug: input.slug
                },
            });

            if (!room) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
            }

            return { room };
        }),

    // Delete room (admin only)
    delete: protectedProcedure
        .input(z.object({
            roomId: z.number()
        }))
        .mutation(async ({ input, ctx }) => {

            const room = await prisma.room.findUnique({
                where: {
                    id: input.roomId
                },
            });

            if (!room) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
            }

            if (room.adminId !== ctx.userId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Only admin can delete room" });
            }

            await prisma.room.delete({
                where: {
                    id: input.roomId
                }
            });

            return { room };
        }),

    // Delete canvas content only
    clearCanvas: protectedProcedure
        .input(z.object({
            roomId: z.number()
        }))
        .mutation(async ({ input, ctx }) => {

            const room = await prisma.room.findUnique({
                where: {
                    id: input.roomId
                },
            });

            if (!room) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Room not found" });
            }

            if (room.adminId !== ctx.userId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Only admin can clear canvas" });
            }

            await prisma.canvas.delete({
                where: {
                    roomId: input.roomId
                }
            });

            return { room };
        }),

    wsToken: protectedProcedure
        .query(({ ctx }) => {
            const wsToken = jwt.sign(
                { id: ctx.userId },
                process.env.JWT_SECRET!,
                { expiresIn: "7d" }
            );

            return wsToken;
        })
});