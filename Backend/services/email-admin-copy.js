import pool from "../config/database.js";

const EMAIL = /^[^\s@\r\n]+@[^\s@\r\n]+\.[^\s@\r\n]+$/;

export function normalizeEmailList(items) {
    return [...new Set((Array.isArray(items) ? items : [])
        .map((item) => String(item || "").trim().toLowerCase())
        .filter((item) => EMAIL.test(item)))];
}

export function adminCopyRecipients(adminEmails, visibleRecipients = []) {
    const visible = new Set(normalizeEmailList(visibleRecipients));
    return normalizeEmailList(adminEmails).filter((email) => !visible.has(email));
}

export async function activeAdminEmails(entrepriseId) {
    const result = await pool.query(
        `SELECT email
         FROM utilisateurs
         WHERE entreprise_id = $1
           AND role = 'ADMIN'
           AND actif = TRUE
           AND email IS NOT NULL
         ORDER BY id ASC`,
        [entrepriseId]
    );
    return normalizeEmailList(result.rows.map((row) => row.email));
}
