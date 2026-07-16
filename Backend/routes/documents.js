import express from "express";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { logActivity } from "../services/activity.js";

const router = express.Router();
router.use(verifyToken, requireRole(["ADMIN"]));

const TYPES = new Set(["DEVIS", "FACTURE", "AVOIR"]);
const STATUTS = new Set(["BROUILLON", "ENVOYE", "ACCEPTE", "PAYE", "ANNULE"]);

function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function parseDocument(body) {
    const clientId = positiveId(body.client_id);
    const type = String(body.type || "").toUpperCase();
    const statut = String(body.statut || "BROUILLON").toUpperCase();
    if (!clientId || !TYPES.has(type) || !STATUTS.has(statut)) return null;
    if (!Array.isArray(body.lignes) || body.lignes.length === 0 || body.lignes.length > 100) return null;
    const lignes = [];
    let totalHt = 0;
    let totalTva = 0;
    for (const source of body.lignes) {
        const description = typeof source.description === "string" ? source.description.trim().slice(0, 300) : "";
        const quantite = Number(source.quantite);
        const prixUnitaire = Number(source.prix_unitaire);
        const tauxTva = Number(source.taux_tva ?? 20);
        if (!description || !Number.isFinite(quantite) || quantite <= 0 || !Number.isFinite(prixUnitaire) || prixUnitaire < 0 || !Number.isFinite(tauxTva) || tauxTva < 0 || tauxTva > 100) return null;
        const montantHt = Math.round(quantite * prixUnitaire * 100) / 100;
        const montantTva = Math.round(montantHt * tauxTva) / 100;
        totalHt += montantHt;
        totalTva += montantTva;
        lignes.push({ description, quantite, prix_unitaire: prixUnitaire, taux_tva: tauxTva, montant_ht: montantHt });
    }
    totalHt = Math.round(totalHt * 100) / 100;
    totalTva = Math.round(totalTva * 100) / 100;
    return {
        clientId, type, statut, lignes, totalHt, totalTva,
        totalTtc: Math.round((totalHt + totalTva) * 100) / 100,
        dateEmission: body.date_emission || null,
        dateEcheance: body.date_echeance || null,
        devise: /^[A-Z]{3}$/.test(String(body.devise || "EUR").toUpperCase()) ? String(body.devise || "EUR").toUpperCase() : "EUR",
        modePaiement: typeof body.mode_paiement === "string" ? body.mode_paiement.trim().slice(0, 80) || null : null,
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    };
}

router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT d.*, c.nom AS client_nom
             FROM documents_commerciaux d
             JOIN clients c ON c.id = d.client_id AND c.entreprise_id = d.entreprise_id
             WHERE d.entreprise_id = $1
             ORDER BY d.date_emission DESC, d.id DESC`,
            [req.user.entreprise_id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error("Échec de la liste des documents", error);
        return res.status(500).json({ error: "Impossible de charger les documents commerciaux." });
    }
});

router.post("/", async (req, res) => {
    const data = parseDocument(req.body);
    if (!data) return res.status(400).json({ error: "Document ou lignes de facturation invalides." });
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const owner = await client.query(
            "SELECT 1 FROM clients WHERE id = $1 AND entreprise_id = $2",
            [data.clientId, req.user.entreprise_id]
        );
        if (!owner.rowCount) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Client invalide pour cette entreprise." });
        }
        const inserted = await client.query(
            `INSERT INTO documents_commerciaux
                (entreprise_id, client_id, createur_id, type, statut, date_emission,
                 date_echeance, devise, mode_paiement, notes, lignes, total_ht, total_tva, total_ttc)
             VALUES ($1,$2,$3,$4,$5,COALESCE($6::date,CURRENT_DATE),$7,$8,$9,$10,$11::jsonb,$12,$13,$14)
             RETURNING *`,
            [req.user.entreprise_id, data.clientId, req.user.id, data.type, data.statut,
                data.dateEmission, data.dateEcheance, data.devise, data.modePaiement, data.notes,
                JSON.stringify(data.lignes), data.totalHt, data.totalTva, data.totalTtc]
        );
        const document = inserted.rows[0];
        const numero = `${data.type}-${new Date(document.date_emission).getFullYear()}-${String(document.id).padStart(5, "0")}`;
        const result = await client.query(
            "UPDATE documents_commerciaux SET numero = $1 WHERE id = $2 RETURNING *",
            [numero, document.id]
        );
        await logActivity({ user: req.user, action: "CREATE", resourceType: "document", resourceId: result.rows[0].id, summary: `${result.rows[0].type} « ${result.rows[0].numero} » créé.`, client });
        await client.query("COMMIT");
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Échec de la création du document", error);
        return res.status(500).json({ error: "Impossible de créer le document." });
    } finally {
        client.release();
    }
});

router.put("/:id", async (req, res) => {
    const id = positiveId(req.params.id);
    const data = parseDocument(req.body);
    if (!id || !data) return res.status(400).json({ error: "Document invalide." });
    try {
        const result = await pool.query(
            `UPDATE documents_commerciaux d
             SET client_id=$1, type=$2, statut=$3,
                 date_emission=COALESCE($4::date,date_emission), date_echeance=$5,
                 devise=$6, mode_paiement=$7, notes=$8, lignes=$9::jsonb,
                 total_ht=$10, total_tva=$11, total_ttc=$12, updated_at=NOW()
             WHERE d.id=$13 AND d.entreprise_id=$14
               AND EXISTS (SELECT 1 FROM clients c WHERE c.id=$1 AND c.entreprise_id=$14)
             RETURNING d.*`,
            [data.clientId, data.type, data.statut, data.dateEmission, data.dateEcheance,
                data.devise, data.modePaiement, data.notes, JSON.stringify(data.lignes),
                data.totalHt, data.totalTva, data.totalTtc, id, req.user.entreprise_id]
        );
        if (!result.rowCount) return res.status(404).json({ error: "Document ou client introuvable." });
        await logActivity({ user: req.user, action: "UPDATE", resourceType: "document", resourceId: id, summary: `Document « ${result.rows[0].numero || id} » modifié.` });
        return res.json(result.rows[0]);
    } catch (error) {
        console.error("Échec de la modification du document", error);
        return res.status(500).json({ error: "Impossible de modifier le document." });
    }
});

router.delete("/:id", async (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant de document invalide." });
    try {
        const result = await pool.query(
            `DELETE FROM documents_commerciaux
             WHERE id=$1 AND entreprise_id=$2
             RETURNING id`,
            [id, req.user.entreprise_id]
        );
        if (!result.rowCount) return res.status(404).json({ error: "Document introuvable dans cette entreprise." });
        await logActivity({ user: req.user, action: "DELETE", resourceType: "document", resourceId: id, summary: `Document ${id} supprimé.` });
        return res.status(204).send();
    } catch (error) {
        console.error("Échec de la suppression du document", error);
        return res.status(500).json({ error: "Impossible de supprimer le document." });
    }
});

export default router;
