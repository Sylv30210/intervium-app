import express from "express";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { logActivity } from "../services/activity.js";
import { paginatedResponse, paginationFromRequest } from "../utils/pagination.js";

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

function installationYear(value) {
    if (value === null || value === "" || value === undefined) return null;
    const year = Number(value);
    return Number.isSafeInteger(year) && year >= 1900 && year <= 2200 ? year : undefined;
}

async function clientBelongsToTenant(clientId, entrepriseId) {
    const result = await pool.query(
        "SELECT 1 FROM clients WHERE id = $1 AND entreprise_id = $2",
        [clientId, entrepriseId]
    );
    return result.rowCount === 1;
}

router.get("/", async (req, res) => {
    const pagination = paginationFromRequest(req);
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
        if (pagination?.q) {
            values.push(`%${pagination.q}%`);
            accessFilter += ` AND (c.nom ILIKE $${values.length} OR e.type ILIKE $${values.length} OR e.marque ILIKE $${values.length} OR e.modele ILIKE $${values.length} OR e.numero_serie ILIKE $${values.length})`;
        }
        const countValues = [...values];
        const countResult = pagination ? await pool.query(`SELECT COUNT(*)::INTEGER AS total FROM equipements e JOIN clients c ON c.id=e.client_id AND c.entreprise_id=e.entreprise_id WHERE e.entreprise_id=$1 ${accessFilter}`, countValues) : null;
        let paginationSql = "";
        if (pagination) {
            values.push(pagination.limit, pagination.offset);
            paginationSql = ` LIMIT $${values.length - 1} OFFSET $${values.length}`;
        }
        const result = await pool.query(
            `SELECT e.id, e.entreprise_id, e.client_id, e.type, e.marque, e.modele,
                    e.numero_serie, e.date_installation, e.annee_installation, e.created_at, e.updated_at,
                    c.nom AS client_nom
             FROM equipements e
             JOIN clients c
               ON c.id = e.client_id AND c.entreprise_id = e.entreprise_id
             WHERE e.entreprise_id = $1 ${accessFilter}
             ORDER BY c.nom ASC, e.type ASC NULLS LAST, e.id ASC ${paginationSql}`,
            values
        );
        return res.json(pagination ? paginatedResponse(result.rows, countResult.rows[0].total, pagination) : result.rows);
    } catch (error) {
        console.error("Échec de la liste des matériels", error);
        return res.status(500).json({ error: "Impossible de charger les matériels." });
    }
});

router.post("/", requireRole(["ADMIN"]), async (req, res) => {
    const clientId = positiveId(req.body.client_id);
    if (!clientId) return res.status(400).json({ error: "client_id invalide." });
    const year = installationYear(req.body.annee_installation);
    if (year === undefined) return res.status(400).json({ error: "Année d’installation invalide." });

    try {
        if (!(await clientBelongsToTenant(clientId, req.user.entreprise_id))) {
            return res.status(400).json({ error: "Client invalide pour cette entreprise." });
        }

        const result = await pool.query(
            `INSERT INTO equipements
                (entreprise_id, client_id, type, marque, modele, numero_serie, annee_installation)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                req.user.entreprise_id,
                clientId,
                nullableText(req.body.type) ?? null,
                nullableText(req.body.marque) ?? null,
                nullableText(req.body.modele) ?? null,
                nullableText(req.body.numero_serie) ?? null,
                year,
            ]
        );
        await logActivity({ user: req.user, action: "CREATE", resourceType: "equipement", resourceId: result.rows[0].id, summary: `Matériel ${result.rows[0].type || result.rows[0].id} créé.` });
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23514") return res.status(400).json({ error: "Année d’installation invalide." });
        if (error.code === "23505") return res.status(409).json({ error: "Numéro de série déjà utilisé." });
        console.error("Échec de la création de l'équipement", error);
        return res.status(500).json({ error: "Impossible de créer le matériel." });
    }
});

router.put("/:id", requireRole(["ADMIN"]), async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant matériel invalide." });

    const allowed = ["client_id", "type", "marque", "modele", "numero_serie", "annee_installation"];
    const supplied = allowed.filter((field) => Object.hasOwn(req.body, field));
    if (supplied.length === 0) return res.status(400).json({ error: "Aucun champ modifiable fourni." });

    const values = [];
    const assignments = [];
    for (const field of supplied) {
        let value;
        if (field === "client_id") {
            value = positiveId(req.body[field]);
            if (!value) return res.status(400).json({ error: "client_id invalide." });
        } else if (field === "annee_installation") {
            value = installationYear(req.body[field]);
            if (value === undefined) return res.status(400).json({ error: "Année d’installation invalide." });
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
        if (result.rowCount === 0) return res.status(404).json({ error: "Matériel introuvable." });
        await logActivity({ user: req.user, action: "UPDATE", resourceType: "equipement", resourceId: id, summary: `Matériel ${result.rows[0].type || id} modifié.` });
        return res.json(result.rows[0]);
    } catch (error) {
        if (error.code === "23514") return res.status(400).json({ error: "Année d’installation invalide." });
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
        await logActivity({ user: req.user, action: "DELETE", resourceType: "equipement", resourceId: id, summary: `Équipement ${id} supprimé.` });
        return res.status(204).send();
    } catch (error) {
        console.error("Échec de la suppression de l'équipement", error);
        return res.status(500).json({ error: "Impossible de supprimer l'équipement." });
    }
});

export default router;
