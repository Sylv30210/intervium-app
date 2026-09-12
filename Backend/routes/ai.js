import express from "express";
import pool from "../config/database.js";
import { verifyToken } from "../middleware/auth.js";
import { AiServiceError, aiModelName, generateAiReply } from "../services/ai.js";

const router = express.Router();
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_HISTORY_MESSAGES = 100;

router.use(verifyToken);

function positiveId(value) { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; }
function titleFor(message) { return message.replace(/\s+/g, " ").trim().slice(0, 80) || "Nouvelle conversation"; }

async function ownedConversation(id, user) {
    const result = await pool.query("SELECT id, titre, created_at, updated_at FROM ai_conversations WHERE id=$1 AND entreprise_id=$2 AND utilisateur_id=$3", [id, user.entreprise_id, user.id]);
    return result.rows[0] || null;
}

async function createConversation(user, title = "Nouvelle conversation") {
    const result = await pool.query("INSERT INTO ai_conversations (entreprise_id, utilisateur_id, titre) VALUES ($1,$2,$3) RETURNING id,titre,created_at,updated_at", [user.entreprise_id, user.id, title.slice(0, 160)]);
    return result.rows[0];
}

async function conversationHistory(id) {
    const result = await pool.query("SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id=$1 ORDER BY created_at ASC,id ASC LIMIT $2", [id, MAX_HISTORY_MESSAGES]);
    return result.rows;
}

router.get("/conversations", async (req, res) => {
    const result = await pool.query(`SELECT c.id,c.titre,c.created_at,c.updated_at,COALESCE((SELECT m.content FROM ai_messages m WHERE m.conversation_id=c.id ORDER BY m.created_at DESC,m.id DESC LIMIT 1),'') AS dernier_message FROM ai_conversations c WHERE c.entreprise_id=$1 AND c.utilisateur_id=$2 ORDER BY c.updated_at DESC,c.id DESC LIMIT 50`, [req.user.entreprise_id, req.user.id]);
    res.json({ conversations: result.rows });
});

router.post("/conversations", async (req, res) => {
    const title = typeof req.body?.titre === "string" ? req.body.titre.trim().slice(0, 160) : "Nouvelle conversation";
    res.status(201).json({ conversation: await createConversation(req.user, title || "Nouvelle conversation") });
});

router.get("/conversations/:id", async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Conversation invalide." });
    const conversation = await ownedConversation(id, req.user);
    if (!conversation) return res.status(404).json({ error: "Conversation introuvable." });
    res.json({ conversation, messages: await conversationHistory(id) });
});

router.delete("/conversations/:id", async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Conversation invalide." });
    const result = await pool.query("DELETE FROM ai_conversations WHERE id=$1 AND entreprise_id=$2 AND utilisateur_id=$3 RETURNING id", [id, req.user.entreprise_id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Conversation introuvable." });
    res.status(204).send();
});

async function sendMessage(req, res, conversationId) {
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) return res.status(400).json({ error: "Le message est requis.", code: "AI_INVALID_MESSAGE" });
    if (message.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Le message ne peut pas dépasser ${MAX_MESSAGE_LENGTH} caractères.`, code: "AI_MESSAGE_TOO_LONG" });
    }

    const interventionId = req.body?.intervention_id == null ? null : positiveId(req.body.intervention_id);
    if (req.body?.intervention_id != null && !interventionId) return res.status(400).json({ error: "Identifiant intervention invalide.", code: "AI_INVALID_INTERVENTION" });
    const entrepriseId = req.user.entreprise_id;
    try {
        const conversation = conversationId ? await ownedConversation(conversationId, req.user) : await createConversation(req.user, titleFor(message));
        if (!conversation) return res.status(404).json({ error: "Conversation introuvable." });
        const history = await conversationHistory(conversation.id);
        await pool.query("INSERT INTO ai_messages (conversation_id,role,content) VALUES ($1,'user',$2)", [conversation.id, message]);
        const prompt = interventionId ? `${message}\n\nContexte demandé : intervention #${interventionId}. Utilise get_intervention avec cet identifiant avant de répondre.` : message;
        const result = await generateAiReply({ message: prompt, history, user: req.user });
        await pool.query("INSERT INTO ai_messages (conversation_id,role,content,metadata) VALUES ($1,'assistant',$2,$3::jsonb)", [conversation.id, result.reply, JSON.stringify({ tool_calls: result.toolCalls, intervention_id: interventionId })]);
        await pool.query("UPDATE ai_conversations SET titre=CASE WHEN titre='Nouvelle conversation' THEN $1 ELSE titre END, updated_at=NOW() WHERE id=$2", [titleFor(message), conversation.id]);
        await pool.query("INSERT INTO ai_usage (entreprise_id,utilisateur_id,modele) VALUES ($1,$2,$3)", [entrepriseId, req.user.id, aiModelName()]);
        return res.status(conversationId ? 200 : 201).json({ reply: result.reply, conversation: { ...conversation, titre: conversation.titre === "Nouvelle conversation" ? titleFor(message) : conversation.titre } });
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
}

router.post("/conversations/:id/messages", async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Conversation invalide." });
    return sendMessage(req, res, id);
});

router.post("/chat", async (req, res) => {
    return sendMessage(req, res, null);
});

export default router;
