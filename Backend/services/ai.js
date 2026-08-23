import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const SYSTEM_INSTRUCTION = "Tu es Intervium AI, un assistant utile et concis pour les utilisateurs d'Intervium. Réponds en français sauf si l'utilisateur demande clairement une autre langue. Pour le moment, tu ne disposes d'aucune donnée de l'entreprise, des clients, des interventions ou des documents : ne prétends jamais y avoir accès.";

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

export async function generateAiReply(message) {
    const client = configuredClient();
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            const response = await client.models.generateContent({
                model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
                contents: message,
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION,
                    maxOutputTokens: 1024,
                },
            });
            const text = response.text?.trim();
            if (!text) throw new AiServiceError("Intervium AI n'a pas produit de réponse.", { status: 502, code: "AI_EMPTY_RESPONSE" });
            return text;
        } catch (error) {
            lastError = error;
            const { upstreamStatus } = upstreamMetadata(error);
            if (error instanceof AiServiceError || attempt === 2 || ![undefined, 502, 503, 504].includes(upstreamStatus)) break;
            await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
    }
    throw toServiceError(lastError);
}
