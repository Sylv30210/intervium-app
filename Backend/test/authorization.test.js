import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { requireRole } from "../middleware/auth.js";

function testApp({ method = "get", user }) {
    const app = express();
    app.use((req, _res, next) => { req.user = user; next(); });
    app[method]("/resource", requireRole(["ADMIN"]), (_req, res) => res.status(204).send());
    return app;
}

test("un administrateur peut écrire dans son entreprise", async () => {
    await request(testApp({ method: "post", user: { role: "ADMIN" } })).post("/resource").expect(204);
});

test("une assistance super-développeur reste en lecture seule par défaut", async () => {
    const response = await request(testApp({ method: "post", user: {
        role: "SUPER_DEVELOPPEUR", impersonated_company_id: 42, support_write: false,
    } })).post("/resource").expect(403);
    assert.match(response.body.error, /lecture seule/i);
});

test("une élévation temporaire autorise l'écriture mais jamais la suppression", async () => {
    const user = { role: "SUPER_DEVELOPPEUR", impersonated_company_id: 42, support_write: true };
    await request(testApp({ method: "post", user })).post("/resource").expect(204);
    await request(testApp({ method: "delete", user })).delete("/resource").expect(403);
});

test("un technicien ne reçoit pas les droits administrateur", async () => {
    await request(testApp({ user: { role: "TECHNICIEN" } })).get("/resource").expect(403);
});

test("la protection de rôle interdit toujours les suppressions au super-développeur", async () => {
    await request(testApp({ method: "delete", user: { role: "SUPER_DEVELOPPEUR", support_write: true } }))
        .delete("/resource").expect(403);
});
