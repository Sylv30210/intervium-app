import test from "node:test";
import assert from "node:assert/strict";
import { frontendOriginForRequest, safeFrontendRedirect } from "../utils/frontend-origin.js";

test("l'origine Netlify autorisée est conservée pour le retour OAuth", () => {
    const previousFrontendOrigin = process.env.FRONTEND_ORIGIN;
    const previousAppUrl = process.env.APP_URL;
    process.env.FRONTEND_ORIGIN = "https://app.example.test";
    process.env.APP_URL = "https://app.example.test";
    const request = { protocol: "https", get: (name) => name === "origin" ? "https://app.example.test" : "api.example.test" };
    assert.equal(frontendOriginForRequest(request), "https://app.example.test");
    assert.equal(safeFrontendRedirect("https://invalid.example.test", "https://app.example.test"), "https://app.example.test");
    process.env.FRONTEND_ORIGIN = previousFrontendOrigin;
    process.env.APP_URL = previousAppUrl;
});
