import { createHash } from "node:crypto";

export const BACKUP_MAGIC = Buffer.from("IVMBKP01");
export const IV_LENGTH = 12;
export const TAG_LENGTH = 16;

export function backupKey() {
    const value = process.env.BACKUP_ENCRYPTION_KEY || "";
    if (!value) throw new Error("BACKUP_ENCRYPTION_KEY est requise.");
    const decoded = /^[a-f0-9]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
    if (decoded.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY doit contenir exactement 32 octets (hexadécimal ou Base64).");
    return decoded;
}

export function safeDatabaseUrl() {
    const value = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL || "";
    if (!value) throw new Error("BACKUP_DATABASE_URL ou DATABASE_URL est requise.");
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("URL PostgreSQL invalide.");
    return value;
}

export function backupFingerprint(buffer) {
    return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}
