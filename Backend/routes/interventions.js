import express from "express";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { createNotification, logActivity } from "../services/activity.js";
import { generateInterventionPdf } from "../services/pdf.js";
import { removeStoredUpload } from "../services/storage.js";
import { emailDeliveryConfigured, sendReportEmail } from "../services/email.js";

const router = express.Router();
router.use(verifyToken);

const STATUS_ALIASES = new Map([
    ["PLANIFIEE", "PLANIFIEE"],
    ["PLANIFIÉE", "PLANIFIEE"],
    ["EN_COURS", "EN_COURS"],
    ["EN COURS", "EN_COURS"],
    ["TERMINEE", "TERMINEE"],
    ["TERMINÉE", "TERMINEE"],
    ["ANNULEE", "ANNULEE"],
    ["ANNULÉE", "ANNULEE"],
]);

function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizeStatus(value) {
    if (typeof value !== "string") return null;
    return STATUS_ALIASES.get(value.trim().toUpperCase()) ?? null;
}

function nullableText(value) {
    if (value === null) return null;
    return typeof value === "string" ? value.trim() || null : undefined;
}

async function validateRelations(clientId, technicienId, equipementId, entrepriseId) {
    const clientResult = await pool.query(
        "SELECT 1 FROM clients WHERE id = $1 AND entreprise_id = $2",
        [clientId, entrepriseId]
    );
    if (clientResult.rowCount !== 1) return "Client invalide pour cette entreprise.";

    if (equipementId !== null) {
        const equipmentResult = await pool.query(
            `SELECT 1 FROM equipements
             WHERE id = $1 AND client_id = $2 AND entreprise_id = $3`,
            [equipementId, clientId, entrepriseId]
        );
        if (equipmentResult.rowCount !== 1) {
            return "Équipement invalide pour ce client.";
        }
    }

    if (technicienId !== null) {
        const techResult = await pool.query(
            `SELECT 1 FROM utilisateurs
             WHERE id = $1 AND entreprise_id = $2
               AND role = 'TECHNICIEN' AND actif = TRUE`,
            [technicienId, entrepriseId]
        );
        if (techResult.rowCount !== 1) return "Technicien invalide pour cette entreprise.";
    }
    return null;
}

async function getReportTemplate(templateId, entrepriseId) {
    if (templateId === null) return null;
    const result = await pool.query(
        `SELECT id, nom, description, sections, pdf_config FROM modeles_rapport
         WHERE id = $1 AND entreprise_id = $2 AND actif = TRUE`,
        [templateId, entrepriseId]
    );
    return result.rows[0] || null;
}

function reportSnapshot(template) {
    return template ? { nom: template.nom, description: template.description, sections: template.sections, pdf_config: template.pdf_config || {} } : null;
}

function validateTemplateData(template, data) {
    if (!template) return null;
    const dataTypes = new Set(["text", "textarea", "date", "number", "checkbox", "select", "creator", "gps", "address", "table", "price_table"]);
    for (const section of Array.isArray(template.sections) ? template.sections : []) {
        if (!dataTypes.has(section.type)) continue;
        const value = data[section.key];
        const empty = value === undefined || value === null || value === "" ||
            (Array.isArray(value) && value.length === 0);
        if (section.required && (empty || (section.type === "checkbox" && !(section.options || []).length && value !== true))) {
            return `Le champ « ${section.label} » est requis.`;
        }
        if (section.type === "select" && value && !(section.options || []).includes(value)) {
            return `Valeur invalide pour « ${section.label} ».`;
        }
        if (section.type === "checkbox" && Array.isArray(value)) {
            if (value.some((entry) => !(section.options || []).includes(entry))) {
                return `Valeur invalide pour « ${section.label} ».`;
            }
        }
        if (section.type === "number" && !empty) {
            const number = Number(value);
            if (!Number.isFinite(number)) return `Nombre invalide pour « ${section.label} ».`;
            if (section.min !== null && section.min !== undefined && number < Number(section.min)) {
                return `« ${section.label} » doit être supérieur ou égal à ${section.min}.`;
            }
            if (section.max !== null && section.max !== undefined && number > Number(section.max)) {
                return `« ${section.label} » doit être inférieur ou égal à ${section.max}.`;
            }
        }
        if (["table", "price_table"].includes(section.type) && !empty) {
            if (!Array.isArray(value)) return `Le tableau « ${section.label} » est invalide.`;
            const minRows = Math.max(0, Number(section.minRows) || 0);
            const maxRows = Math.min(100, Math.max(minRows || 1, Number(section.maxRows) || 30));
            if (value.length < minRows || value.length > maxRows) return `Le tableau « ${section.label} » doit contenir entre ${minRows} et ${maxRows} ligne(s).`;
            const columns = (section.columns || []).map((column, index) => typeof column === "string" ? { key: `c${index}`, label: column, type: "text" } : column);
            for (const [rowIndex, row] of value.entries()) {
                if (!row || typeof row !== "object" || Array.isArray(row)) return `Ligne ${rowIndex + 1} invalide dans « ${section.label} ».`;
                for (const column of columns) {
                    if (column.visibleForm === false || column.type === "photo") continue;
                    const cell = row[column.key];
                    const cellEmpty = cell === undefined || cell === null || cell === "";
                    if (column.required && cellEmpty) return `« ${column.label} » est requis à la ligne ${rowIndex + 1}.`;
                    if (cellEmpty) continue;
                    if (["integer", "decimal", "currency", "percentage", "calculated"].includes(column.type)) {
                        const number = Number(cell);
                        if (!Number.isFinite(number) || (column.type === "integer" && !Number.isInteger(number))) return `Valeur numérique invalide pour « ${column.label} ».`;
                        if (column.type === "percentage" && (number < 0 || number > 100)) return `« ${column.label} » doit être compris entre 0 et 100.`;
                        if (column.min != null && number < Number(column.min)) return `« ${column.label} » est inférieur au minimum autorisé.`;
                        if (column.max != null && number > Number(column.max)) return `« ${column.label} » dépasse le maximum autorisé.`;
                    }
                    if (column.type === "select" && !column.allowOther && !(column.options || []).includes(cell)) return `Choix invalide pour « ${column.label} ».`;
                    if (["boolean", "checkbox"].includes(column.type) && typeof cell !== "boolean") return `Valeur oui/non invalide pour « ${column.label} ».`;
                }
            }
        }
    }
    return null;
}

function safeReportValue(value, depth = 0) {
    if (depth > 3 || value === undefined) return false;
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
    if (Array.isArray(value)) {
        return value.length <= 100 && value.every((entry) => safeReportValue(entry, depth + 1));
    }
    if (typeof value === "object") {
        const entries = Object.entries(value);
        return entries.length <= 20 && entries.every(([key, entry]) =>
            key.length <= 60 && safeReportValue(entry, depth + 1)
        );
    }
    return false;
}

function reportData(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const entries = Object.entries(value);
    if (entries.length > 80) return null;
    const valid = entries.every(([key, entry]) => key.length <= 60 && safeReportValue(entry));
    if (!valid || JSON.stringify(value).length > 100000) return null;
    return value;
}

router.get("/", async (req, res) => {
    const values = [req.user.entreprise_id];
    let roleFilter = "";

    if (req.user.role === "TECHNICIEN") {
        values.push(req.user.id);
        roleFilter = `AND i.technicien_id = $${values.length}`;
    } else if (req.user.role === "CLIENT") {
        values.push(req.user.id);
        roleFilter = `AND c.utilisateur_id = $${values.length}`;
    }

    try {
        const result = await pool.query(
            `SELECT i.id, i.entreprise_id, i.client_id, i.equipement_id, i.technicien_id,
                    i.titre, i.description, i.compte_rendu, i.statut,
                    i.date_intervention, i.heure, i.signature_url,
                    i.modele_rapport_id, i.donnees_rapport, i.modele_rapport_snapshot,
                    i.report_version,
                    i.created_at, i.updated_at,
                    c.nom AS client_nom,
                    eq.type AS equipement_type, eq.marque AS equipement_marque,
                    eq.modele AS equipement_modele,
                    eq.numero_serie AS equipement_numero_serie,
                    u.nom AS technicien_nom,
                    COALESCE(m.nom, i.modele_rapport_snapshot->>'nom') AS modele_rapport_nom,
                    COALESCE(m.sections, i.modele_rapport_snapshot->'sections') AS modele_rapport_sections,
                    COALESCE(m.pdf_config, i.modele_rapport_snapshot->'pdf_config', '{}'::jsonb) AS modele_pdf_config,
                    COALESCE(p.photos, '[]'::json) AS photos,
                    COALESCE(p.nombre_photos, 0)::INTEGER AS nombre_photos
             FROM interventions i
             JOIN clients c
               ON c.id = i.client_id AND c.entreprise_id = i.entreprise_id
             LEFT JOIN equipements eq
               ON eq.id = i.equipement_id AND eq.client_id = i.client_id
              AND eq.entreprise_id = i.entreprise_id
             LEFT JOIN utilisateurs u
               ON u.id = i.technicien_id AND u.entreprise_id = i.entreprise_id
             LEFT JOIN modeles_rapport m
               ON m.id = i.modele_rapport_id AND m.entreprise_id = i.entreprise_id
             LEFT JOIN (
                 SELECT entreprise_id, intervention_id,
                        COUNT(*) AS nombre_photos,
                        JSON_AGG(JSON_BUILD_OBJECT('id', id, 'url', url, 'rotation', rotation) ORDER BY created_at ASC) AS photos
                 FROM photos
                 GROUP BY entreprise_id, intervention_id
             ) p ON p.intervention_id = i.id AND p.entreprise_id = i.entreprise_id
             WHERE i.entreprise_id = $1 ${roleFilter}
             ORDER BY i.date_intervention ASC NULLS LAST,
                      i.heure ASC NULLS LAST, i.id ASC`,
            values
        );
        return res.json(result.rows);
    } catch (error) {
        console.error("Échec de la liste des interventions", error);
        return res.status(500).json({ error: "Impossible de charger les interventions." });
    }
});

router.get("/options", requireRole(["ADMIN", "TECHNICIEN"]), async (req, res) => {
    try {
        const [clientResult, equipmentResult] = await Promise.all([
            pool.query(
                `SELECT id, nom FROM clients
                 WHERE entreprise_id = $1 ORDER BY nom ASC, id ASC`,
                [req.user.entreprise_id]
            ),
            pool.query(
                `SELECT id, client_id, type, modele, numero_serie
                 FROM equipements
                 WHERE entreprise_id = $1
                 ORDER BY type ASC NULLS LAST, modele ASC NULLS LAST, id ASC`,
                [req.user.entreprise_id]
            ),
        ]);
        return res.json({ clients: clientResult.rows, equipements: equipmentResult.rows });
    } catch (error) {
        console.error("Échec des options d'intervention", error);
        return res.status(500).json({ error: "Impossible de charger les options." });
    }
});

router.post("/", requireRole(["ADMIN", "TECHNICIEN"]), async (req, res) => {
    const clientId = positiveId(req.body.client_id);
    const equipementId = positiveId(req.body.equipement_id);
    const technicienId = req.user.role === "TECHNICIEN"
        ? req.user.id
        : req.body.technicien_id == null ? null : positiveId(req.body.technicien_id);
    const titre = typeof req.body.titre === "string" ? req.body.titre.trim() : "";
    const statut = req.body.statut === undefined ? "PLANIFIEE" : normalizeStatus(req.body.statut);
    const modeleRapportId = req.body.modele_rapport_id == null ? null : positiveId(req.body.modele_rapport_id);
    const donneesRapport = req.body.donnees_rapport == null ? {} : reportData(req.body.donnees_rapport);

    if (!clientId) return res.status(400).json({ error: "client_id invalide." });
    if (!equipementId) return res.status(400).json({ error: "equipement_id invalide." });
    if (req.user.role === "ADMIN" && req.body.technicien_id != null && !technicienId) {
        return res.status(400).json({ error: "technicien_id invalide." });
    }
    if (!titre) return res.status(400).json({ error: "Le titre est requis." });
    if (!statut) return res.status(400).json({ error: "Statut invalide." });
    if (req.body.modele_rapport_id != null && !modeleRapportId) return res.status(400).json({ error: "Modèle de rapport invalide." });
    if (!donneesRapport) return res.status(400).json({ error: "Données de rapport invalides." });

    try {
        const relationError = await validateRelations(
            clientId,
            technicienId,
            equipementId,
            req.user.entreprise_id
        );
        if (relationError) return res.status(400).json({ error: relationError });
        const template = await getReportTemplate(modeleRapportId, req.user.entreprise_id);
        if (modeleRapportId && !template) {
            return res.status(400).json({ error: "Modèle de rapport invalide pour cette entreprise." });
        }
        const templateDataError = validateTemplateData(template, donneesRapport);
        if (templateDataError) return res.status(400).json({ error: templateDataError });

        const result = await pool.query(
            `INSERT INTO interventions
                (entreprise_id, client_id, equipement_id, technicien_id, titre, description,
                 compte_rendu, statut, date_intervention, heure, modele_rapport_id,
                 donnees_rapport, modele_rapport_snapshot)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb)
             RETURNING *`,
            [
                req.user.entreprise_id,
                clientId,
                equipementId,
                technicienId,
                titre,
                nullableText(req.body.description) ?? null,
                nullableText(req.body.compte_rendu) ?? null,
                statut,
                req.body.date_intervention || null,
                req.body.heure || null,
                modeleRapportId,
                JSON.stringify(donneesRapport),
                template ? JSON.stringify(reportSnapshot(template)) : null,
            ]
        );
        await logActivity({ user: req.user, action: "CREATE", resourceType: "intervention", resourceId: result.rows[0].id, summary: `Intervention « ${result.rows[0].titre} » créée.` });
        if (result.rows[0].technicien_id && Number(result.rows[0].technicien_id) !== Number(req.user.id)) {
            await createNotification({ entrepriseId: req.user.entreprise_id, userId: result.rows[0].technicien_id, type: "INTERVENTION_ASSIGNED", title: "Nouvelle intervention", message: `L’intervention « ${result.rows[0].titre} » vous a été assignée.`, resourceType: "intervention", resourceId: result.rows[0].id });
        }
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (["22007", "22008"].includes(error.code)) {
            return res.status(400).json({ error: "Date ou heure invalide." });
        }
        console.error("Échec de la création de l'intervention", error);
        return res.status(500).json({ error: "Impossible de créer l'intervention." });
    }
});

router.get("/:id/pdf", async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant intervention invalide." });

    const requestedPhotoIds = req.query.photo_ids === undefined
        ? null
        : String(req.query.photo_ids).split(",").filter(Boolean).map(positiveId);
    if (requestedPhotoIds?.some((photoId) => !photoId)) {
        return res.status(400).json({ error: "Sélection de photos invalide." });
    }

    try {
        const result = await pool.query(
            `SELECT i.*, e.nom AS entreprise_nom,
                    e.logo_url AS entreprise_logo_url,
                    e.report_settings AS entreprise_report_settings,
                    c.nom AS client_nom, c.adresse AS client_adresse,
                    c.utilisateur_id AS client_utilisateur_id,
                    u.nom AS technicien_nom,
                    COALESCE(m.nom, i.modele_rapport_snapshot->>'nom') AS modele_rapport_nom,
                    COALESCE(m.sections, i.modele_rapport_snapshot->'sections') AS modele_rapport_sections,
                    COALESCE(m.pdf_config, i.modele_rapport_snapshot->'pdf_config', '{}'::jsonb) AS modele_pdf_config
             FROM interventions i
             JOIN entreprises e ON e.id = i.entreprise_id
             JOIN clients c ON c.id = i.client_id AND c.entreprise_id = i.entreprise_id
             LEFT JOIN utilisateurs u
               ON u.id = i.technicien_id AND u.entreprise_id = i.entreprise_id
             LEFT JOIN modeles_rapport m
               ON m.id = i.modele_rapport_id AND m.entreprise_id = i.entreprise_id
             WHERE i.id = $1 AND i.entreprise_id = $2`,
            [id, req.user.entreprise_id]
        );
        const intervention = result.rows[0];

        const allowed = intervention && (
            req.user.role === "ADMIN" ||
            (req.user.role === "TECHNICIEN" && Number(intervention.technicien_id) === Number(req.user.id)) ||
            (req.user.role === "CLIENT" && Number(intervention.client_utilisateur_id) === Number(req.user.id))
        );
        if (!allowed) return res.status(404).json({ error: "Intervention introuvable." });

        const [equipmentResult, photoResult] = await Promise.all([
            pool.query(
                `SELECT type, marque, modele, numero_serie, annee_installation
                 FROM equipements
                 WHERE id = $1 AND client_id = $2 AND entreprise_id = $3
                 ORDER BY id ASC`,
                [intervention.equipement_id, intervention.client_id, req.user.entreprise_id]
            ),
            pool.query(
                `SELECT id, url, rotation FROM photos
                 WHERE intervention_id = $1 AND entreprise_id = $2
                 ORDER BY created_at ASC, id ASC`,
                [id, req.user.entreprise_id]
            ),
        ]);

        const availablePhotos = photoResult.rows;
        const selectedPhotos = requestedPhotoIds === null
            ? availablePhotos
            : availablePhotos.filter((photo) => requestedPhotoIds.includes(Number(photo.id)));
        if (requestedPhotoIds && selectedPhotos.length !== new Set(requestedPhotoIds).size) {
            return res.status(400).json({ error: "Une photo sélectionnée n’appartient pas à ce rapport." });
        }

        const pdf = await generateInterventionPdf({
            intervention,
            equipments: equipmentResult.rows,
            photos: selectedPhotos,
        });
        const filename = `rapport-intervention-${id}.pdf`;
        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": pdf.length,
            "Cache-Control": "private, no-store",
        });
        return res.send(pdf);
    } catch (error) {
        console.error("Échec de la génération PDF", error);
        return res.status(500).json({ error: "Impossible de générer le rapport PDF." });
    }
});

router.post("/:id/email", requireRole(["ADMIN", "TECHNICIEN"]), async (req, res) => {
    const id = positiveId(req.params.id);
    const recipients = Array.isArray(req.body.recipients)
        ? [...new Set(req.body.recipients.map((email) => typeof email === "string" ? email.trim().toLowerCase() : "").filter(Boolean))]
        : [];
    if (!id || !recipients.length || recipients.length > 20 || recipients.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return res.status(400).json({ error: "Sélection de destinataires invalide." });
    }
    if (!emailDeliveryConfigured()) return res.status(503).json({ error: "L’envoi d’e-mails n’est pas encore configuré sur le serveur." });
    try {
        const result = await pool.query(
            `SELECT i.*, e.nom AS entreprise_nom, e.logo_url AS entreprise_logo_url,
                    e.report_settings AS entreprise_report_settings,
                    c.nom AS client_nom, c.adresse AS client_adresse, c.report_emails,
                    u.nom AS technicien_nom,
                    COALESCE(m.nom, i.modele_rapport_snapshot->>'nom') AS modele_rapport_nom,
                    COALESCE(m.sections, i.modele_rapport_snapshot->'sections') AS modele_rapport_sections,
                    COALESCE(m.pdf_config, i.modele_rapport_snapshot->'pdf_config', '{}'::jsonb) AS modele_pdf_config
             FROM interventions i
             JOIN entreprises e ON e.id = i.entreprise_id
             JOIN clients c ON c.id = i.client_id AND c.entreprise_id = i.entreprise_id
             LEFT JOIN utilisateurs u ON u.id = i.technicien_id AND u.entreprise_id = i.entreprise_id
             LEFT JOIN modeles_rapport m ON m.id = i.modele_rapport_id AND m.entreprise_id = i.entreprise_id
             WHERE i.id = $1 AND i.entreprise_id = $2
               AND ($3 = 'ADMIN' OR i.technicien_id = $4)`,
            [id, req.user.entreprise_id, req.user.role, req.user.id]
        );
        const intervention = result.rows[0];
        if (!intervention) return res.status(404).json({ error: "Rapport introuvable." });
        const allowedEmails = new Set([...(intervention.report_emails || []), ...(Array.isArray(req.body.free_recipients) ? req.body.free_recipients : [])].map((email) => String(email).trim().toLowerCase()));
        if (recipients.some((email) => !allowedEmails.has(email))) return res.status(400).json({ error: "Un destinataire n’est ni enregistré ni confirmé comme adresse libre." });
        const [equipmentResult, photoResult] = await Promise.all([
            pool.query("SELECT type, marque, modele, numero_serie, annee_installation FROM equipements WHERE id = $1 AND client_id = $2 AND entreprise_id = $3", [intervention.equipement_id, intervention.client_id, req.user.entreprise_id]),
            pool.query("SELECT id, url, rotation FROM photos WHERE intervention_id = $1 AND entreprise_id = $2 ORDER BY created_at ASC, id ASC", [id, req.user.entreprise_id]),
        ]);
        const selectedIds = Array.isArray(req.body.photo_ids) ? req.body.photo_ids.map(Number) : null;
        const photos = selectedIds ? photoResult.rows.filter((photo) => selectedIds.includes(Number(photo.id))) : photoResult.rows;
        const pdf = await generateInterventionPdf({ intervention, equipments: equipmentResult.rows, photos });
        const settings = intervention.entreprise_report_settings || {};
        await sendReportEmail({
            to: recipients,
            subject: req.body.subject?.trim() || `Rapport ${intervention.titre}`,
            text: req.body.message?.trim() || `Bonjour,\n\nVeuillez trouver ci-joint le rapport « ${intervention.titre} ».\n\nCordialement,\n${settings.display_name || intervention.entreprise_nom}`,
            pdf,
            filename: `rapport-${id}.pdf`,
            companyName: settings.display_name || intervention.entreprise_nom,
            companyEmail: settings.email || null,
        });
        await logActivity({ user: req.user, action: "SEND", resourceType: "intervention", resourceId: id, summary: `Rapport envoyé à ${recipients.length} destinataire(s).` });
        return res.json({ sent: true, recipients });
    } catch (error) {
        console.error("Échec de l’envoi du rapport", error);
        return res.status(502).json({ error: "Impossible d’envoyer le rapport par e-mail." });
    }
});

router.put("/:id", async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant intervention invalide." });
    if (req.user.role === "CLIENT") return res.status(403).json({ error: "Droits insuffisants." });

    const adminFields = [
        "client_id", "equipement_id", "technicien_id", "titre", "description", "compte_rendu",
        "statut", "date_intervention", "heure", "modele_rapport_id", "donnees_rapport",
    ];
    const technicianFields = ["statut", "compte_rendu", "donnees_rapport"];
    const allowed = req.user.role === "ADMIN" ? adminFields : technicianFields;
    const expectedVersion = req.body.expected_version === undefined ? null : Number(req.body.expected_version);
    if (expectedVersion !== null && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1)) {
        return res.status(400).json({ error: "Version de rapport invalide." });
    }
    const received = Object.keys(req.body).filter((field) => field !== "expected_version");
    const forbidden = received.filter((field) => !allowed.includes(field));
    if (forbidden.length > 0) {
        return res.status(403).json({ error: `Modification interdite : ${forbidden.join(", ")}.` });
    }

    const supplied = allowed.filter((field) => Object.hasOwn(req.body, field));
    if (supplied.length === 0) return res.status(400).json({ error: "Aucun champ modifiable fourni." });

    const values = [];
    const assignments = [];
    for (const field of supplied) {
        let value;
        if (field === "client_id") {
            value = positiveId(req.body[field]);
            if (!value) return res.status(400).json({ error: "client_id invalide." });
        } else if (field === "equipement_id") {
            value = req.body[field] === null ? null : positiveId(req.body[field]);
            if (req.body[field] !== null && !value) {
                return res.status(400).json({ error: "equipement_id invalide." });
            }
        } else if (field === "technicien_id") {
            value = req.body[field] === null ? null : positiveId(req.body[field]);
            if (req.body[field] !== null && !value) {
                return res.status(400).json({ error: "technicien_id invalide." });
            }
        } else if (field === "modele_rapport_id") {
            value = req.body[field] === null ? null : positiveId(req.body[field]);
            if (req.body[field] !== null && !value) return res.status(400).json({ error: "Modèle de rapport invalide." });
        } else if (field === "donnees_rapport") {
            value = reportData(req.body[field]);
            if (!value) return res.status(400).json({ error: "Données de rapport invalides." });
        } else if (field === "titre") {
            value = typeof req.body.titre === "string" ? req.body.titre.trim() : "";
            if (!value) return res.status(400).json({ error: "Le titre ne peut pas être vide." });
        } else if (field === "statut") {
            value = normalizeStatus(req.body.statut);
            if (!value) return res.status(400).json({ error: "Statut invalide." });
        } else if (["date_intervention", "heure"].includes(field)) {
            value = req.body[field] || null;
        } else {
            value = nullableText(req.body[field]);
            if (value === undefined) return res.status(400).json({ error: `Champ ${field} invalide.` });
        }
        values.push(value);
        assignments.push(`${field} = $${values.length}${field === "donnees_rapport" ? "::jsonb" : ""}`);
    }

    try {
        let selectedTemplate = null;
        if (req.user.role === "ADMIN") {
            const current = await pool.query(
                `SELECT client_id, equipement_id, technicien_id FROM interventions
                 WHERE id = $1 AND entreprise_id = $2`,
                [id, req.user.entreprise_id]
            );
            if (current.rowCount === 0) return res.status(404).json({ error: "Intervention introuvable." });

            const clientId = supplied.includes("client_id")
                ? values[supplied.indexOf("client_id")]
                : Number(current.rows[0].client_id);
            const technicienId = supplied.includes("technicien_id")
                ? values[supplied.indexOf("technicien_id")]
                : current.rows[0].technicien_id === null
                  ? null
                  : Number(current.rows[0].technicien_id);
            const equipementId = supplied.includes("equipement_id")
                ? values[supplied.indexOf("equipement_id")]
                : current.rows[0].equipement_id === null
                  ? null
                  : Number(current.rows[0].equipement_id);
            const relationError = await validateRelations(clientId, technicienId, equipementId, req.user.entreprise_id);
            if (relationError) return res.status(400).json({ error: relationError });
        }
        if (supplied.includes("modele_rapport_id")) {
            const templateId = values[supplied.indexOf("modele_rapport_id")];
            selectedTemplate = await getReportTemplate(templateId, req.user.entreprise_id);
            if (templateId && !selectedTemplate) {
                return res.status(400).json({ error: "Modèle de rapport invalide pour cette entreprise." });
            }
            values.push(selectedTemplate ? JSON.stringify(reportSnapshot(selectedTemplate)) : null);
            assignments.push(`modele_rapport_snapshot = $${values.length}::jsonb`);
        }
        if (supplied.includes("donnees_rapport")) {
            if (!supplied.includes("modele_rapport_id")) {
                const templateResult = await pool.query(
                    `SELECT COALESCE(m.sections, i.modele_rapport_snapshot->'sections') AS sections
                     FROM interventions i
                     LEFT JOIN modeles_rapport m
                       ON m.id = i.modele_rapport_id AND m.entreprise_id = i.entreprise_id
                     WHERE i.id = $1 AND i.entreprise_id = $2`,
                    [id, req.user.entreprise_id]
                );
                if (!templateResult.rowCount) return res.status(404).json({ error: "Intervention introuvable." });
                selectedTemplate = templateResult.rows[0].sections
                    ? { sections: templateResult.rows[0].sections }
                    : null;
            }
            const dataError = validateTemplateData(
                selectedTemplate,
                values[supplied.indexOf("donnees_rapport")]
            );
            if (dataError) return res.status(400).json({ error: dataError });
        }

        assignments.push("report_version = report_version + 1");
        values.push(id);
        const idParameter = values.length;
        values.push(req.user.entreprise_id);
        const tenantParameter = values.length;
        let ownershipClause = "";
        if (req.user.role === "TECHNICIEN") {
            values.push(req.user.id);
            ownershipClause = `AND technicien_id = $${values.length}`;
        }
        let versionClause = "";
        if (expectedVersion !== null) {
            values.push(expectedVersion);
            versionClause = `AND report_version = $${values.length}`;
        }

        const result = await pool.query(
            `UPDATE interventions
             SET ${assignments.join(", ")}, updated_at = NOW()
             WHERE id = $${idParameter}
               AND entreprise_id = $${tenantParameter}
               ${ownershipClause} ${versionClause}
             RETURNING *`,
            values
        );
        if (result.rowCount === 0 && expectedVersion !== null) return res.status(409).json({ error: "Ce rapport a été modifié ailleurs. Rechargez-le avant de poursuivre.", code: "REPORT_VERSION_CONFLICT" });
        if (result.rowCount === 0) return res.status(404).json({ error: "Intervention introuvable." });
        await logActivity({ user: req.user, action: "UPDATE", resourceType: "intervention", resourceId: id, summary: `Intervention « ${result.rows[0].titre} » modifiée.`, changes: { fields: supplied } });
        if (result.rows[0].technicien_id && Number(result.rows[0].technicien_id) !== Number(req.user.id)) {
            await createNotification({ entrepriseId: req.user.entreprise_id, userId: result.rows[0].technicien_id, type: "INTERVENTION_UPDATED", title: "Intervention modifiée", message: `L’intervention « ${result.rows[0].titre} » a été mise à jour.`, resourceType: "intervention", resourceId: id });
        }
        return res.json(result.rows[0]);
    } catch (error) {
        if (["22007", "22008"].includes(error.code)) {
            return res.status(400).json({ error: "Date ou heure invalide." });
        }
        console.error("Échec de la modification de l'intervention", error);
        return res.status(500).json({ error: "Impossible de modifier l'intervention." });
    }
});

router.delete("/:id", requireRole(["ADMIN"]), async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant intervention invalide." });

    let client;
    try {
        client = await pool.connect();
        await client.query("BEGIN");
        const mediaResult = await client.query(
            `SELECT i.signature_url, p.url AS photo_url
             FROM interventions i
             LEFT JOIN photos p
               ON p.intervention_id = i.id AND p.entreprise_id = i.entreprise_id
             WHERE i.id = $1 AND i.entreprise_id = $2
             FOR UPDATE OF i`,
            [id, req.user.entreprise_id]
        );
        if (mediaResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Intervention introuvable." });
        }
        await client.query(
            "DELETE FROM interventions WHERE id = $1 AND entreprise_id = $2",
            [id, req.user.entreprise_id]
        );
        await client.query("COMMIT");

        const mediaUrls = mediaResult.rows.flatMap((row) => [row.signature_url, row.photo_url]);
        await Promise.all(mediaUrls.map(removeStoredUpload));
        return res.status(204).send();
    } catch (error) {
        if (client) await client.query("ROLLBACK");
        console.error("Échec de la suppression de l'intervention", error);
        return res.status(500).json({ error: "Impossible de supprimer l'intervention." });
    } finally {
        client?.release();
    }
});

export default router;
