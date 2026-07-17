import { escapeHtml } from "../utils/format.js";

export function parseEmailList(value) {
    return String(value || "").split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean);
}

export function clientContactFields(field, contact = {}) {
    return `${field("Nom complet", "nom", "text", true, contact.nom || "")}${field("Fonction", "fonction", "text", false, contact.fonction || "")}${field("E-mail", "email", "email", false, contact.email || "")}${field("Téléphone", "telephone", "tel", false, contact.telephone || "")}<label class="setting-check"><input name="destinataire_rapport" type="checkbox" ${contact.destinataire_rapport ? "checked" : ""}> Proposer ce contact comme destinataire des rapports</label>`;
}

export function equipmentFields(field, equipment = {}) {
    return `${field("Type", "type", "text", false, equipment.type || "")}${field("Marque", "marque", "text", false, equipment.marque || "")}${field("Modèle", "modele", "text", false, equipment.modele || "")}${field("Numéro de série", "numero_serie", "text", false, equipment.numero_serie || "")}<div class="field"><label>Année d’installation</label><input name="annee_installation" type="number" min="1900" max="2200" inputmode="numeric" value="${escapeHtml(equipment.annee_installation || "")}"></div>`;
}
