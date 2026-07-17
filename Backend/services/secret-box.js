import crypto from "node:crypto";

function key() {
    const configured = String(process.env.TOTP_ENCRYPTION_KEY || "");
    if (configured.length < 32) throw new Error("TOTP_ENCRYPTION_KEY doit contenir au moins 32 caractères.");
    return crypto.createHash("sha256").update(configured, "utf8").digest();
}

export function encryptSecret(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(value) {
    const [iv, tag, encrypted] = String(value).split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
