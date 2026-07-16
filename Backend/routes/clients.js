import express from "express";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { logActivity } from "../services/activity.js";
import { removeStoredUpload } from "../services/storage.js";

const router = express.Router();
router.use(verifyToken);

function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function optionalText(value, maxLength = 2000) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") return undefined;
    const text = value.trim();
    if (text.length > maxLength) return undefined;
    return text || null;
}

function validEmail(value) {
    return value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function reportEmails(value, fallback = null) {
    if (value === undefined) return fallback;
    if (!Array.isArray(value)) return undefined;
    const emails = [...new Set(value.map((email) => typeof email === "string" ? email.trim().toLowerCase() : "").filter(Boolean))];
    return emails.length <= 20 && emails.every((email) => email.length <= 254 && validEmail(email)) ? emails : undefined;
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

async function accessibleClient(clientId, user) {
    const values = [clientId, user.entreprise_id];
    let accessFilter = "";
    if (user.role === "TECHNICIEN") {
        values.push(user.id);
        accessFilter = `AND EXISTS (
            SELECT 1 FROM interventions i
            WHERE i.client_id = c.id AND i.entreprise_id = c.entreprise_id
              AND i.technicien_id = $3
        )`;
    } else if (user.role === "CLIENT") {
        values.push(user.id);
        accessFilter = "AND c.utilisateur_id = $3";
    }

    const result = await pool.query(
        `SELECT c.id, c.entreprise_id, c.utilisateur_id, c.nom, c.email, c.report_emails,
                c.telephone, c.adresse, c.created_at, c.updated_at,
                u.nom AS utilisateur_nom
         FROM clients c
         LEFT JOIN utilisateurs u
           ON u.id = c.utilisateur_id AND u.entreprise_id = c.entreprise_id
         WHERE c.id = $1 AND c.entreprise_id = $2 ${accessFilter}`,
        values
    );
    return result.rows[0] || null;
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
            `SELECT c.id, c.entreprise_id, c.utilisateur_id, c.nom, c.email, c.report_emails,
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

router.get("/:id", async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant client invalide." });

    const requestedLimit = Number(req.query.limit ?? 25);
    const requestedOffset = Number(req.query.offset ?? 0);
    const limit = Number.isSafeInteger(requestedLimit)
        ? Math.min(50, Math.max(1, requestedLimit))
        : 25;
    const offset = Number.isSafeInteger(requestedOffset)
        ? Math.max(0, requestedOffset)
        : 0;

    try {
        const client = await accessibleClient(id, req.user);
        if (!client) return res.status(404).json({ error: "Client introuvable." });

        const interventionValues = [id, req.user.entreprise_id, limit, offset];
        const technicianFilter = req.user.role === "TECHNICIEN"
            ? `AND i.technicien_id = $5`
            : "";
        if (req.user.role === "TECHNICIEN") interventionValues.push(req.user.id);

        const [equipmentResult, interventionResult, documentResult] = await Promise.all([
            pool.query(
                `SELECT e.id, e.client_id, e.type, e.marque, e.modele, e.numero_serie,
                        e.date_installation, e.annee_installation, e.created_at, e.updated_at,
                        last_i.id AS derniere_intervention_id,
                        last_i.titre AS derniere_intervention_titre,
                        last_i.date_intervention AS derniere_intervention_date,
                        last_i.statut AS derniere_intervention_statut
                 FROM equipements e
                 LEFT JOIN LATERAL (
                    SELECT i.id, i.titre, i.date_intervention, i.statut
                    FROM interventions i
                    WHERE i.equipement_id = e.id
                      AND i.client_id = e.client_id
                      AND i.entreprise_id = e.entreprise_id
                    ORDER BY i.date_intervention DESC NULLS LAST, i.id DESC
                    LIMIT 1
                 ) last_i ON TRUE
                 WHERE e.client_id = $1 AND e.entreprise_id = $2
                 ORDER BY e.type ASC NULLS LAST, e.modele ASC NULLS LAST, e.id ASC`,
                [id, req.user.entreprise_id]
            ),
            pool.query(
                `SELECT i.id, i.titre, i.description, i.compte_rendu, i.statut,
                        i.date_intervention, i.heure, i.created_at,
                        u.nom AS technicien_nom,
                        e.type AS equipement_type, e.modele AS equipement_modele,
                        COUNT(*) OVER()::INTEGER AS total_count
                 FROM interventions i
                 LEFT JOIN utilisateurs u
                   ON u.id = i.technicien_id AND u.entreprise_id = i.entreprise_id
                 LEFT JOIN equipements e
                   ON e.id = i.equipement_id AND e.entreprise_id = i.entreprise_id
                 WHERE i.client_id = $1 AND i.entreprise_id = $2 ${technicianFilter}
                 ORDER BY i.date_intervention DESC NULLS LAST, i.id DESC
                 LIMIT $3 OFFSET $4`,
                interventionValues
            ),
            req.user.role === "ADMIN"
                ? pool.query(
                    `SELECT d.id, d.numero, d.date_emission, d.date_echeance,
                            d.total_ttc, d.devise, d.statut, d.created_at,
                            COUNT(*) OVER()::INTEGER AS total_count
                     FROM documents_commerciaux d
                     WHERE d.client_id = $1 AND d.entreprise_id = $2
                       AND d.type = 'DEVIS'
                     ORDER BY d.date_emission DESC, d.id DESC
                     LIMIT $3 OFFSET $4`,
                    [id, req.user.entreprise_id, limit, offset]
                )
                : Promise.resolve({ rows: [] }),
        ]);

        return res.json({
            client,
            equipements: equipmentResult.rows,
            devis: documentResult.rows,
            interventions: interventionResult.rows,
            pagination: {
                limit,
                offset,
                devis_total: Number(documentResult.rows[0]?.total_count || 0),
                interventions_total: Number(
                    interventionResult.rows[0]?.total_count || 0
                ),
            },
        });
    } catch (error) {
        console.error("Échec du chargement de la fiche client", error);
        return res.status(500).json({ error: "Impossible de charger la fiche client." });
    }
});

router.post("/", requireRole(["ADMIN"]), async (req, res) => {
    const nom = typeof req.body.nom === "string" ? req.body.nom.trim() : "";
    const utilisateurId =
        req.body.utilisateur_id == null ? null : positiveId(req.body.utilisateur_id);

    if (!nom || nom.length > 150) return res.status(400).json({ error: "Le nom du client est requis et limité à 150 caractères." });
    if (req.body.utilisateur_id != null && !utilisateurId) {
        return res.status(400).json({ error: "utilisateur_id invalide." });
    }

    try {
        if (!(await validClientUser(utilisateurId, req.user.entreprise_id))) {
            return res.status(400).json({ error: "Compte client invalide pour cette entreprise." });
        }

        const email = optionalText(req.body.email, 254) ?? null;
        const emails = reportEmails(req.body.report_emails, email ? [email.toLowerCase()] : []);
        const telephone = optionalText(req.body.telephone, 30) ?? null;
        const adresse = optionalText(req.body.adresse, 2000) ?? null;
        if (!validEmail(email) || (req.body.email !== undefined && email === null && String(req.body.email).trim())) return res.status(400).json({ error: "Adresse email invalide ou trop longue." });
        if (emails === undefined) return res.status(400).json({ error: "Liste d’adresses email invalide (20 maximum)." });
        if (req.body.telephone !== undefined && telephone === null && String(req.body.telephone).trim()) return res.status(400).json({ error: "Téléphone invalide ou trop long." });
        if (req.body.adresse !== undefined && adresse === null && String(req.body.adresse).trim()) return res.status(400).json({ error: "Adresse invalide ou trop longue." });

        const result = await pool.query(
            `INSERT INTO clients
                (entreprise_id, utilisateur_id, nom, email, report_emails, telephone, adresse)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
             RETURNING *`,
            [
                req.user.entreprise_id,
                utilisateurId,
                nom,
                email,
                JSON.stringify(emails),
                telephone,
                adresse,
            ]
        );
        await logActivity({ user: req.user, action: "CREATE", resourceType: "client", resourceId: result.rows[0].id, summary: `Client « ${result.rows[0].nom} » créé.` });
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

    const allowed = ["nom", "email", "report_emails", "telephone", "adresse", "utilisateur_id"];
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
            if (!value || value.length > 150) return res.status(400).json({ error: "Le nom doit contenir entre 1 et 150 caractères." });
        } else if (field === "report_emails") {
            value = reportEmails(req.body[field]);
            if (value === undefined) return res.status(400).json({ error: "Liste d’adresses email invalide (20 maximum)." });
            value = JSON.stringify(value);
        } else {
            const limits = { email: 254, telephone: 30, adresse: 2000 };
            value = optionalText(req.body[field], limits[field]);
            if (value === undefined) {
                return res.status(400).json({ error: `Champ ${field} invalide.` });
            }
            if (field === "email" && !validEmail(value)) {
                return res.status(400).json({ error: "Adresse email invalide." });
            }
        }
        values.push(value);
        assignments.push(`${field} = $${values.length}${field === "report_emails" ? "::jsonb" : ""}`);
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
        await logActivity({ user: req.user, action: "UPDATE", resourceType: "client", resourceId: id, summary: `Client « ${result.rows[0].nom} » modifié.` });
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
        await logActivity({ user: req.user, action: "DELETE", resourceType: "client", resourceId: id, summary: `Client ${id} supprimé.`, client });
        await client.query("COMMIT");
        const mediaUrls = mediaResult.rows.flatMap((row) => [row.signature_url, row.photo_url]);
        await Promise.all(mediaUrls.map(removeStoredUpload));
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
