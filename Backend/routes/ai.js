import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { AiServiceError, generateAiReply } from "../services/ai.js";

const router = express.Router();
const MAX_MESSAGE_LENGTH = 4_000;

router.use(verifyToken);

router.post("/chat", async (req, res) => {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) return res.status(400).json({ error: "Le message est requis.", code: "AI_INVALID_MESSAGE" });
    if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères.`, code: "AI_MESSAGE_TOO_LONG" });
    }

    // L'entreprise provient exclusivement de la session. V1 ne transmet aucune donnée métier à Gemini.
    const entrepriseId = req.user.entreprise_id;
    try {
        const reply = await generateAiReply(message);
        return res.json({ reply });
    } catch (error) {
        const serviceError = error instanceof AiServiceError ? error : new AiServiceError("Intervium AI est temporairement indisponible.");
        console.error("Échec Intervium AI", {
            entreprise_id: entrepriseId,
            user_id: req.user.id,
            code: serviceError.code,
            upstream_status: serviceError.upstreamStatus,
            upstream_type: serviceError.upstreamType,
            upstream_message: serviceError.upstreamMessage,
        });
        return res.status(serviceError.status).json({ error: serviceError.message, code: serviceError.code });
    }
});

export default router;
