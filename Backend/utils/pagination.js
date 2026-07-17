export function paginationFromRequest(req, { defaultLimit = 50, maxLimit = 100 } = {}) {
    if (req.query.page === undefined && req.query.limit === undefined && req.query.q === undefined) return null;
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(req.query.limit || String(defaultLimit), 10) || defaultLimit));
    return { page, limit, offset: (page - 1) * limit, q: String(req.query.q || "").trim().slice(0, 120) };
}

export function paginatedResponse(rows, total, pagination) {
    return { items: rows, total: Number(total || 0), page: pagination.page, limit: pagination.limit };
}
