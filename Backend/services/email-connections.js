import dns from "node:dns/promises";
import net from "node:net";
import nodemailer from "nodemailer";
import pool from "../config/database.js";
import { SMTP_PROVIDERS } from "../config/smtp-providers.js";
import { decryptCredential, encryptCredential } from "./email-crypto.js";

const EMAIL = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/;
const SAFE_HOST = /^(?=.{1,253}$)(?!-)[a-z0-9.-]+(?<!-)$/i;

function publicAddress(address) {
    if (net.isIPv4(address)) {
        const p = address.split(".").map(Number);
        return !(p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168));
    }
    return !/^(::1|fc|fd|fe80)/i.test(address);
}

export async function validateSmtpHost(host) {
    const normalized = String(host || "").trim().toLowerCase();
    if (!SAFE_HOST.test(normalized) || normalized === "localhost" || normalized.endsWith(".local") || net.isIP(normalized)) throw new Error("SMTP_HOST_INVALID");
    const addresses = await dns.lookup(normalized, { all: true });
    if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) throw new Error("SMTP_HOST_PRIVATE");
    return normalized;
}

export function smtpTransportOptions(connection) {
    return {
        host: connection.smtp_host,
        port: Number(connection.smtp_port),
        secure: connection.smtp_securite === "TLS",
        requireTLS: connection.smtp_securite === "STARTTLS",
        tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
        connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
        ...(connection.smtp_auth_requise ? { auth: { user: connection.smtp_utilisateur, pass: decryptCredential(connection.smtp_secret_chiffre) } } : {}),
    };
}

export function publicConnection(row) {
    return { id: row.id, provider: row.fournisseur, email: row.adresse_email, sender_name: row.nom_expediteur,
        connection_type: row.type_connexion, status: row.statut, last_test_at: row.dernier_test_reussi_at,
        last_error: row.derniere_erreur, smtp_host: row.smtp_host, smtp_port: row.smtp_port,
        smtp_security: row.smtp_securite, smtp_auth_required: row.smtp_auth_requise, smtp_username: row.smtp_utilisateur,
        created_at: row.created_at, updated_at: row.updated_at };
}

export async function listConnections(user) {
    const result = await pool.query(`SELECT * FROM connexions_email WHERE utilisateur_id=$1 AND entreprise_id=$2 ORDER BY updated_at DESC`, [user.id, user.entreprise_id]);
    return result.rows.map(publicConnection);
}

export async function ownedConnection(user, id) {
    const result = await pool.query("SELECT * FROM connexions_email WHERE id=$1 AND utilisateur_id=$2 AND entreprise_id=$3", [id, user.id, user.entreprise_id]);
    return result.rows[0] || null;
}

export async function saveSmtpConnection(user, body, existingId = null) {
    const provider = SMTP_PROVIDERS[body.provider] ? body.provider : "custom";
    const email = String(body.email || "").trim().toLowerCase();
    const senderName = String(body.sender_name || "").trim().slice(0, 150) || null;
    const username = String(body.smtp_username || "").trim().slice(0, 254);
    const port = Number(body.smtp_port);
    const security = ["TLS", "STARTTLS", "NONE"].includes(body.smtp_security) ? body.smtp_security : "";
    const authRequired = body.smtp_auth_required !== false;
    if (!EMAIL.test(email) || !Number.isInteger(port) || port < 1 || port > 65535 || !security) throw new Error("SMTP_CONFIGURATION_INVALID");
    if (security === "NONE" && process.env.NODE_ENV === "production") throw new Error("SMTP_PLAINTEXT_FORBIDDEN");
    const host = await validateSmtpHost(body.smtp_host);
    if (authRequired && (!username || (!body.smtp_password && !existingId))) throw new Error("SMTP_CREDENTIALS_REQUIRED");
    const secret = body.smtp_password ? encryptCredential(String(body.smtp_password)) : null;
    if (existingId) {
        const result = await pool.query(`UPDATE connexions_email SET fournisseur=$1, adresse_email=$2, nom_expediteur=$3,
            smtp_host=$4, smtp_port=$5, smtp_securite=$6, smtp_auth_requise=$7, smtp_utilisateur=$8,
            smtp_secret_chiffre=COALESCE($9,smtp_secret_chiffre), statut='ACTIVE', derniere_erreur=NULL, updated_at=NOW()
            WHERE id=$10 AND utilisateur_id=$11 AND entreprise_id=$12 AND type_connexion='SMTP' RETURNING *`,
            [provider,email,senderName,host,port,security,authRequired,username||null,secret,existingId,user.id,user.entreprise_id]);
        if (!result.rowCount) return null;
        return publicConnection(result.rows[0]);
    }
    const result = await pool.query(`INSERT INTO connexions_email (utilisateur_id,entreprise_id,fournisseur,adresse_email,nom_expediteur,type_connexion,
        smtp_host,smtp_port,smtp_securite,smtp_auth_requise,smtp_utilisateur,smtp_secret_chiffre)
        VALUES ($1,$2,$3,$4,$5,'SMTP',$6,$7,$8,$9,$10,$11) RETURNING *`,
        [user.id,user.entreprise_id,provider,email,senderName,host,port,security,authRequired,username||null,secret]);
    return publicConnection(result.rows[0]);
}

export async function testSmtpConnection(user, id) {
    const connection = await ownedConnection(user, id);
    if (!connection || connection.type_connexion !== "SMTP") return null;
    try {
        await validateSmtpHost(connection.smtp_host);
        await nodemailer.createTransport(smtpTransportOptions(connection)).verify();
        await pool.query("UPDATE connexions_email SET statut='ACTIVE', dernier_test_reussi_at=NOW(), derniere_erreur=NULL, updated_at=NOW() WHERE id=$1", [id]);
        return { ok: true };
    } catch (error) {
        const code = safeEmailError(error);
        await pool.query("UPDATE connexions_email SET statut='ERROR', derniere_erreur=$1, updated_at=NOW() WHERE id=$2", [code.message, id]);
        return { ok: false, ...code };
    }
}

export function safeEmailError(error) {
    const code = String(error?.code || error?.responseCode || "EMAIL_ERROR").slice(0, 80);
    if (["EAUTH", "535", "534"].includes(code)) return { code: "AUTHENTICATION_FAILED", message: "Identifiants incorrects ou mot de passe d’application requis." };
    if (["ECONNECTION", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND"].includes(code)) return { code: "SERVER_UNREACHABLE", message: "Serveur SMTP inaccessible ou port incorrect." };
    if (/CERT|TLS|SSL/i.test(code) || /certificate/i.test(String(error?.message))) return { code: "TLS_INVALID", message: "Le certificat TLS du serveur est invalide." };
    if (Number(error?.responseCode) >= 400 && Number(error?.responseCode) < 500) return { code: "TEMPORARY_ERROR", message: "Le fournisseur a temporairement refusé l’envoi." };
    return { code: "EMAIL_ERROR", message: "La connexion e-mail a échoué. Vérifiez les paramètres du fournisseur." };
}
