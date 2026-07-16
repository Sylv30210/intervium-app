import pool from "../config/database.js";

export async function logActivity({ user, action, resourceType, resourceId = null, summary, changes = {}, client = pool }) {
    if (!user?.entreprise_id || !action || !resourceType || !summary) return;
    await client.query(
        `INSERT INTO activites
            (entreprise_id, utilisateur_id, utilisateur_nom, utilisateur_role,
             action, ressource_type, ressource_id, resume, changements)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [user.entreprise_id, user.id || null, user.nom || null, user.role || null,
         action, resourceType, resourceId, String(summary).slice(0, 500), JSON.stringify(changes || {})]
    );
}

export async function createNotification({ entrepriseId, userId = null, targetRole = null, type, title, message, resourceType = null, resourceId = null, client = pool }) {
    if (!entrepriseId || (!userId && !targetRole)) return;
    await client.query(
        `INSERT INTO notifications
            (entreprise_id, utilisateur_id, role_cible, type, titre, message, ressource_type, ressource_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [entrepriseId, userId, targetRole, type, String(title).slice(0, 180), String(message).slice(0, 500), resourceType, resourceId]
    );
}
