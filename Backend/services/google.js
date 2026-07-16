import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

function config() {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
    const encryptionKey = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
    if (!clientId || !clientSecret || !redirectUri || !encryptionKey || !process.env.JWT_SECRET) return null;
    const key = /^[a-f0-9]{64}$/i.test(encryptionKey)
        ? Buffer.from(encryptionKey, "hex")
        : Buffer.from(encryptionKey, "base64");
    if (key.length !== 32) throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY doit contenir 32 octets encodés en Base64.");
    return { clientId, clientSecret, redirectUri, key };
}

export function googleEnabled() { return process.env.GMAIL_SENDING_ENABLED?.trim().toLowerCase() === "true" && Boolean(config()); }

function encrypt(value) {
    const { key } = config();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value) {
    const { key } = config();
    const [iv, tag, encrypted] = String(value).split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function googleAuthorizationUrl(user) {
    const cfg = config();
    if (!cfg || !googleEnabled()) throw new Error("GOOGLE_NOT_CONFIGURED");
    const state = jwt.sign({ purpose: "google_oauth", userId: user.id, entrepriseId: user.entreprise_id }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "10m" });
    const params = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirectUri, response_type: "code", scope: `openid email ${GMAIL_SEND_SCOPE}`, access_type: "offline", include_granted_scopes: "true", prompt: "consent", state });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export function verifyGoogleState(state) {
    const payload = jwt.verify(state, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.purpose !== "google_oauth") throw new Error("STATE_INVALID");
    return payload;
}

async function tokenRequest(params) {
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "GOOGLE_TOKEN_ERROR");
    return data;
}

export async function connectGoogleAccount({ code, userId, entrepriseId }) {
    const cfg = config();
    const tokens = await tokenRequest({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri, grant_type: "authorization_code" });
    if (!tokens.refresh_token) throw new Error("GOOGLE_REFRESH_TOKEN_MISSING");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email) throw new Error("GOOGLE_PROFILE_ERROR");
    await pool.query(
        `INSERT INTO connexions_google (utilisateur_id, entreprise_id, email_google, refresh_token_chiffre, scope)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (utilisateur_id, entreprise_id) DO UPDATE
         SET email_google = EXCLUDED.email_google, refresh_token_chiffre = EXCLUDED.refresh_token_chiffre,
             scope = EXCLUDED.scope, updated_at = NOW()`,
        [userId, entrepriseId, profile.email.toLowerCase(), encrypt(tokens.refresh_token), tokens.scope || GMAIL_SEND_SCOPE]
    );
    return profile.email;
}

export async function googleConnection(user) {
    const result = await pool.query("SELECT email_google, connected_at, updated_at FROM connexions_google WHERE utilisateur_id = $1 AND entreprise_id = $2", [user.id, user.entreprise_id]);
    return result.rows[0] || null;
}

export async function disconnectGoogle(user) {
    const result = await pool.query("DELETE FROM connexions_google WHERE utilisateur_id = $1 AND entreprise_id = $2 RETURNING refresh_token_chiffre", [user.id, user.entreprise_id]);
    if (result.rowCount) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(result.rows[0].refresh_token_chiffre))}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }).catch(() => {});
}

async function accessTokenFor(user) {
    const cfg = config();
    const result = await pool.query("SELECT refresh_token_chiffre FROM connexions_google WHERE utilisateur_id = $1 AND entreprise_id = $2", [user.id, user.entreprise_id]);
    if (!result.rowCount) throw new Error("GOOGLE_NOT_CONNECTED");
    const tokens = await tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: decrypt(result.rows[0].refresh_token_chiffre), grant_type: "refresh_token" });
    return tokens.access_token;
}

function mimeMessage({ from, to, subject, text, pdf, filename }) {
    const boundary = `intervium-${crypto.randomBytes(12).toString("hex")}`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const parts = [
        `From: ${from}`, `To: ${to.join(", ")}`, `Subject: ${encodedSubject}`, "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", Buffer.from(text).toString("base64"),
        `--${boundary}`, `Content-Type: application/pdf; name="${filename}"`, "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${filename}"`, "", pdf.toString("base64"), `--${boundary}--`, "",
    ];
    return Buffer.from(parts.join("\r\n")).toString("base64url");
}

export async function sendGmailReport({ user, to, subject, text, pdf, filename }) {
    const connection = await googleConnection(user);
    if (!connection) throw new Error("GOOGLE_NOT_CONNECTED");
    const accessToken = await accessTokenFor(user);
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: mimeMessage({ from: connection.email_google, to, subject, text, pdf, filename }) }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "GMAIL_SEND_ERROR");
    return data;
}
