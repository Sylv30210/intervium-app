import jwt from "jsonwebtoken";
import pool from "../config/database.js";
import { decryptCredential, encryptCredential } from "./email-crypto.js";

const SCOPES = "openid profile email offline_access Mail.Send";
const AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";

function env(name) { return String(process.env[name] || "").trim(); }
function redirectUri() { return env("MICROSOFT_REDIRECT_URI") || (env("APP_URL") ? `${env("APP_URL").replace(/\/$/, "")}/api/email-connections/microsoft/callback` : ""); }

export function microsoftConfigurationStatus() {
    const missing = ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"].filter((name) => !env(name));
    if (!redirectUri()) missing.push("MICROSOFT_REDIRECT_URI ou APP_URL");
    return { enabled: missing.length === 0, missing };
}

export function microsoftAuthorizationUrl(user) {
    if (!microsoftConfigurationStatus().enabled) throw new Error("MICROSOFT_NOT_CONFIGURED");
    const state = jwt.sign({ purpose: "microsoft_oauth", userId: user.id, entrepriseId: user.entreprise_id }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "10m" });
    const params = new URLSearchParams({ client_id: env("MICROSOFT_CLIENT_ID"), response_type: "code", redirect_uri: redirectUri(), response_mode: "query", scope: SCOPES, state, prompt: "select_account" });
    return `${AUTHORITY}/authorize?${params}`;
}

export function verifyMicrosoftState(state) {
    const payload = jwt.verify(state, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (payload.purpose !== "microsoft_oauth") throw new Error("STATE_INVALID");
    return payload;
}

async function tokenRequest(params) {
    const response = await fetch(`${AUTHORITY}/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env("MICROSOFT_CLIENT_ID"), client_secret: env("MICROSOFT_CLIENT_SECRET"), ...params }) });
    const data = await response.json();
    if (!response.ok) throw new Error(`MICROSOFT_${String(data.error || "TOKEN_ERROR").toUpperCase()}`);
    return data;
}

function idTokenEmail(idToken) {
    const payload = JSON.parse(Buffer.from(String(idToken).split(".")[1] || "", "base64url").toString("utf8"));
    return String(payload.preferred_username || payload.email || "").trim().toLowerCase();
}

export async function connectMicrosoftAccount({ code, userId, entrepriseId }) {
    const tokens = await tokenRequest({ code, redirect_uri: redirectUri(), scope: SCOPES, grant_type: "authorization_code" });
    const email = idTokenEmail(tokens.id_token);
    if (!email || !tokens.refresh_token) throw new Error("MICROSOFT_ACCOUNT_INCOMPLETE");
    const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000);
    await pool.query(
        `INSERT INTO connexions_email (utilisateur_id, entreprise_id, fournisseur, adresse_email, type_connexion,
          oauth_access_token_chiffre, oauth_refresh_token_chiffre, oauth_expire_at, oauth_scope, statut, derniere_erreur)
         VALUES ($1,$2,'microsoft',$3,'OAUTH',$4,$5,$6,$7,'ACTIVE',NULL)
         ON CONFLICT (utilisateur_id, entreprise_id, fournisseur, adresse_email) DO UPDATE SET
          oauth_access_token_chiffre=EXCLUDED.oauth_access_token_chiffre, oauth_refresh_token_chiffre=EXCLUDED.oauth_refresh_token_chiffre,
          oauth_expire_at=EXCLUDED.oauth_expire_at, oauth_scope=EXCLUDED.oauth_scope, statut='ACTIVE', derniere_erreur=NULL, updated_at=NOW()`,
        [userId, entrepriseId, email, encryptCredential(tokens.access_token), encryptCredential(tokens.refresh_token), expiresAt, tokens.scope || SCOPES]
    );
    return email;
}

export async function microsoftAccessToken(connection) {
    if (connection.oauth_access_token_chiffre && connection.oauth_expire_at && new Date(connection.oauth_expire_at).getTime() > Date.now() + 60_000) return decryptCredential(connection.oauth_access_token_chiffre);
    const tokens = await tokenRequest({ refresh_token: decryptCredential(connection.oauth_refresh_token_chiffre), scope: SCOPES, grant_type: "refresh_token" });
    const refresh = tokens.refresh_token || decryptCredential(connection.oauth_refresh_token_chiffre);
    await pool.query(`UPDATE connexions_email SET oauth_access_token_chiffre=$1, oauth_refresh_token_chiffre=$2,
        oauth_expire_at=$3, oauth_scope=$4, statut='ACTIVE', derniere_erreur=NULL, updated_at=NOW() WHERE id=$5`,
        [encryptCredential(tokens.access_token), encryptCredential(refresh), new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000), tokens.scope || SCOPES, connection.id]);
    return tokens.access_token;
}

export async function revokeMicrosoft(connection) {
    // Microsoft ne fournit pas d'endpoint de révocation standard pour ce flux.
    // La suppression locale immédiate retire tout accès d'Intervium.
    await pool.query("DELETE FROM connexions_email WHERE id=$1", [connection.id]);
}
