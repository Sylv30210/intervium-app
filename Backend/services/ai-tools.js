import pool from "../config/database.js";

const MAX_RESULTS = 10;

function positiveId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function queryText(value) {
    return typeof value === "string" && value.trim().length >= 2 ? value.trim().slice(0, 100) : null;
}

function accessClause(user, { intervention = "i", client = "c", start = 2 } = {}) {
    if (user.role === "TECHNICIEN") return { sql: ` AND ${intervention}.technicien_id = $${start}`, values: [user.id] };
    if (user.role === "CLIENT") return { sql: ` AND ${client}.utilisateur_id = $${start}`, values: [user.id] };
    return { sql: "", values: [] };
}

function compactReportData(value, depth = 0) {
    if (depth > 2 || value == null) return value == null ? value : undefined;
    if (typeof value === "string") return value.slice(0, 800);
    if (["number", "boolean"].includes(typeof value)) return value;
    if (Array.isArray(value)) return value.slice(0, 12).map((entry) => compactReportData(entry, depth + 1)).filter((entry) => entry !== undefined);
    if (typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 25).map(([key, entry]) => [key.slice(0, 80), compactReportData(entry, depth + 1)]).filter(([, entry]) => entry !== undefined));
    return undefined;
}

async function getIntervention(args, user) {
    const id = positiveId(args.id);
    if (!id) return { error: "Identifiant intervention invalide." };
    const access = accessClause(user, { start: 3 });
    const result = await pool.query(
        `SELECT i.id, i.titre, i.description, i.adresse_chantier, i.travaux_demandes, i.compte_rendu, i.statut, i.date_intervention, i.heure, i.donnees_rapport,
                c.nom AS client_nom, e.type AS equipement_type, e.marque AS equipement_marque, e.modele AS equipement_modele, e.numero_serie AS equipement_numero_serie, u.nom AS technicien_nom
         FROM interventions i JOIN clients c ON c.id=i.client_id AND c.entreprise_id=i.entreprise_id
         LEFT JOIN equipements e ON e.id=i.equipement_id AND e.entreprise_id=i.entreprise_id
         LEFT JOIN utilisateurs u ON u.id=i.technicien_id AND u.entreprise_id=i.entreprise_id
         WHERE i.id=$1 AND i.entreprise_id=$2 ${access.sql}`,
        [id, user.entreprise_id, ...access.values]
    );
    if (!result.rowCount) return { error: "Intervention introuvable ou inaccessible." };
    const row = result.rows[0];
    return { intervention: { ...row, donnees_rapport: compactReportData(row.donnees_rapport) } };
}

async function searchInterventions(args, user) {
    const term = queryText(args.query);
    if (!term) return { error: "Recherche intervention invalide." };
    const access = accessClause(user, { start: 3 });
    const result = await pool.query(
        `SELECT i.id, i.titre, i.statut, i.date_intervention, i.heure, c.nom AS client_nom, e.type AS equipement_type, e.modele AS equipement_modele
         FROM interventions i JOIN clients c ON c.id=i.client_id AND c.entreprise_id=i.entreprise_id
         LEFT JOIN equipements e ON e.id=i.equipement_id AND e.entreprise_id=i.entreprise_id
         WHERE i.entreprise_id=$1 AND (i.titre ILIKE $2 OR i.numero_rapport ILIKE $2 OR c.nom ILIKE $2) ${access.sql}
         ORDER BY i.date_intervention DESC NULLS LAST, i.id DESC LIMIT ${MAX_RESULTS}`,
        [user.entreprise_id, `%${term}%`, ...access.values]
    );
    return { interventions: result.rows };
}

async function searchClients(args, user) {
    const term = queryText(args.query);
    if (!term) return { error: "Recherche client invalide." };
    const clientFilter = user.role === "CLIENT" ? " AND c.utilisateur_id=$3" : "";
    const values = [user.entreprise_id, `%${term}%`, user.id];
    const result = await pool.query(`SELECT c.id, c.nom, c.telephone, c.adresse FROM clients c WHERE c.entreprise_id=$1 AND c.nom ILIKE $2 ${clientFilter} ORDER BY c.nom ASC LIMIT ${MAX_RESULTS}`, values);
    return { clients: result.rows };
}

async function getClient(args, user) {
    const id = positiveId(args.id);
    if (!id) return { error: "Identifiant client invalide." };
    const clientFilter = user.role === "CLIENT" ? " AND c.utilisateur_id=$3" : "";
    const result = await pool.query(`SELECT c.id, c.nom, c.telephone, c.adresse FROM clients c WHERE c.id=$1 AND c.entreprise_id=$2 ${clientFilter}`, [id, user.entreprise_id, user.id]);
    return result.rowCount ? { client: result.rows[0] } : { error: "Client introuvable ou inaccessible." };
}

async function searchEquipements(args, user) {
    const term = queryText(args.query);
    if (!term) return { error: "Recherche matériel invalide." };
    const clientFilter = user.role === "CLIENT" ? " AND c.utilisateur_id=$3" : "";
    const result = await pool.query(`SELECT e.id, e.type, e.marque, e.modele, e.numero_serie, c.nom AS client_nom FROM equipements e JOIN clients c ON c.id=e.client_id AND c.entreprise_id=e.entreprise_id WHERE e.entreprise_id=$1 AND (e.type ILIKE $2 OR e.marque ILIKE $2 OR e.modele ILIKE $2 OR e.numero_serie ILIKE $2) ${clientFilter} ORDER BY e.id DESC LIMIT ${MAX_RESULTS}`, [user.entreprise_id, `%${term}%`, user.id]);
    return { equipements: result.rows };
}

async function getEquipement(args, user) {
    const id = positiveId(args.id);
    if (!id) return { error: "Identifiant matériel invalide." };
    const clientFilter = user.role === "CLIENT" ? " AND c.utilisateur_id=$3" : "";
    const result = await pool.query(`SELECT e.id, e.type, e.marque, e.modele, e.numero_serie, e.annee_installation, c.nom AS client_nom FROM equipements e JOIN clients c ON c.id=e.client_id AND c.entreprise_id=e.entreprise_id WHERE e.id=$1 AND e.entreprise_id=$2 ${clientFilter}`, [id, user.entreprise_id, user.id]);
    return result.rowCount ? { equipement: result.rows[0] } : { error: "Matériel introuvable ou inaccessible." };
}

async function upcomingInterventions(_args, user) {
    const access = accessClause(user, { start: 2 });
    const result = await pool.query(`SELECT i.id, i.titre, i.statut, i.date_intervention, i.heure, c.nom AS client_nom FROM interventions i JOIN clients c ON c.id=i.client_id AND c.entreprise_id=i.entreprise_id WHERE i.entreprise_id=$1 AND i.date_intervention >= CURRENT_DATE AND i.statut IN ('PLANIFIEE','EN_COURS') ${access.sql} ORDER BY i.date_intervention ASC, i.heure ASC NULLS LAST, i.id ASC LIMIT ${MAX_RESULTS}`, [user.entreprise_id, ...access.values]);
    return { interventions: result.rows };
}

async function interventionStatistics(_args, user) {
    const access = accessClause(user, { start: 2 });
    const result = await pool.query(`SELECT COUNT(*)::INTEGER AS total, COUNT(*) FILTER (WHERE i.statut='TERMINEE')::INTEGER AS terminees_ce_mois, COUNT(*) FILTER (WHERE i.statut='PLANIFIEE' AND i.date_intervention=CURRENT_DATE+1)::INTEGER AS prevues_demain FROM interventions i JOIN clients c ON c.id=i.client_id AND c.entreprise_id=i.entreprise_id WHERE i.entreprise_id=$1 AND i.date_intervention >= date_trunc('month', CURRENT_DATE) ${access.sql}`, [user.entreprise_id, ...access.values]);
    return { statistiques: result.rows[0] };
}

const toolHandlers = { get_intervention: getIntervention, search_interventions: searchInterventions, get_client: getClient, search_clients: searchClients, get_equipement: getEquipement, search_equipements: searchEquipements, get_upcoming_interventions: upcomingInterventions, get_intervention_statistics: interventionStatistics };

export async function runAiTool(name, args, user) {
    const handler = toolHandlers[name];
    if (!handler || !args || typeof args !== "object" || Array.isArray(args)) return { error: "Outil ou paramètres invalides." };
    return handler(args, user);
}

const idParameter = { type: "object", properties: { id: { type: "integer", description: "Identifiant numérique Intervium." } }, required: ["id"] };
const queryParameter = { type: "object", properties: { query: { type: "string", description: "Terme de recherche, 100 caractères maximum." } }, required: ["query"] };
export const AI_TOOL_DECLARATIONS = [
    { name: "get_intervention", description: "Lit une intervention accessible à l'utilisateur.", parametersJsonSchema: idParameter },
    { name: "search_interventions", description: "Recherche les interventions accessibles.", parametersJsonSchema: queryParameter },
    { name: "get_client", description: "Lit un client accessible à l'utilisateur.", parametersJsonSchema: idParameter },
    { name: "search_clients", description: "Recherche des clients accessibles par leur nom.", parametersJsonSchema: queryParameter },
    { name: "get_equipement", description: "Lit un matériel accessible à l'utilisateur.", parametersJsonSchema: idParameter },
    { name: "search_equipements", description: "Recherche des matériels accessibles.", parametersJsonSchema: queryParameter },
    { name: "get_upcoming_interventions", description: "Liste les dix prochaines interventions accessibles.", parametersJsonSchema: { type: "object", properties: {} } },
    { name: "get_intervention_statistics", description: "Calcule les statistiques d'interventions accessibles du mois.", parametersJsonSchema: { type: "object", properties: {} } },
];
