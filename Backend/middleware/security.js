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

export function createRateLimiter({ windowMs, max, message }) {
    const attempts = new Map();
    let lastSweep = Date.now();
    return (req, res, next) => {
        const now = Date.now();
        if (now - lastSweep > windowMs) {
            for (const [key, entry] of attempts) if (entry.resetAt <= now) attempts.delete(key);
            lastSweep = now;
        }
        const key = req.ip || req.socket.remoteAddress || "unknown";
        let entry = attempts.get(key);
        if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs };
        entry.count += 1;
        attempts.set(key, entry);
        res.set("RateLimit-Limit", String(max));
        res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
        res.set("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));
        if (entry.count > max) {
            res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({ error: message });
        }
        return next();
    };
}
