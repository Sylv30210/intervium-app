import express from "express";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { logActivity } from "../services/activity.js";

const router = express.Router();
router.use(verifyToken);

const SECTION_TYPES = new Set([
    "title", "text", "textarea", "date", "number", "checkbox", "select",
    "equipment", "photo", "multi_photo", "event_photos", "signature",
    "electronic_signature", "creator", "gps", "address", "table", "price_table", "page_break",
]);

function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function optionalText(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalNumber(value, fallback = null) {
    if (value === "" || value === null || value === undefined) return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function validateSections(value) {
    if (!Array.isArray(value) || value.length > 80) return null;
    const keys = new Set();
    const sections = [];
    for (let index = 0; index < value.length; index += 1) {
        const source = value[index];
        if (!source || typeof source !== "object" || !SECTION_TYPES.has(source.type)) return null;
        const label = typeof source.label === "string" ? source.label.trim().slice(0, 150) : "";
        const key = typeof source.key === "string"
            ? source.key.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60)
            : `champ_${index + 1}`;
        if (!key || keys.has(key)) return null;
        keys.add(key);
        const options = ["select", "checkbox"].includes(source.type) && Array.isArray(source.options)
            ? source.options.map((option) => String(option).trim()).filter(Boolean).slice(0, 30)
            : [];
        const columns = ["table", "price_table"].includes(source.type) && Array.isArray(source.columns)
            ? source.columns.map((column) => String(column).trim()).filter(Boolean).slice(0, 8)
            : [];
        const min = optionalNumber(source.min);
        const max = optionalNumber(source.max);
        if (min !== null && max !== null && min > max) return null;
        sections.push({
            key,
            type: source.type,
            label: label || (source.type === "page_break" ? "Saut de page" : `Champ ${index + 1}`),
            required: Boolean(source.required),
            options,
            columns: columns.length ? columns : (source.type === "price_table"
                ? ["Désignation", "Quantité", "Prix HT", "TVA %"]
                : source.type === "table" ? ["Colonne 1", "Colonne 2"] : []),
            placeholder: optionalText(source.placeholder, 180),
            helpText: optionalText(source.helpText, 300),
            defaultValue: ["text", "textarea", "date", "number", "select", "address"].includes(source.type)
                ? optionalText(source.defaultValue, 500)
                : "",
            width: source.width === "half" ? "half" : "full",
            rows: Math.min(12, Math.max(2, Math.round(optionalNumber(source.rows, 4)))),
            min,
            max,
            step: Math.max(0.001, optionalNumber(source.step, 1)),
            unit: optionalText(source.unit, 30),
            dateMode: source.dateMode === "datetime-local" ? "datetime-local" : "date",
            maxPhotos: Math.min(20, Math.max(1, Math.round(optionalNumber(source.maxPhotos, source.type === "photo" ? 1 : 5)))),
        });
    }
    return sections;
}

function validatePdfConfig(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const margin = Math.min(90, Math.max(24, Number(source.margin) || 48));
    const titleSize = Math.min(28, Math.max(14, Number(source.titleSize) || 20));
    return {
        margin,
        titleSize,
        showHeader: source.showHeader !== false,
        showCompany: source.showCompany !== false,
        showClient: source.showClient !== false,
        showEquipment: source.showEquipment !== false,
        showPhotos: source.showPhotos !== false,
        showSignature: source.showSignature !== false,
        showPageNumbers: source.showPageNumbers !== false,
        footerText: optionalText(source.footerText, 240),
    };
}

router.get("/", requireRole(["ADMIN", "TECHNICIEN"]), async (req, res) => {
    try {
        const values = [req.user.entreprise_id];
        const activeFilter = req.user.role === "ADMIN" ? "" : "AND m.actif = TRUE";
        const result = await pool.query(
            `SELECT m.id, m.nom, m.description, m.sections, m.pdf_config, m.actif,
                    m.created_at, m.updated_at, u.nom AS createur_nom
             FROM modeles_rapport m
             JOIN utilisateurs u
               ON u.id = m.createur_id AND u.entreprise_id = m.entreprise_id
             WHERE m.entreprise_id = $1 ${activeFilter}
             ORDER BY m.actif DESC, m.nom ASC, m.id ASC`,
            values
        );
        return res.json(result.rows);
    } catch (error) {
        console.error("Échec de la liste des modèles", error);
        return res.status(500).json({ error: "Impossible de charger les modèles de rapport." });
    }
});

router.post("/", requireRole(["ADMIN"]), async (req, res) => {
    const nom = typeof req.body.nom === "string" ? req.body.nom.trim() : "";
    const sections = validateSections(req.body.sections ?? []);
    const pdfConfig = validatePdfConfig(req.body.pdf_config);
    if (!nom) return res.status(400).json({ error: "Le nom du modèle est requis." });
    if (!sections) return res.status(400).json({ error: "La structure du modèle est invalide." });
    try {
        const result = await pool.query(
            `INSERT INTO modeles_rapport
                (entreprise_id, createur_id, nom, description, sections, pdf_config)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
             RETURNING *`,
            [req.user.entreprise_id, req.user.id, nom, req.body.description?.trim() || null, JSON.stringify(sections), JSON.stringify(pdfConfig)]
        );
        await logActivity({ user: req.user, action: "CREATE", resourceType: "modele", resourceId: result.rows[0].id, summary: `Modèle « ${result.rows[0].nom} » créé.` });
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") return res.status(409).json({ error: "Un modèle porte déjà ce nom." });
        console.error("Échec de la création du modèle", error);
        return res.status(500).json({ error: "Impossible de créer le modèle." });
    }
});

router.put("/:id", requireRole(["ADMIN"]), async (req, res) => {
    const id = positiveId(req.params.id);
    const nom = typeof req.body.nom === "string" ? req.body.nom.trim() : "";
    const sections = validateSections(req.body.sections ?? []);
    const pdfConfig = validatePdfConfig(req.body.pdf_config);
    if (!id) return res.status(400).json({ error: "Identifiant de modèle invalide." });
    if (!nom || !sections) return res.status(400).json({ error: "Nom ou structure du modèle invalide." });
    try {
        const result = await pool.query(
            `UPDATE modeles_rapport
             SET nom = $1, description = $2, sections = $3::jsonb, pdf_config = $4::jsonb,
                 actif = $5, updated_at = NOW()
             WHERE id = $6 AND entreprise_id = $7
             RETURNING *`,
            [nom, req.body.description?.trim() || null, JSON.stringify(sections), JSON.stringify(pdfConfig), req.body.actif !== false, id, req.user.entreprise_id]
        );
        if (!result.rowCount) return res.status(404).json({ error: "Modèle introuvable." });
        await logActivity({ user: req.user, action: "UPDATE", resourceType: "modele", resourceId: id, summary: `Modèle « ${result.rows[0].nom} » modifié.`, changes: { sections: result.rows[0].sections.length } });
        return res.json(result.rows[0]);
    } catch (error) {
        if (error.code === "23505") return res.status(409).json({ error: "Un modèle porte déjà ce nom." });
        console.error("Échec de la modification du modèle", error);
        return res.status(500).json({ error: "Impossible de modifier le modèle." });
    }
});

router.delete("/:id", requireRole(["ADMIN"]), async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant de modèle invalide." });
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const model = await client.query(
            `SELECT id, nom, description, sections, pdf_config
             FROM modeles_rapport
             WHERE id = $1 AND entreprise_id = $2
             FOR UPDATE`,
            [id, req.user.entreprise_id]
        );
        if (!model.rowCount) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Modèle introuvable." });
        }
        const snapshot = JSON.stringify({
            nom: model.rows[0].nom,
            description: model.rows[0].description,
            sections: model.rows[0].sections,
            pdf_config: model.rows[0].pdf_config,
        });
        await client.query(
            `UPDATE interventions
             SET modele_rapport_snapshot = COALESCE(modele_rapport_snapshot, $1::jsonb),
                 modele_rapport_id = NULL,
                 updated_at = NOW()
             WHERE modele_rapport_id = $2 AND entreprise_id = $3`,
            [snapshot, id, req.user.entreprise_id]
        );
        await client.query(
            "DELETE FROM modeles_rapport WHERE id = $1 AND entreprise_id = $2",
            [id, req.user.entreprise_id]
        );
        await logActivity({ user: req.user, action: "DELETE", resourceType: "modele", resourceId: id, summary: `Modèle « ${model.rows[0].nom} » supprimé définitivement.`, client });
        await client.query("COMMIT");
        return res.status(204).send();
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Échec de la suppression du modèle", error);
        return res.status(500).json({ error: "Impossible de supprimer définitivement le modèle." });
    } finally {
        client.release();
    }
});

export default router;
