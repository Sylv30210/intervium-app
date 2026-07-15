import express from "express";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";

const router = express.Router();
router.use(verifyToken);

function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function nullableText(value) {
    if (value === null) return null;
    return typeof value === "string" ? value.trim() || null : undefined;
}

async function clientBelongsToTenant(clientId, entrepriseId) {
    const result = await pool.query(
        "SELECT 1 FROM clients WHERE id = $1 AND entreprise_id = $2",
        [clientId, entrepriseId]
    );
    return result.rowCount === 1;
}

router.get("/", async (req, res) => {
    const values = [req.user.entreprise_id];
    let accessFilter = "";
    if (req.user.role === "TECHNICIEN") {
        values.push(req.user.id);
        accessFilter = `AND EXISTS (
            SELECT 1 FROM interventions i
            WHERE i.client_id = e.client_id AND i.entreprise_id = e.entreprise_id
              AND i.technicien_id = $${values.length}
        )`;
    } else if (req.user.role === "CLIENT") {
        values.push(req.user.id);
        accessFilter = `AND c.utilisateur_id = $${values.length}`;
    }

    try {
        const result = await pool.query(
            `SELECT e.id, e.entreprise_id, e.client_id, e.type, e.modele,
                    e.numero_serie, e.date_installation, e.created_at, e.updated_at,
                    c.nom AS client_nom
             FROM equipements e
             JOIN clients c
               ON c.id = e.client_id AND c.entreprise_id = e.entreprise_id
             WHERE e.entreprise_id = $1 ${accessFilter}
             ORDER BY c.nom ASC, e.type ASC NULLS LAST, e.id ASC`,
            values
        );
        return res.json(result.rows);
    } catch (error) {
        console.error("Échec de la liste des équipements", error);
        return res.status(500).json({ error: "Impossible de charger les équipements." });
    }
});

router.post("/", requireRole(["ADMIN"]), async (req, res) => {
    const clientId = positiveId(req.body.client_id);
    if (!clientId) return res.status(400).json({ error: "client_id invalide." });

    try {
        if (!(await clientBelongsToTenant(clientId, req.user.entreprise_id))) {
            return res.status(400).json({ error: "Client invalide pour cette entreprise." });
        }

        const result = await pool.query(
            `INSERT INTO equipements
                (entreprise_id, client_id, type, modele, numero_serie, date_installation)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                req.user.entreprise_id,
                clientId,
                nullableText(req.body.type) ?? null,
                nullableText(req.body.modele) ?? null,
                nullableText(req.body.numero_serie) ?? null,
                req.body.date_installation || null,
            ]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === "22007") return res.status(400).json({ error: "Date invalide." });
        if (error.code === "23505") return res.status(409).json({ error: "Numéro de série déjà utilisé." });
        console.error("Échec de la création de l'équipement", error);
        return res.status(500).json({ error: "Impossible de créer l'équipement." });
    }
});

router.put("/:id", requireRole(["ADMIN"]), async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant équipement invalide." });

    const allowed = ["client_id", "type", "modele", "numero_serie", "date_installation"];
    const supplied = allowed.filter((field) => Object.hasOwn(req.body, field));
    if (supplied.length === 0) return res.status(400).json({ error: "Aucun champ modifiable fourni." });

    const values = [];
    const assignments = [];
    for (const field of supplied) {
        let value;
        if (field === "client_id") {
            value = positiveId(req.body[field]);
            if (!value) return res.status(400).json({ error: "client_id invalide." });
        } else if (field === "date_installation") {
            value = req.body[field] || null;
        } else {
            value = nullableText(req.body[field]);
            if (value === undefined) return res.status(400).json({ error: `Champ ${field} invalide.` });
        }
        values.push(value);
        assignments.push(`${field} = $${values.length}`);
    }

    try {
        if (supplied.includes("client_id")) {
            const clientId = values[supplied.indexOf("client_id")];
            if (!(await clientBelongsToTenant(clientId, req.user.entreprise_id))) {
                return res.status(400).json({ error: "Client invalide pour cette entreprise." });
            }
        }

        values.push(id, req.user.entreprise_id);
        const result = await pool.query(
            `UPDATE equipements
             SET ${assignments.join(", ")}, updated_at = NOW()
             WHERE id = $${values.length - 1} AND entreprise_id = $${values.length}
             RETURNING *`,
            values
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Équipement introuvable." });
        return res.json(result.rows[0]);
    } catch (error) {
        if (error.code === "22007") return res.status(400).json({ error: "Date invalide." });
        if (error.code === "23505") return res.status(409).json({ error: "Numéro de série déjà utilisé." });
        console.error("Échec de la modification de l'équipement", error);
        return res.status(500).json({ error: "Impossible de modifier l'équipement." });
    }
});

router.delete("/:id", requireRole(["ADMIN"]), async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant équipement invalide." });

    try {
        const result = await pool.query(
            "DELETE FROM equipements WHERE id = $1 AND entreprise_id = $2 RETURNING id",
            [id, req.user.entreprise_id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Équipement introuvable." });
        return res.status(204).send();
    } catch (error) {
        console.error("Échec de la suppression de l'équipement", error);
        return res.status(500).json({ error: "Impossible de supprimer l'équipement." });
    }
});

export default router;
