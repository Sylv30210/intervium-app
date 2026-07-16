import express from "express";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";

const router = express.Router();
router.use(verifyToken, requireRole(["ADMIN"]));

router.get("/", async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(10, Number.parseInt(req.query.limit || "25", 10)));
    const type = typeof req.query.type === "string" ? req.query.type.trim().slice(0, 50) : "";
    const action = typeof req.query.action === "string" ? req.query.action.trim().slice(0, 60) : "";
    const values = [req.user.entreprise_id];
    const filters = ["entreprise_id = $1"];
    if (type) { values.push(type); filters.push(`ressource_type = $${values.length}`); }
    if (action) { values.push(action); filters.push(`action = $${values.length}`); }
    try {
        const count = await pool.query(`SELECT COUNT(*)::INTEGER AS total FROM activites WHERE ${filters.join(" AND ")}`, values);
        values.push(limit, (page - 1) * limit);
        const result = await pool.query(
            `SELECT id, utilisateur_id, utilisateur_nom, utilisateur_role, action,
                    ressource_type, ressource_id, resume, changements, created_at
             FROM activites WHERE ${filters.join(" AND ")}
             ORDER BY created_at DESC, id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
            values
        );
        res.json({ items: result.rows, pagination: { page, limit, total: count.rows[0].total, pages: Math.ceil(count.rows[0].total / limit) } });
    } catch (error) {
        console.error("Échec historique activité", error);
        res.status(500).json({ error: "Impossible de charger l’historique." });
    }
});

export default router;

