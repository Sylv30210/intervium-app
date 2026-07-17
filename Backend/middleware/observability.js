import crypto from "node:crypto";

export function requestContext(req, res, next) {
    const requestId = req.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
    const startedAt = process.hrtime.bigint();
    req.requestId = requestId;
    res.set("X-Request-Id", requestId);
    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 || durationMs > 1_500 ? "warn" : "info";
        console.log(JSON.stringify({
            level, event: "http_request", request_id: requestId,
            method: req.method, path: req.originalUrl.split("?")[0],
            status: res.statusCode, duration_ms: Math.round(durationMs),
            user_id: req.user?.id || null, entreprise_id: req.user?.entreprise_id || null,
        }));
    });
    next();
}
