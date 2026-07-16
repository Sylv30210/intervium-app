import express from "express";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { logActivity } from "../services/activity.js";

const router = express.Router();
router.use(verifyToken);

const SECTION_TYPES = new Set([
    "title", "text", "textarea", "date", "number", "checkbox", "select",
    "client", "equipment", "photo", "multi_photo", "event_photos", "signature",
    "electronic_signature", "creator", "gps", "address", "table", "price_table", "page_break",
]);
const COLUMN_TYPES = new Set(["text", "textarea", "integer", "decimal", "currency", "percentage", "date", "time", "datetime", "boolean", "checkbox", "select", "photo", "row_number", "calculated"]);

function normalizeColumns(value, priceTable = false) {
    if (!Array.isArray(value) || value.length > 12) return null;
    const keys = new Set();
    return value.map((entry, index) => {
        const source = typeof entry === "string" ? { label: entry } : entry;
        if (!source || typeof source !== "object") return null;
        const key = optionalText(source.key || `c${index}`, 40).replace(/[^a-zA-Z0-9_-]/g, "") || `c${index}`;
        if (keys.has(key)) return null;
        keys.add(key);
        const fallbackType = priceTable && index === 1 ? "decimal" : priceTable && index === 2 ? "currency" : priceTable && index === 3 ? "percentage" : "text";
        const type = COLUMN_TYPES.has(source.type) ? source.type : fallbackType;
        return {
            key,
            label: optionalText(source.label || source.name || `Colonne ${index + 1}`, 80),
            type,
            required: source.required === true,
            width: Math.min(12, Math.max(1, Math.round(optionalNumber(source.width, 3)))),
            align: ["left", "center", "right"].includes(source.align) ? source.align : "left",
            visibleForm: source.visibleForm !== false,
            visiblePdf: source.visiblePdf !== false,
            defaultValue: ["text", "textarea", "date", "time", "datetime", "select"].includes(type) ? optionalText(source.defaultValue, 300) : optionalNumber(source.defaultValue, ""),
            options: type === "select" && Array.isArray(source.options) ? source.options.map((option) => optionalText(option, 100)).filter(Boolean).slice(0, 40) : [],
            allowOther: source.allowOther === true,
            min: optionalNumber(source.min), max: optionalNumber(source.max),
            decimals: Math.min(4, Math.max(0, Math.round(optionalNumber(source.decimals, type === "integer" ? 0 : 2)))),
            unit: optionalText(source.unit, 20),
            calculation: ["sum", "multiply", "average", "count"].includes(source.calculation) ? source.calculation : "",
        };
    });
}

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
        const columns = ["table", "price_table"].includes(source.type) ? normalizeColumns(source.columns || [], source.type === "price_table") : [];
        if (["table", "price_table"].includes(source.type) && (!columns || columns.some((column) => column === null))) return null;
        const min = optionalNumber(source.min);
        const max = optionalNumber(source.max);
        if (min !== null && max !== null && min > max) return null;
        sections.push({
            key,
            type: source.type,
            label: label || (source.type === "page_break" ? "Saut de page" : `Champ ${index + 1}`),
            required: Boolean(source.required),
            showLabel: source.showLabel !== false,
            options,
            listMode: ["select", "radio", "checkboxes", "segments"].includes(source.listMode) ? source.listMode : "select",
            multiple: source.multiple === true,
            allowOther: source.allowOther === true,
            columns: columns.length ? columns : (source.type === "price_table"
                ? normalizeColumns(["Désignation", "Quantité", "Prix HT", "TVA %"], true)
                : source.type === "table" ? normalizeColumns(["Colonne 1", "Colonne 2"]) : []),
            defaultRows: ["table", "price_table"].includes(source.type) && Array.isArray(source.defaultRows)
                ? source.defaultRows.slice(0, 30).map((row) => Object.fromEntries(Object.entries(row || {}).slice(0, 12).map(([columnKey, cell]) => [String(columnKey).slice(0, 40), typeof cell === "boolean" || typeof cell === "number" ? cell : optionalText(cell, 300)])))
                : [],
            allowAddRows: source.allowAddRows !== false,
            minRows: Math.min(100, Math.max(0, Math.round(optionalNumber(source.minRows, 0)))),
            maxRows: Math.min(100, Math.max(1, Math.round(optionalNumber(source.maxRows, 30)))),
            tableMode: ["table", "rows", "cards", "compact", "detailed"].includes(source.tableMode) ? source.tableMode : "table",
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

router.post("/:id/duplicate", requireRole(["ADMIN"]), async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Modèle invalide." });
    try {
        const source = await pool.query(
            "SELECT nom, description, sections, pdf_config FROM modeles_rapport WHERE id = $1 AND entreprise_id = $2",
            [id, req.user.entreprise_id]
        );
        if (!source.rowCount) return res.status(404).json({ error: "Modèle introuvable." });
        const baseName = `${source.rows[0].nom} - copie`;
        const result = await pool.query(
            `INSERT INTO modeles_rapport (entreprise_id, createur_id, nom, description, sections, pdf_config)
             SELECT $1, $2, CASE WHEN EXISTS (SELECT 1 FROM modeles_rapport WHERE entreprise_id=$1 AND nom=$3)
                 THEN $3 || ' ' || to_char(clock_timestamp(), 'HH24MISS') ELSE $3 END,
                 $4, $5::jsonb, $6::jsonb RETURNING *`,
            [req.user.entreprise_id, req.user.id, baseName, source.rows[0].description, JSON.stringify(source.rows[0].sections), JSON.stringify(source.rows[0].pdf_config || {})]
        );
        await logActivity({ user: req.user, action: "CREATE", resourceType: "modele", resourceId: result.rows[0].id, summary: `Modèle « ${source.rows[0].nom} » dupliqué.` });
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Échec de la duplication du modèle", error);
        return res.status(500).json({ error: "Impossible de dupliquer le modèle." });
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
