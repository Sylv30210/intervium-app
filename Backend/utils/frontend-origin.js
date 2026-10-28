function configuredOrigins() {
    return String(process.env.FRONTEND_ORIGIN || "")
        .split(",")
        .map((value) => value.trim().replace(/\/$/, ""))
        .filter(Boolean);
}

function fallbackAppUrl() {
    return String(process.env.APP_URL || "").trim().replace(/\/$/, "");
}

export function frontendOriginForRequest(req) {
    const origin = String(req.get("origin") || "").trim().replace(/\/$/, "");
    const requestOrigin = `${req.protocol}://${req.get("host")}`.replace(/\/$/, "");
    const allowed = new Set([...configuredOrigins(), fallbackAppUrl(), requestOrigin]);
    return origin && allowed.has(origin) ? origin : fallbackAppUrl() || requestOrigin;
}

export function safeFrontendRedirect(value, fallback) {
    const normalized = String(value || "").trim().replace(/\/$/, "");
    const allowed = new Set([...configuredOrigins(), fallbackAppUrl(), fallback]);
    return allowed.has(normalized) ? normalized : fallback;
}
