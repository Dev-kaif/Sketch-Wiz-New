import prisma from "@/lib/db";
import { inngest } from "./client";
import {
    fileToGenerativePart,
    getPromptFromAI,
    generateImageFromPrompt,
    uploadImageToR2,
} from "./utils";
import axios from "axios";

export const improveImage = inngest.createFunction(
    {
        id: "improve-image",
        retries: 2,
        onFailure: async ({ event }) => {
            await prisma.job.update({
                where: { id: event.data.event.data.jobId },
                data: { status: "failed" },
            });
        },
    },
    { event: "ai/image.improve" },
    async ({ event, step }) => {

        const { jobId, image } = event.data;

        // step 1: generate prompt from image
        const prompt = await step.run("get-prompt-from-ai", async () => {
            const base64Data = image.includes(",")
                ? image.split(",")[1]
                : image;
            const imageBuffer = Buffer.from(base64Data, "base64");
            const imagePart = fileToGenerativePart(imageBuffer, "image/png");
            return await getPromptFromAI(imagePart);
        });

        // step 2: generate improved image
        const generatedBase64 = await step.run("generate-image", async () => {
            const buffer = await generateImageFromPrompt(prompt);
            if (!buffer) throw new Error("Image generation failed");
            return buffer.toString("base64");
        });

        // step 3: remove background

        const noBgBase64 = await step.run("remove-background", async () => {
            const response = await axios.post(
                `${process.env.NEXT_PUBLIC_WS_URL}/remove-bg`,
                {
                    base64Image: generatedBase64,
                },
                {
                    headers: {
                        "Content-Type": "application/json",
                        "x-internal-secret": process.env.JWT_SECRET!,
                    },
                    timeout: 60_000,
                }
            );

            return response.data.base64Image as string;
        });



        // step 4: upload to R2
        const key = await step.run("upload-to-r2", async () => {
            const buffer = Buffer.from(noBgBase64, "base64");
            const imageKey = `results/${jobId}.png`;
            await uploadImageToR2(buffer, imageKey);
            return imageKey;
        });

        // step 5: update job in DB
        await step.run("update-job", async () => {
            await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: "done",
                    resultUrl: key,
                },
            });
        });

        return { jobId, key };
    }
);