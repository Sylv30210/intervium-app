import express from "express";
import pool from "../config/database.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
router.use(verifyToken);
const visibility = `(entreprise_id = $1::BIGINT AND (utilisateur_id = $2::BIGINT OR (utilisateur_id IS NULL AND role_cible = $3::TEXT)))`;

router.get("/", async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(10, Number.parseInt(req.query.limit || "20", 10)));
    const unread = req.query.unread === "true";
    const values = [req.user.entreprise_id, req.user.id, req.user.role];
    const where = `${visibility}${unread ? " AND lu_at IS NULL" : ""}`;
    try {
        if (["ADMIN", "TECHNICIEN"].includes(req.user.role)) {
            await pool.query(
                `INSERT INTO notifications (entreprise_id, utilisateur_id, role_cible, type, titre, message, ressource_type, ressource_id, dedupe_key)
                 SELECT i.entreprise_id,
                         CASE WHEN $3::TEXT = 'TECHNICIEN' THEN $2::BIGINT ELSE NULL END,
                         CASE WHEN $3::TEXT = 'ADMIN' THEN 'ADMIN' ELSE NULL END,
                        'INTERVENTION_SOON', 'Intervention bientôt prévue',
                        CONCAT('« ', i.titre, ' » est prévue le ', TO_CHAR(i.date_intervention, 'DD/MM/YYYY'), '.'),
                        'intervention', i.id, CONCAT('intervention-soon:', i.id, ':', i.date_intervention)
                 FROM interventions i
                 WHERE i.entreprise_id = $1::BIGINT AND i.statut = 'PLANIFIEE'
                   AND i.date_intervention BETWEEN CURRENT_DATE AND CURRENT_DATE + 2
                   AND ($3::TEXT = 'ADMIN' OR i.technicien_id = $2::BIGINT)
                 ON CONFLICT DO NOTHING`, values
            );
        }
        const counts = await pool.query(`SELECT COUNT(*)::INTEGER AS total, COUNT(*) FILTER (WHERE lu_at IS NULL)::INTEGER AS unread FROM notifications WHERE ${visibility}`, values);
        values.push(limit, (page - 1) * limit);
        const result = await pool.query(
            `SELECT id, type, titre, message, ressource_type, ressource_id, lu_at, created_at
             FROM notifications WHERE ${where} ORDER BY created_at DESC, id DESC
             LIMIT $4 OFFSET $5`, values
        );
        res.json({ items: result.rows, unread: counts.rows[0].unread, pagination: { page, limit, total: counts.rows[0].total, pages: Math.ceil(counts.rows[0].total / limit) } });
    } catch (error) {
        console.error("Échec notifications", error);
        res.status(500).json({ error: "Impossible de charger les notifications." });
    }
});

router.patch("/:id/read", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Notification invalide." });
    const result = await pool.query(`UPDATE notifications SET lu_at = COALESCE(lu_at, NOW()) WHERE id = $4 AND ${visibility} RETURNING *`, [req.user.entreprise_id, req.user.id, req.user.role, id]);
    if (!result.rowCount) return res.status(404).json({ error: "Notification introuvable." });
    res.json(result.rows[0]);
});

router.post("/read-all", async (req, res) => {
    const result = await pool.query(`UPDATE notifications SET lu_at = NOW() WHERE ${visibility} AND lu_at IS NULL`, [req.user.entreprise_id, req.user.id, req.user.role]);
    res.json({ updated: result.rowCount });
});

export default router;
