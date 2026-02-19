import express from "express";
import { removeBackground } from "@imgly/background-removal-node";
import { Buffer } from "buffer";

const app = express();

app.use(express.json({ limit: "10mb" }));

// shared secret so only my Inngest can call this
const SECRET = process.env.JWT_SECRET!;

app.post("/remove-bg", async (req, res) => {
    const authHeader = req.headers["x-internal-secret"];
    if (authHeader !== SECRET) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const { base64Image } = req.body;
    const buffer = Buffer.from(base64Image, "base64");
    const blob = new Blob([buffer], { type: "image/png" });

    const resultBlob = await removeBackground(blob);
    const arrayBuffer = await resultBlob.arrayBuffer();
    const resultBase64 = Buffer.from(arrayBuffer).toString("base64");

    res.json({ base64Image: resultBase64 });
});

app.listen(8002);
