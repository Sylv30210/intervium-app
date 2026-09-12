import { GoogleGenAI } from "@google/genai";
import { AI_TOOL_DECLARATIONS, runAiTool } from "./ai-tools.js";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const SYSTEM_INSTRUCTION = "Tu es Intervium AI, un assistant utile et concis pour les utilisateurs d'Intervium. Réponds en français sauf si l'utilisateur demande clairement une autre langue. Tu peux consulter certaines données métier seulement avec les outils fournis. N'invente jamais de données, ne demande ni n'expose de secrets, et n'affirme jamais avoir exécuté une action : les outils sont strictement en lecture seule.";
const MAX_TOOL_ROUNDS = 3;

export class AiServiceError extends Error {
    constructor(message, { status = 502, code = "AI_UNAVAILABLE", upstreamStatus, upstreamType, upstreamMessage } = {}) {
        super(message);
        this.name = "AiServiceError";
        this.status = status;
        this.code = code;
        this.upstreamStatus = upstreamStatus;
        this.upstreamType = upstreamType;
        this.upstreamMessage = upstreamMessage;
    }
}

function configuredClient() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new AiServiceError("Le service Intervium AI n'est pas configuré.", { status: 503, code: "AI_NOT_CONFIGURED" });
    }
    return new GoogleGenAI({ apiKey });
}

function upstreamMetadata(error) {
    const upstreamStatus = Number(error?.status || error?.statusCode || error?.response?.status);
    const upstreamMessage = typeof error?.message === "string"
        ? error.message.replace(/AIza[\w-]+|AQ\.[\w.-]+/g, "[redacted]").slice(0, 300)
        : undefined;
    return {
        upstreamStatus: Number.isFinite(upstreamStatus) ? upstreamStatus : undefined,
        upstreamType: typeof error?.name === "string" ? error.name : undefined,
        upstreamMessage,
    };
}

function toServiceError(error) {
    if (error instanceof AiServiceError) return error;
    const { upstreamStatus: status, ...metadata } = upstreamMetadata(error);
    if (status === 429 || /quota|rate limit|resource exhausted/i.test(error?.message || "")) {
        return new AiServiceError("La limite Gemini est atteinte. Réessayez dans quelques instants.", { status: 429, code: "AI_QUOTA_EXCEEDED", upstreamStatus: status, ...metadata });
    }
    if ([401, 403].includes(status)) {
        return new AiServiceError("La configuration du service Intervium AI est invalide.", { status: 503, code: "AI_CONFIGURATION_ERROR", upstreamStatus: status, ...metadata });
    }
    return new AiServiceError("Intervium AI est temporairement indisponible.", { upstreamStatus: status, ...metadata });
}

function conversationContents(history, message) {
    const safeHistory = Array.isArray(history) ? history.slice(-12).filter((entry) => ["user", "assistant"].includes(entry.role) && typeof entry.content === "string") : [];
    return [...safeHistory.map((entry) => ({ role: entry.role === "assistant" ? "model" : "user", parts: [{ text: entry.content.slice(0, 4000) }] })), { role: "user", parts: [{ text: message }] }];
}

async function requestWithRetry(client, payload) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try { return await client.models.generateContent(payload); }
        catch (error) {
            lastError = error;
            const { upstreamStatus } = upstreamMetadata(error);
            if (attempt === 2 || ![undefined, 502, 503, 504].includes(upstreamStatus)) break;
            await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
    }
    throw lastError;
}

export function aiModelName() {
    return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export async function generateAiReply({ message, history = [], user }) {
    const client = configuredClient();
    const contents = conversationContents(history, message);
    try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
            const response = await requestWithRetry(client, {
                model: aiModelName(), contents,
                config: { systemInstruction: SYSTEM_INSTRUCTION, maxOutputTokens: 1024, tools: [{ functionDeclarations: AI_TOOL_DECLARATIONS }] },
            });
            const calls = Array.isArray(response.functionCalls) ? response.functionCalls.slice(0, 4) : [];
            if (!calls.length) {
                const text = response.text?.trim();
                if (!text) throw new AiServiceError("Intervium AI n'a pas produit de réponse.", { status: 502, code: "AI_EMPTY_RESPONSE" });
                return { reply: text, toolCalls: round };
            }
            if (round === MAX_TOOL_ROUNDS) throw new AiServiceError("Intervium AI a atteint la limite de consultations autorisées.", { status: 422, code: "AI_TOOL_LIMIT" });
            contents.push({ role: "model", parts: calls.map((call) => ({ functionCall: { name: call.name, args: call.args || {}, id: call.id } })) });
            const results = await Promise.all(calls.map(async (call) => ({ name: call.name, id: call.id, output: await runAiTool(call.name, call.args || {}, user) })));
            contents.push({ role: "user", parts: results.map((result) => ({ functionResponse: { name: result.name, id: result.id, response: { result: result.output } } })) });
        }
    } catch (error) {
        throw toServiceError(error);
    }
}
