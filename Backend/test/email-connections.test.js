import test from "node:test";
import assert from "node:assert/strict";

process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.GOOGLE_CLIENT_ID = "test-google-client";
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
process.env.GOOGLE_REDIRECT_URI = "https://example.test/api/google/callback";
process.env.GMAIL_SENDING_ENABLED = "true";
process.env.MICROSOFT_CLIENT_ID = "test-ms-client";
process.env.MICROSOFT_CLIENT_SECRET = "test-ms-secret";
process.env.MICROSOFT_REDIRECT_URI = "https://example.test/api/email-connections/microsoft/callback";
process.env.JWT_SECRET = "test-jwt-secret-long-enough-for-tests";
process.env.DB_HOST ||= "localhost";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.DB_NAME ||= "test";

const { encryptCredential, decryptCredential } = await import("../services/email-crypto.js");
const { publicConnection, safeEmailError, ownedConnection } = await import("../services/email-connections.js");
const { googleAuthorizationUrl } = await import("../services/google.js");
const { microsoftAuthorizationUrl, microsoftAccessToken } = await import("../services/microsoft.js");
const { default: pool } = await import("../config/database.js");

test("AES-256-GCM chiffre avec un nonce, un tag et une version", () => {
    const first = encryptCredential("secret-smtp");
    const second = encryptCredential("secret-smtp");
    assert.match(first, /^v1\.[^.]+\.[^.]+\.[^.]+$/);
    assert.notEqual(first, second);
    assert.equal(decryptCredential(first), "secret-smtp");
    assert.throws(() => decryptCredential(`${first.slice(0, -1)}A`));
});

test("les réponses publiques ne contiennent aucun secret ni jeton", () => {
    const exposed = JSON.stringify(publicConnection({ id: 1, fournisseur: "orange", adresse_email: "a@example.test", nom_expediteur: "A", type_connexion: "SMTP", statut: "ACTIVE", smtp_host: "smtp.example.test", smtp_port: 465, smtp_securite: "TLS", smtp_auth_requise: true, smtp_utilisateur: "a@example.test", smtp_secret_chiffre: "TOP_SECRET", oauth_access_token_chiffre: "TOKEN", oauth_refresh_token_chiffre: "REFRESH" }));
    assert.doesNotMatch(exposed, /TOP_SECRET|TOKEN|REFRESH|password/i);
});

test("Google conserve le seul scope Gmail nécessaire", () => {
    const url = new URL(googleAuthorizationUrl({ id: 1, entreprise_id: 2 }));
    const scope = url.searchParams.get("scope");
    assert.match(scope, /gmail\.send/);
    assert.doesNotMatch(scope, /gmail\.read|gmail\.modify|mail\.google\.com/);
});

test("Microsoft demande Mail.Send et offline_access, sans lecture de boîte", () => {
    const url = new URL(microsoftAuthorizationUrl({ id: 1, entreprise_id: 2 }));
    const scope = url.searchParams.get("scope");
    assert.match(scope, /Mail\.Send/);
    assert.match(scope, /offline_access/);
    assert.doesNotMatch(scope, /Mail\.Read/);
});

test("le renouvellement Microsoft remplace les jetons chiffrés", async (t) => {
    const originalQuery = pool.query;
    const originalFetch = global.fetch;
    const queries = [];
    pool.query = async (...args) => { queries.push(args); return { rowCount: 1, rows: [] }; };
    global.fetch = async () => ({ ok: true, json: async () => ({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 3600, scope: "Mail.Send" }) });
    t.after(() => { pool.query = originalQuery; global.fetch = originalFetch; });
    const token = await microsoftAccessToken({ id: 9, oauth_access_token_chiffre: encryptCredential("expired"), oauth_refresh_token_chiffre: encryptCredential("old-refresh"), oauth_expire_at: new Date(0) });
    assert.equal(token, "new-access");
    assert.equal(queries.length, 1);
    assert.doesNotMatch(JSON.stringify(queries), /new-access|new-refresh/);
});

test("les erreurs SMTP sont rendues compréhensibles sans message fournisseur", () => {
    assert.deepEqual(safeEmailError({ code: "EAUTH", message: "password hunter2 rejected" }), { code: "AUTHENTICATION_FAILED", message: "Identifiants incorrects ou mot de passe d’application requis." });
    assert.doesNotMatch(safeEmailError({ code: "EAUTH", message: "password hunter2 rejected" }).message, /hunter2/);
});

test("la lecture d’une connexion est bornée à l’utilisateur et à l’entreprise", async (t) => {
    const originalQuery = pool.query; let call;
    pool.query = async (...args) => { call=args; return { rows: [] }; };
    t.after(() => { pool.query=originalQuery; });
    assert.equal(await ownedConnection({ id: 41, entreprise_id: 77 }, 5), null);
    assert.deepEqual(call[1], [5, 41, 77]);
    assert.match(call[0], /utilisateur_id=\$2 AND entreprise_id=\$3/);
});
