import crypto from "node:crypto";

const VERSION = "v1";

function masterKey() {
    const configured = String(process.env.EMAIL_CREDENTIALS_ENCRYPTION_KEY || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "").trim();
    if (!configured) throw new Error("EMAIL_ENCRYPTION_NOT_CONFIGURED");
    const decoded = /^[a-f0-9]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64");
    if (decoded.length !== 32) throw new Error("EMAIL_ENCRYPTION_KEY_INVALID");
    return decoded;
}

export function encryptCredential(value) {
    if (typeof value !== "string" || !value) throw new Error("EMAIL_SECRET_REQUIRED");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptCredential(payload) {
    const [version, iv, tag, ciphertext] = String(payload || "").split(".");
    if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("EMAIL_SECRET_FORMAT_INVALID");
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function emailEncryptionStatus() {
    try { masterKey(); return { configured: true }; } catch { return { configured: false }; }
}
