import express from "express";
import { createServer } from "http";
import { removeBackground } from "@imgly/background-removal-node";
import { Buffer } from "buffer";

const app = express();


app.use(express.json({ limit: "10mb" }));


const JWT_SECRET = process.env.JWT_SECRET!;


app.post("/remove-bg", async (req, res) => {
    try {
        const authHeader = req.headers["x-internal-secret"];

        if (authHeader !== JWT_SECRET) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const { base64Image } = req.body;

        if (!base64Image) {
            return res.status(400).json({ error: "No image provided" });
        }

        const buffer = Buffer.from(base64Image, "base64");
        const blob = new Blob([buffer], { type: "image/png" });

        const resultBlob = await removeBackground(blob);

        const arrayBuffer = await resultBlob.arrayBuffer();
        const resultBase64 = Buffer.from(arrayBuffer).toString("base64");

        res.json({ base64Image: resultBase64 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Background removal failed" });
    }
});


app.get("/", (_, res) => {
    res.send("API running");
});


const server = createServer(app);


const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

import "./websocket";

export { server };
