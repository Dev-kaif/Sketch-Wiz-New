
import { createTRPCRouter, protectedProcedure } from "../init";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import prisma from "@/lib/db";
import { inngest } from "@/inngest/client";
import { getSignedImageUrl } from "@/inngest/utils";

export const jobRouter = createTRPCRouter({

    create: protectedProcedure
        .input(z.object({
            roomId: z.number(),
            image: z.string(),
        }))
        .mutation(async ({ input, ctx }) => {

            const job = await prisma.job.create({
                data: {
                    userId: ctx.userId,
                    roomId: input.roomId,
                    status: "pending",
                },
            });

            await inngest.send({
                name: "ai/image.improve",
                data: {
                    jobId: job.id,
                    image: input.image
                },
            });

            return { jobId: job.id };
        }),

    // Polling endpoint
    getStatus: protectedProcedure
        .input(z.object({
            jobId: z.string()
        }))
        .query(async ({ input, ctx }) => {

            const job = await prisma.job.findUnique({
                where: {
                    id: input.jobId
                },
            });

            if (!job) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Job not found" });
            }

            if (job.userId !== ctx.userId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Not your job" });
            }

            let signedUrl: string | null = null;

            if (job.status === "done" && job.resultUrl) {
                signedUrl = await getSignedImageUrl(job.resultUrl);
            }


            return {
                jobId: job.id,
                status: job.status,
                signedUrl,
            };
        }),
});