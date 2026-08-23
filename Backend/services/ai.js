import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const SYSTEM_INSTRUCTION = "Tu es Intervium AI, un assistant utile et concis pour les utilisateurs d'Intervium. Réponds en français sauf si l'utilisateur demande clairement une autre langue. Pour le moment, tu ne disposes d'aucune donnée de l'entreprise, des clients, des interventions ou des documents : ne prétends jamais y avoir accès.";

export class AiServiceError extends Error {
    constructor(message, { status = 502, code = "AI_UNAVAILABLE" } = {}) {
        super(message);
        this.name = "AiServiceError";
        this.status = status;
        this.code = code;
    }
}

function configuredClient() {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new AiServiceError("Le service Intervium AI n'est pas configuré.", { status: 503, code: "AI_NOT_CONFIGURED" });
    }
    return new GoogleGenAI({ apiKey });
}

function toServiceError(error) {
    if (error instanceof AiServiceError) return error;
    const status = Number(error?.status || error?.statusCode || error?.response?.status);
    if (status === 429 || /quota|rate limit|resource exhausted/i.test(error?.message || "")) {
        return new AiServiceError("La limite Gemini est atteinte. Réessayez dans quelques instants.", { status: 429, code: "AI_QUOTA_EXCEEDED" });
    }
    if ([401, 403].includes(status)) {
        return new AiServiceError("La configuration du service Intervium AI est invalide.", { status: 503, code: "AI_CONFIGURATION_ERROR" });
    }
    return new AiServiceError("Intervium AI est temporairement indisponible.");
}

export async function generateAiReply(message) {
    try {
        const response = await configuredClient().models.generateContent({
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
        throw toServiceError(error);
    }
}
