import test from "node:test";
import assert from "node:assert/strict";
import { paginatedResponse, paginationFromRequest } from "../utils/pagination.js";

test("la pagination borne la taille et normalise la recherche", () => {
    const page = paginationFromRequest({ query: { page: "3", limit: "500", q: `  ${"x".repeat(200)}  ` } });
    assert.deepEqual({ page: page.page, limit: page.limit, offset: page.offset }, { page: 3, limit: 100, offset: 200 });
    assert.equal(page.q.length, 120);
});

test("les anciennes requêtes sans pagination restent compatibles", () => {
    assert.equal(paginationFromRequest({ query: {} }), null);
});

test("la réponse paginée expose les éléments et le total", () => {
    assert.deepEqual(paginatedResponse([{ id: 1 }], 42, { page: 2, limit: 10 }), {
        items: [{ id: 1 }], total: 42, page: 2, limit: 10,
    });
});
