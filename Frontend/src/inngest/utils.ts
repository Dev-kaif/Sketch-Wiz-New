import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GoogleGenAI, Modality } from "@google/genai";

export const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});


export function fileToGenerativePart(imageBuffer: Buffer, mimeType: string) {
    return {
        inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType,
        },
    };
}

export async function getPromptFromAI(
    imagePart: ReturnType<typeof fileToGenerativePart>
): Promise<string> {
    const systemPrompt = `
You are an **expert sketch artist AI and a highly advanced prompt generator**, designed to analyze provided image data and construct **exceptionally detailed, technically accurate prompts** to guide image generation models (such as Gemini) in creating **superior, high-quality digital sketches**.
Your generated prompt must intelligently and creatively **enhance the input image**, instructing the AI to produce a visually compelling, stylistically consistent, and intricately detailed pencil-style sketch.
**NON-NEGOTIABLE RULES FOR PROMPT GENERATION — STRICTLY ENFORCED:**
1. **OUTPUT FORMAT – PROMPT ONLY:** Your output **must consist solely of the generated prompt**. No commentary, headers, explanations, or conversational text is allowed under any circumstances.
2. **COLOR PRESERVATION:** The prompt must **explicitly instruct the image generation AI to preserve the original colors** from the input image. No color deviations are allowed unless specifically dictated by the source image.
3. **DETAIL PRIORITY:** The prompt must **emphasize the necessity of extreme, high-resolution detail and fine-grained intricacy** throughout the sketch. Every element should be rendered with precision.
4. **SKETCH STYLE:** The prompt must guide the AI to produce a sketch with a **distinct pencil-drawn appearance**, while also retaining the **refinement and cleanliness of high-quality digital artwork**.
5. **BLACK BACKGROUND ENFORCEMENT:** The prompt must include a **clear and explicit instruction for the sketch to be rendered on a solid pure black background (#000000)**, as if drawn directly on black paper.
    `;

    const genAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY!,
    });

    const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        config: { systemInstruction: systemPrompt },
        contents: imagePart,
    });
    return response.text as string;
}

export async function generateImageFromPrompt(
    prompt: string
): Promise<Buffer | null> {
    const systemPrompt = `
You are an **elite, hyper-realistic virtual sketch artist**, renowned for transforming complex, multi-faceted prompts into breathtaking and intricately detailed digital sketches. Your sole mission is to precisely analyze and interpret every instruction, nuance, and subtle directive in the prompt, and translate it into a visually stunning composition **designed explicitly for rendering on an HTML canvas**.
**NON-NEGOTIABLE RULES — STRICTLY ENFORCED:**
1. **OUTPUT TYPE – SKETCH ONLY:** You must **only** produce a sketch. **Photorealistic images, 3D renders, or any non-sketch formats are strictly prohibited.**
2. **COLOR FIDELITY:** Use only the colors explicitly specified in the prompt. **Do not alter, approximate, or invent colors.**
3. **MANDATORY BACKGROUND:** The background **must be solid pure black (#000000)**. 
4. **DETAIL INTENSITY:** Every part of the sketch must be rendered with **extreme, microscopic detail**.
5. **CANVAS OPTIMIZATION:** The sketch must be fully optimized for **crisp, high-fidelity rendering on an HTML canvas**.
6. **ARTISTIC STYLE – PENCIL EFFECT:** The artwork **must unmistakably resemble a pencil-drawn sketch**.
7. **ARTISTIC STYLE – DIGITAL PRECISION:** While maintaining the pencil-drawn look, the sketch must also showcase **the polish and clarity of high-quality digital art.**
    `;

    const genAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await genAI.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: systemPrompt + prompt,
        config: {
            responseModalities: [Modality.TEXT, Modality.IMAGE],
        },
    });
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    for (const part of parts) {
        if (part.inlineData?.data) {
            return Buffer.from(part.inlineData.data, "base64");
        }
    }

    return null;
}

export async function uploadImageToR2(
    buffer: Buffer,
    key: string,
    mimeType = "image/png"
): Promise<void> {
    await r2.send(
        new PutObjectCommand({
            Bucket: process.env.R2_BUCKET!,
            Key: key,
            Body: buffer,
            ContentType: mimeType,
        })
    );
}

export async function getSignedImageUrl(
    key: string,
    expiresIn = 3600 // 1 hour default
): Promise<string> {
    const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
    });
    return await getSignedUrl(r2, command, { expiresIn });
}