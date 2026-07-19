import nodemailer from "nodemailer";
import pool from "../config/database.js";
import { sendGmailEmail } from "./google.js";
import { microsoftAccessToken } from "./microsoft.js";
import { safeEmailError, smtpTransportOptions } from "./email-connections.js";

const EMAIL = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/;
const MAX_RECIPIENTS = 20;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_MESSAGE_BYTES = 12 * 1024 * 1024;

function addresses(value) {
    const list = Array.isArray(value) ? [...new Set(value.map((item) => String(item).trim().toLowerCase()).filter(Boolean))] : [];
    if (list.some((item) => !EMAIL.test(item))) throw new Error("RECIPIENT_INVALID");
    return list;
}

function validateMessage(message) {
    const to = addresses(message.to), cc = addresses(message.cc), bcc = addresses(message.bcc);
    if (!to.length || to.length + cc.length + bcc.length > MAX_RECIPIENTS) throw new Error("RECIPIENT_LIMIT");
    const subject = String(message.subject || "").trim();
    if (!subject || subject.length > 300 || /[\r\n]/.test(subject)) throw new Error("HEADER_INJECTION");
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    let bytes = Buffer.byteLength(String(message.text || "")) + Buffer.byteLength(String(message.html || ""));
    for (const attachment of attachments) {
        if (!Buffer.isBuffer(attachment.content) || attachment.content.length > MAX_ATTACHMENT_BYTES || /[\r\n]/.test(String(attachment.filename || ""))) throw new Error("ATTACHMENT_INVALID");
        bytes += attachment.content.length;
    }
    if (bytes > MAX_MESSAGE_BYTES) throw new Error("MESSAGE_TOO_LARGE");
    return { ...message, to, cc, bcc, subject, attachments, bytes };
}

async function enforceRateLimit(user, recipientCount) {
    const result = await pool.query(`SELECT
      COUNT(*) FILTER (WHERE utilisateur_id=$1)::int AS user_sends,
      COALESCE(SUM(nombre_destinataires),0)::int AS company_recipients
      FROM journal_envois_email WHERE entreprise_id=$2 AND created_at > NOW() - INTERVAL '1 hour'`, [user.id, user.entreprise_id]);
    if (result.rows[0].user_sends >= 60 || result.rows[0].company_recipients + recipientCount > 200) throw new Error("EMAIL_RATE_LIMIT");
}

async function selectedConnection(user, id) {
    if (id) {
        const result = await pool.query("SELECT * FROM connexions_email WHERE id=$1 AND utilisateur_id=$2 AND entreprise_id=$3 AND statut<>'REVOKED'", [id,user.id,user.entreprise_id]);
        return result.rows[0] || null;
    }
    const result = await pool.query("SELECT * FROM connexions_email WHERE utilisateur_id=$1 AND entreprise_id=$2 AND statut='ACTIVE' ORDER BY updated_at DESC LIMIT 1", [user.id,user.entreprise_id]);
    return result.rows[0] || null;
}

function microsoftPayload(message) {
    const recipients = (items) => items.map((address) => ({ emailAddress: { address } }));
    return { message: { subject: message.subject, body: { contentType: message.html ? "HTML" : "Text", content: message.html || message.text || "" },
        toRecipients: recipients(message.to), ccRecipients: recipients(message.cc), bccRecipients: recipients(message.bcc),
        attachments: message.attachments.map((item) => ({ "@odata.type": "#microsoft.graph.fileAttachment", name: item.filename, contentType: item.contentType || "application/octet-stream", contentBytes: item.content.toString("base64") })) }, saveToSentItems: true };
}

export async function sendEmail({ user, connectionId, ...input }) {
    const message = validateMessage(input);
    await enforceRateLimit(user, message.to.length + message.cc.length + message.bcc.length);
    const connection = await selectedConnection(user, connectionId);
    if (!connection) throw new Error("EMAIL_CONNECTION_NOT_FOUND");
    let status = "SENT", errorCode = null;
    try {
        if (connection.fournisseur === "google") {
            await sendGmailEmail({ user, to: message.to, cc: message.cc, bcc: message.bcc, subject: message.subject, text: message.text || "", html: message.html || "", attachments: message.attachments });
        } else if (connection.fournisseur === "microsoft") {
            const token = await microsoftAccessToken(connection);
            const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(microsoftPayload(message)) });
            if (!response.ok) { const data = await response.json().catch(() => ({})); throw Object.assign(new Error("MICROSOFT_SEND_ERROR"), { code: data.error?.code || response.status }); }
        } else {
            await nodemailer.createTransport(smtpTransportOptions(connection)).sendMail({
                from: { name: connection.nom_expediteur || "", address: connection.adresse_email }, to: message.to, cc: message.cc, bcc: message.bcc,
                subject: message.subject, text: message.text || undefined, html: message.html || undefined, attachments: message.attachments.map((item) => ({ filename: item.filename, content: item.content, contentType: item.contentType }))
            });
        }
        await pool.query("UPDATE connexions_email SET statut='ACTIVE', derniere_erreur=NULL, updated_at=NOW() WHERE id=$1", [connection.id]);
        return { sent: true, provider: connection.fournisseur, from: connection.adresse_email };
    } catch (error) {
        const safe = safeEmailError(error); errorCode = safe.code;
        status = safe.code === "TEMPORARY_ERROR" ? "TEMPORARY_ERROR" : "PERMANENT_ERROR";
        await pool.query("UPDATE connexions_email SET statut='ERROR', derniere_erreur=$1, updated_at=NOW() WHERE id=$2", [safe.message, connection.id]);
        const wrapped = new Error(safe.code); wrapped.publicMessage = safe.message; throw wrapped;
    } finally {
        await pool.query(`INSERT INTO journal_envois_email (entreprise_id,utilisateur_id,connexion_email_id,fournisseur,nombre_destinataires,taille_octets,statut,code_erreur)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [user.entreprise_id,user.id,connection.id,connection.fournisseur,message.to.length+message.cc.length+message.bcc.length,message.bytes,status,errorCode]).catch(() => {});
    }
}
