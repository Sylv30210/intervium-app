import express from "express";
import pool from "../config/database.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
router.use(verifyToken);

router.get("/", async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const limit = Math.min(20, Math.max(5, Number.parseInt(req.query.limit || "10", 10)));
    if (query.length < 2) return res.json({ items: [] });
    const tenant = req.user.entreprise_id;
    const term = `%${query}%`;
    const techClause = req.user.role === "TECHNICIEN" ? "AND i.technicien_id = $4" : "";
    const clientClause = req.user.role === "CLIENT" ? "AND c.utilisateur_id = $4" : "";
    const values = [tenant, term, limit, req.user.id, req.user.role];
    try {
        const result = await pool.query(
            `SELECT * FROM (
               SELECT 'client' AS type, c.id, c.nom AS titre, COALESCE(c.email,c.telephone,'') AS sous_titre, c.updated_at
               FROM clients c WHERE c.entreprise_id=$1 ${clientClause} AND (c.nom ILIKE $2 OR c.email ILIKE $2 OR c.telephone ILIKE $2)
               UNION ALL
               SELECT 'equipement', e.id, COALESCE(e.type,'Équipement'), CONCAT_WS(' · ',e.modele,e.numero_serie,c.nom), e.updated_at
               FROM equipements e JOIN clients c ON c.id=e.client_id AND c.entreprise_id=e.entreprise_id
               WHERE e.entreprise_id=$1 ${clientClause} AND (e.type ILIKE $2 OR e.modele ILIKE $2 OR e.numero_serie ILIKE $2)
               UNION ALL
               SELECT 'intervention', i.id, i.titre, CONCAT_WS(' · ',c.nom,i.statut), i.updated_at
               FROM interventions i JOIN clients c ON c.id=i.client_id AND c.entreprise_id=i.entreprise_id
               WHERE i.entreprise_id=$1 ${techClause} ${clientClause} AND (i.titre ILIKE $2 OR i.description ILIKE $2 OR i.compte_rendu ILIKE $2)
               UNION ALL
               SELECT LOWER(d.type), d.id, COALESCE(d.numero,d.type), CONCAT_WS(' · ',c.nom,d.statut), d.updated_at
               FROM documents_commerciaux d JOIN clients c ON c.id=d.client_id AND c.entreprise_id=d.entreprise_id
               WHERE d.entreprise_id=$1 AND $4::bigint IS NOT NULL AND $5::text = 'ADMIN' AND (d.numero ILIKE $2 OR c.nom ILIKE $2)
             ) results ORDER BY updated_at DESC LIMIT $3`, values
        );
        res.json({ items: result.rows });
    } catch (error) {
        console.error("Échec recherche globale", error);
        res.status(500).json({ error: "Impossible d’effectuer la recherche." });
    }
});

export default router;
