import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { GoogleGenAI } from "@google/genai";
import { fileToGenerativePart } from "@/inngest/utils";
import { createTRPCRouter, protectedProcedure } from "../init";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const aiRouter = createTRPCRouter({
    solve: protectedProcedure
        .input(z.object({
            image: z.string(), // base64
            roomId: z.number(),
        }))
        .mutation(async ({ input }) => {
            const prompt =
                'You have been given an image that contains various mathematical, graphical, abstract problems, or event descriptions...' // same prompt as before

            try {
                const base64Data = input.image.includes(",")
                    ? input.image.split(",")[1]!
                    : input.image;
                const imageBuffer = Buffer.from(base64Data, "base64");
                const imagePart = fileToGenerativePart(imageBuffer, "image/png");

                const result = await genAI.models.generateContent({
                    model: "gemini-2.5-flash",
                    config: { systemInstruction: prompt },
                    contents: imagePart,
                });

                const responseText = result.text as string;
                const cleanedResponse = responseText
                    .replace(/```json/g, "")
                    .replace(/```/g, "")
                    .replace(/'/g, '"')
                    .replace(/\bTrue\b/g, "true")
                    .replace(/\bFalse\b/g, "false");

                let answers: object[] = [];
                try {
                    answers = JSON.parse(cleanedResponse);
                } catch {
                    return { result: [{ cleanedResponse }] };
                }

                return { result: answers };
            } catch (err) {
                throw new TRPCError({
                    code: "INTERNAL_SERVER_ERROR",
                    message: "AI solve failed",
                });
            }
        }),
});