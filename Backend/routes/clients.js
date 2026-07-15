import express from "express";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { removeLocalUpload } from "../services/storage.js";

const router = express.Router();
router.use(verifyToken);

function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function optionalText(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return typeof value === "string" ? value.trim() || null : undefined;
}

async function validClientUser(utilisateurId, entrepriseId) {
    if (utilisateurId === null) return true;
    const result = await pool.query(
        `SELECT 1 FROM utilisateurs
         WHERE id = $1 AND entreprise_id = $2 AND role = 'CLIENT' AND actif = TRUE`,
        [utilisateurId, entrepriseId]
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
            WHERE i.client_id = c.id AND i.entreprise_id = c.entreprise_id
              AND i.technicien_id = $${values.length}
        )`;
    } else if (req.user.role === "CLIENT") {
        values.push(req.user.id);
        accessFilter = `AND c.utilisateur_id = $${values.length}`;
    }

    try {
        const result = await pool.query(
            `SELECT c.id, c.entreprise_id, c.utilisateur_id, c.nom, c.email,
                    c.telephone, c.adresse, c.created_at, c.updated_at,
                    u.nom AS utilisateur_nom
             FROM clients c
             LEFT JOIN utilisateurs u
               ON u.id = c.utilisateur_id AND u.entreprise_id = c.entreprise_id
             WHERE c.entreprise_id = $1 ${accessFilter}
             ORDER BY c.nom ASC, c.id ASC`,
            values
        );
        return res.json(result.rows);
    } catch (error) {
        console.error("Échec de la liste des clients", error);
        return res.status(500).json({ error: "Impossible de charger les clients." });
    }
});

router.post("/", requireRole(["ADMIN"]), async (req, res) => {
    const nom = typeof req.body.nom === "string" ? req.body.nom.trim() : "";
    const utilisateurId =
        req.body.utilisateur_id == null ? null : positiveId(req.body.utilisateur_id);

    if (!nom) return res.status(400).json({ error: "Le nom du client est requis." });
    if (req.body.utilisateur_id != null && !utilisateurId) {
        return res.status(400).json({ error: "utilisateur_id invalide." });
    }

    try {
        if (!(await validClientUser(utilisateurId, req.user.entreprise_id))) {
            return res.status(400).json({ error: "Compte client invalide pour cette entreprise." });
        }

        const result = await pool.query(
            `INSERT INTO clients
                (entreprise_id, utilisateur_id, nom, email, telephone, adresse)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
                req.user.entreprise_id,
                utilisateurId,
                nom,
                optionalText(req.body.email) ?? null,
                optionalText(req.body.telephone) ?? null,
                optionalText(req.body.adresse) ?? null,
            ]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "Ce compte utilisateur est déjà lié à un client." });
        }
        console.error("Échec de la création du client", error);
        return res.status(500).json({ error: "Impossible de créer le client." });
    }
});

router.put("/:id", requireRole(["ADMIN"]), async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant client invalide." });

    const allowed = ["nom", "email", "telephone", "adresse", "utilisateur_id"];
    const supplied = allowed.filter((field) => Object.hasOwn(req.body, field));
    if (supplied.length === 0) {
        return res.status(400).json({ error: "Aucun champ modifiable fourni." });
    }

    const values = [];
    const assignments = [];

    for (const field of supplied) {
        let value;
        if (field === "utilisateur_id") {
            value = req.body[field] === null ? null : positiveId(req.body[field]);
            if (req.body[field] !== null && !value) {
                return res.status(400).json({ error: "utilisateur_id invalide." });
            }
        } else if (field === "nom") {
            value = typeof req.body.nom === "string" ? req.body.nom.trim() : "";
            if (!value) return res.status(400).json({ error: "Le nom ne peut pas être vide." });
        } else {
            value = optionalText(req.body[field]);
            if (value === undefined) {
                return res.status(400).json({ error: `Champ ${field} invalide.` });
            }
        }
        values.push(value);
        assignments.push(`${field} = $${values.length}`);
    }

    try {
        if (supplied.includes("utilisateur_id")) {
            const index = supplied.indexOf("utilisateur_id");
            if (!(await validClientUser(values[index], req.user.entreprise_id))) {
                return res.status(400).json({ error: "Compte client invalide pour cette entreprise." });
            }
        }

        values.push(id, req.user.entreprise_id);
        const result = await pool.query(
            `UPDATE clients
             SET ${assignments.join(", ")}, updated_at = NOW()
             WHERE id = $${values.length - 1} AND entreprise_id = $${values.length}
             RETURNING *`,
            values
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Client introuvable." });
        return res.json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "Ce compte utilisateur est déjà lié à un client." });
        }
        console.error("Échec de la modification du client", error);
        return res.status(500).json({ error: "Impossible de modifier le client." });
    }
});

router.delete("/:id", requireRole(["ADMIN"]), async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant client invalide." });

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");
        const locked = await client.query(
            `SELECT id FROM clients
             WHERE id = $1 AND entreprise_id = $2
             FOR UPDATE`,
            [id, req.user.entreprise_id]
        );
        if (locked.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Client introuvable." });
        }

        const mediaResult = await client.query(
            `SELECT i.signature_url, p.url AS photo_url
             FROM interventions i
             LEFT JOIN photos p
               ON p.intervention_id = i.id AND p.entreprise_id = i.entreprise_id
             WHERE i.client_id = $1 AND i.entreprise_id = $2`,
            [id, req.user.entreprise_id]
        );

        // Le schéma protège l'historique avec RESTRICT : la cascade métier est
        // donc explicite et reste bornée au tenant dans cette transaction.
        await client.query(
            "DELETE FROM interventions WHERE client_id = $1 AND entreprise_id = $2",
            [id, req.user.entreprise_id]
        );
        await client.query(
            "DELETE FROM clients WHERE id = $1 AND entreprise_id = $2",
            [id, req.user.entreprise_id]
        );
        await client.query("COMMIT");
        const mediaUrls = mediaResult.rows.flatMap((row) => [row.signature_url, row.photo_url]);
        await Promise.all(mediaUrls.map(removeLocalUpload));
        return res.status(204).send();
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        console.error("Échec de la suppression du client", error);
        return res.status(500).json({ error: "Impossible de supprimer le client." });
    } finally {
        client?.release();
    }
});

export default router;
