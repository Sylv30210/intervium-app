export const KNOWN_VIEWS = new Set(["dashboard", "interventions", "planning", "clients", "equipements", "modeles", "documents", "equipe", "activity"]);

export function viewFromHash(hash) {
    const view = String(hash || "").replace(/^#/, "");
    return KNOWN_VIEWS.has(view) ? view : "dashboard";
}

export function titleForView(view) {
    return ({ dashboard: "Tableau de bord", interventions: "Rapports", planning: "Planning", clients: "Clients", equipements: "Matériels", modeles: "Modèles de rapport", documents: "Documents commerciaux", equipe: "Équipe", activity: "Historique" })[view] || "Intervium";
}
