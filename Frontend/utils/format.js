export function statusLabel(status) { return ({ PLANIFIEE: "Planifiée", EN_COURS: "En cours", TERMINEE: "Terminée", ANNULEE: "Annulée" })[status] || status; }
export function equipmentLabel(item) { return [item.equipement_type, item.equipement_marque, item.equipement_modele, item.equipement_numero_serie].filter(Boolean).join(" · ") || "Non renseigné"; }
export function formatDate(value) { return value ? new Intl.DateTimeFormat("fr-FR").format(new Date(`${String(value).slice(0,10)}T12:00:00`)) : "Non planifiée"; }
export function localDateKey(value) { const date = new Date(value); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); }
export function formatMoney(value, currency = "EUR") { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(Number(value || 0)); }
export function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
export function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
