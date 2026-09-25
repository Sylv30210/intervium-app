export const COLLECTION_PAGE_LIMIT = 20;

export function collectionPageUrl(view, { page = 1, limit = COLLECTION_PAGE_LIMIT, query = "", sort = "", direction = "asc" } = {}) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const normalizedQuery = String(query || "").trim();
    if (normalizedQuery) params.set("q", normalizedQuery);
    if (sort) params.set("sort", sort);
    if (sort && direction === "desc") params.set("direction", "desc");
    return `/${view}?${params}`;
}
