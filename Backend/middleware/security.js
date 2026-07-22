const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizedOrigins(value = "") {
    return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

export function verifyRequestOrigin(req, res, next) {
    if (!UNSAFE_METHODS.has(req.method)) return next();

    const origin = req.get("origin");
    const referer = req.get("referer");
    const fetchSite = req.get("sec-fetch-site");
    const serverOrigin = `${req.protocol}://${req.get("host")}`;
    const allowed = new Set([serverOrigin, ...normalizedOrigins(process.env.FRONTEND_ORIGIN)]);

    if (fetchSite === "cross-site") {
        return res.status(403).json({ error: "Requête intersite refusée." });
    }
    if (origin && !allowed.has(origin)) {
        return res.status(403).json({ error: "Origine de la requête non autorisée." });
    }
    if (!origin && referer) {
        try {
            if (!allowed.has(new URL(referer).origin)) {
                return res.status(403).json({ error: "Origine de la requête non autorisée." });
            }
        } catch {
            return res.status(403).json({ error: "En-tête Referer invalide." });
        }
    }
    return next();
}

export function createPersistentRateLimiter({ name, windowMs, max, message }) {
    if (!name || !Number.isFinite(windowMs) || !Number.isFinite(max)) {
        throw new TypeError("Configuration de rate limiter persistante invalide.");
    }
    return async (req, res, next) => {
        const identity = req.ip || req.socket.remoteAddress || "unknown";
        const digest = crypto.createHash("sha256").update(identity).digest("hex");
        const key = `${name}:${digest}`;
        try {
            const result = await pool.query(
                `INSERT INTO rate_limits (limiter_key, request_count, reset_at)
                 VALUES ($1, 1, NOW() + ($2::bigint * INTERVAL '1 millisecond'))
                 ON CONFLICT (limiter_key) DO UPDATE SET
                   request_count = CASE WHEN rate_limits.reset_at <= NOW() THEN 1 ELSE rate_limits.request_count + 1 END,
                   reset_at = CASE WHEN rate_limits.reset_at <= NOW() THEN NOW() + ($2::bigint * INTERVAL '1 millisecond') ELSE rate_limits.reset_at END
                 RETURNING request_count, reset_at`,
                [key, windowMs]
            );
            const entry = result.rows[0];
            const resetSeconds = Math.max(1, Math.ceil((new Date(entry.reset_at).getTime() - Date.now()) / 1000));
            res.set("RateLimit-Limit", String(max));
            res.set("RateLimit-Remaining", String(Math.max(0, max - entry.request_count)));
            res.set("RateLimit-Reset", String(Math.ceil(new Date(entry.reset_at).getTime() / 1000)));
            if (entry.request_count > max) {
                res.set("Retry-After", String(resetSeconds));
                return res.status(429).json({ error: message });
            }
            if (Math.random() < 0.01) pool.query("DELETE FROM rate_limits WHERE reset_at < NOW() - INTERVAL '1 day'").catch(() => {});
            return next();
        } catch (error) {
            console.error("Échec du rate limiting persistant", { name, code: error?.code });
            return res.status(503).json({ error: "Protection anti-abus temporairement indisponible." });
        }
    };
}
import crypto from "node:crypto";
import pool from "../config/database.js";
