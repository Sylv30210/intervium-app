import { applyStoredTheme, setTheme } from "./utils/theme.js";
import { icon } from "./components/icons.js";
import { capitalize, equipmentLabel, escapeHtml, formatDate, formatMoney, localDateKey, statusLabel } from "./utils/format.js";
import { createApiClient } from "./api/client.js";
import { renderClientsView, renderEquipmentsView, renderTeamView } from "./views/resources.js";
import { titleForView, viewFromHash } from "./navigation/routes.js";
import { bindSignatureCanvas } from "./reports/signature-canvas.js";
import { clientContactFields, equipmentFields, parseEmailList } from "./clients/forms.js";
import { calculateDocumentTotals } from "./documents/totals.js";
import { companyLogoSourceUrl, photoSourceUrl, reportSignatureSourceUrl, signatureSourceUrl, userSignatureSourceUrl } from "./utils/media.js";
import { COLLECTION_PAGE_LIMIT, collectionPageUrl } from "./utils/collections.js";

let currentUser = null;
let currentEntreprise = null;
let interventions = [];
let clients = [];
let equipements = [];
let technicians = [];
let creationClients = [];
let creationEquipements = [];
let reportTemplates = [];
let commercialDocuments = []; // Données historiques conservées, module volontairement masqué dans la navigation principale.
let planningCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let templateDraftSections = [];
let currentView = "dashboard";
let deferredInstallPrompt = null;
let serviceWorkerRegistration = null;
let reportAutosaveTimer = null;
let reportAutosavePending = false;
let globalSearchTimer = null;
let mobileNavLongPressTimer = null;
let emailMailStatus = { connections: [], providers: [], configuration: {} };
let platformCompanies = [];
let publicRegistrationEnabled = null;
let onboardingStepIndex = -1;
let onboardingKeyHandler = null;
let onboardingPositionHandler = null;
let dashboardStats = { reports: 0, finished: 0, visible_clients: 0, visible_equipments: 0 };
let appVersion = "2.2.0";
const collectionPages = {
    interventions: { page: 1, limit: COLLECTION_PAGE_LIMIT, total: 0, query: "", requestId: 0 },
    clients: { page: 1, limit: COLLECTION_PAGE_LIMIT, total: 0, query: "", requestId: 0 },
    equipements: { page: 1, limit: COLLECTION_PAGE_LIMIT, total: 0, query: "", requestId: 0 },
};

const app = document.getElementById("app");
applyStoredTheme();
const api = createApiClient({ onUnauthorized: () => { currentUser = null; showAuth(); } });


document.addEventListener("DOMContentLoaded", async () => {
    initPwa();
    await initApp();
});

function isStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
}

function isIosDevice() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function updateInstallUi() {
    const canInstall = Boolean(deferredInstallPrompt) && !isStandaloneMode();
    document.querySelectorAll("[data-install-app]").forEach((button) => {
        button.hidden = !canInstall;
    });
}

async function installIntervium() {
    if (!deferredInstallPrompt || isStandaloneMode()) return;
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    await prompt.prompt();
    await prompt.userChoice.catch(() => null);
    updateInstallUi();
}

function initPwa() {
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        updateInstallUi();
    });
    window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        updateInstallUi();
        toast("Intervium est installé sur cet appareil.");
    });
    window.addEventListener("online", () => {
        if (document.querySelector(".offline-card")) initApp();
        else toast("Connexion rétablie.");
    });
    window.addEventListener("offline", () => toast("Connexion perdue. Les données privées ne sont pas mises en cache.", true));
    window.addEventListener("popstate", (event) => {
        if (!currentUser) return;
        renderMain(event.state?.view || viewFromLocation());
    });

    if ("serviceWorker" in navigator && window.isSecureContext) {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
            serviceWorkerRegistration = registration;
            registration.update().catch(() => {});
            if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
            registration.addEventListener("updatefound", () => {
                const worker = registration.installing;
                worker?.addEventListener("statechange", () => {
                    if (worker.state === "installed" && navigator.serviceWorker.controller) {
                        worker.postMessage({ type: "SKIP_WAITING" });
                    }
                });
            });
        }).catch((error) => console.error("Service worker non enregistré", error));
    }
}

function viewFromLocation() {
    return viewFromHash(location.hash);
}

function navigateTo(view, replace = false) {
    const method = replace ? "replaceState" : "pushState";
    history[method]({ view }, "", `#${view}`);
    renderMain(view);
}

function showOfflineScreen(message = "Les données sécurisées nécessitent une connexion au serveur.") {
    app.innerHTML = `<main class="offline-card"><div>${logoLockup("auth-logo")}<h1>Mode hors connexion</h1><p class="muted">${escapeHtml(message)}</p><button class="primary" id="offline-retry">Réessayer</button></div></main>`;
    document.getElementById("offline-retry").addEventListener("click", initApp);
}

async function initApp() {
    app.innerHTML = `<div class="app-loading"><div class="loading-card">${logoLockup("auth-logo")}<span class="spinner large" aria-hidden="true"></span><span class="sr-only">Chargement de l’application</span><div class="skeletons" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div></div>`;
    try {
        const session = await api("/auth/me");
        currentUser = session.user;
        currentEntreprise = session.entreprise;
        if (currentUser.consent_required) {
            showConsent();
            return;
        }
        await loadAllData();
        navigateTo(viewFromLocation(), true);
        if (!currentUser.onboarding_completed) setTimeout(() => startOnboarding(), 250);
    } catch (error) {
        if (!navigator.onLine || /connexion|serveur inaccessible/i.test(error.message)) {
            showOfflineScreen(error.message);
        } else if (!currentUser) showAuth();
        else {
            renderMain("dashboard");
            toast(error.message, true);
        }
    }
}

function showConsent() {
    app.innerHTML = `<main class="auth"><section class="auth-card"><div>${logoLockup("auth-logo")}</div><h1>Vos préférences</h1><p>Avant d’accéder à Intervium, prenez connaissance des <a href="/conditions.html" target="_blank" rel="noopener">conditions d’utilisation</a> et de la <a href="/confidentialite.html" target="_blank" rel="noopener">politique de confidentialité</a>.</p><form id="consent-form"><label class="setting-row"><span class="setting-copy"><strong>Conditions d’utilisation</strong><span>J’ai lu et j’accepte les conditions d’utilisation.</span></span><input name="accept_terms" type="checkbox" required></label><fieldset><legend>Cookies</legend><label><input type="radio" name="cookies_choice" value="necessary" checked> Cookies strictement nécessaires uniquement</label><br><label><input type="radio" name="cookies_choice" value="all"> Tout accepter, y compris les cookies optionnels</label></fieldset><p class="muted">Le cookie de session est indispensable pour sécuriser votre connexion.</p><button class="primary wide" type="submit">Enregistrer et continuer</button><button class="secondary wide" id="consent-logout" type="button">Se déconnecter</button></form></section></main>`;
    document.getElementById("consent-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const values = Object.fromEntries(new FormData(form));
        await api("/auth/consent", { method: "PUT", body: JSON.stringify({ accept_terms: values.accept_terms === "on", cookies_choice: values.cookies_choice }) });
        await initApp();
    });
    document.getElementById("consent-logout").addEventListener("click", logout);
}

function showAuth(mode = "login") {
    const registrationAvailable = publicRegistrationEnabled === true;
    if (publicRegistrationEnabled === null) {
        publicRegistrationEnabled = false;
        api("/auth/config").then((config) => {
            publicRegistrationEnabled = config.public_registration_enabled === true;
            showAuth(mode === "register" && !publicRegistrationEnabled ? "login" : mode);
        }).catch(() => {});
    }
    app.innerHTML = `
      <main class="auth"><section class="auth-card">
        ${logoLockup("auth-logo")}<p class="muted">Gestion sécurisée des interventions</p>
        ${registrationAvailable ? `<div class="tabs"><button data-auth-tab="login" class="${mode === "login" ? "active" : ""}">Connexion</button><button data-auth-tab="register" class="${mode === "register" ? "active" : ""}">Créer un compte</button></div>` : ""}
        <div id="auth-error" class="error hidden"></div>
        <form id="login-form" class="${mode === "login" ? "" : "hidden"}">
          ${field("Email", "email", "email", true)}${field("Mot de passe", "password", "password", true)}${field("Code d’authentification (super-développeur uniquement)", "totp_code", "text", false)}
          <button class="primary wide" type="submit">Se connecter</button>
        </form>
        ${registrationAvailable ? `<form id="register-form" class="${mode === "register" ? "" : "hidden"}">
          ${field("Nom de l’entreprise", "nom_entreprise", "text", true)}${field("Votre nom", "nom", "text", true)}${field("Email", "email", "email", true)}${field("Mot de passe (8 caractères minimum)", "password", "password", true)}
          <button class="primary wide" type="submit">Créer mon espace</button>
        </form>` : ""}
        <footer class="auth-footer">Conçu par Sylvain Lecoeuvre</footer>
      </section></main>`;

    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
        button.addEventListener("click", () => showAuth(button.dataset.authTab));
    });
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("register-form")?.addEventListener("submit", handleRegister);
}

function field(label, name, type = "text", required = false, value = "") {
    return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""}></div>`;
}


function fileUpload({ id, name, label, help, accept, maxMb = 5, capture = "", previewUrl = "", multiple = false }) {
    return `<div class="file-upload" data-file-upload data-max-mb="${maxMb}">
      <label class="file-upload-label" for="${id}">${escapeHtml(label)}</label>
      <input class="file-upload-input sr-only" id="${id}" name="${name}" type="file" accept="${accept}" ${capture ? `capture="${capture}"` : ""} ${multiple ? "multiple" : ""}>
      <div class="file-upload-dropzone" tabindex="0" role="button" aria-controls="${id}" aria-describedby="${id}-help">
        <span class="file-upload-icon">${icon("upload")}</span>
        <span class="file-upload-copy"><strong>Choisir un fichier</strong><small id="${id}-help">${escapeHtml(help)} · ${maxMb} Mo maximum</small><span class="file-upload-name">Aucun fichier sélectionné</span></span>
      </div>
      <div class="file-upload-preview ${previewUrl ? "is-visible" : ""}" aria-live="polite">${previewUrl ? `<img src="${escapeHtml(previewUrl)}" alt="Aperçu du fichier actuel">` : ""}<button class="file-upload-clear" type="button" aria-label="Retirer le fichier sélectionné" title="Retirer">${icon("trash")}</button></div>
      <p class="file-upload-status" role="status" aria-live="polite"></p>
    </div>`;
}

function bindFileUpload(root, { onChange } = {}) {
    const component = typeof root === "string" ? document.querySelector(root) : root;
    if (!component) return;
    const input = component.querySelector(".file-upload-input");
    const zone = component.querySelector(".file-upload-dropzone");
    const preview = component.querySelector(".file-upload-preview");
    const name = component.querySelector(".file-upload-name");
    const status = component.querySelector(".file-upload-status");
    let objectUrl = null;
    const choose = () => input.click();
    const update = () => {
        const files = [...(input.files || [])];
        const file = files[0];
        component.classList.remove("is-error", "is-success");
        input.setCustomValidity("");
        status.textContent = "";
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (!file) { name.textContent = "Aucun fichier sélectionné"; preview.classList.remove("is-visible"); preview.querySelector("img")?.remove(); onChange?.(null, component); return; }
        const maxBytes = Number(component.dataset.maxMb || 5) * 1024 * 1024;
        const acceptedTypes = input.accept.split(",").map((value) => value.trim()).filter(Boolean);
        const typeAllowed = files.every((candidate) => !acceptedTypes.length || acceptedTypes.some((accepted) => accepted.endsWith("/*") ? candidate.type.startsWith(accepted.slice(0, -1)) : candidate.type === accepted));
        if (!typeAllowed) {
            input.setCustomValidity("Ce format de fichier n’est pas accepté.");
            component.classList.add("is-error"); status.textContent = input.validationMessage; name.textContent = file.name; onChange?.(file, component); return;
        }
        if (files.some((candidate) => candidate.size > maxBytes)) {
            input.setCustomValidity(`Un fichier dépasse la limite de ${component.dataset.maxMb} Mo.`);
            component.classList.add("is-error"); status.textContent = input.validationMessage; name.textContent = file.name; onChange?.(file, component); return;
        }
        const totalMb = files.reduce((sum, candidate) => sum + candidate.size, 0) / 1024 / 1024;
        name.textContent = files.length > 1 ? `${files.length} fichiers · ${totalMb.toFixed(2)} Mo` : `${file.name} · ${totalMb.toFixed(2)} Mo`;
        if (file.type.startsWith("image/")) {
            objectUrl = URL.createObjectURL(file);
            let image = preview.querySelector("img");
            if (!image) { image = document.createElement("img"); image.alt = "Aperçu du fichier sélectionné"; preview.prepend(image); }
            image.src = objectUrl; preview.classList.add("is-visible");
        }
        component.classList.add("is-success"); status.textContent = files.length > 1 ? "Fichiers prêts à être envoyés." : "Fichier prêt à être envoyé."; onChange?.(file, component);
    };
    zone.addEventListener("click", choose);
    zone.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); choose(); } });
    ["dragenter", "dragover"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add("is-dragover"); }));
    ["dragleave", "drop"].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.remove("is-dragover"); }));
    zone.addEventListener("drop", (event) => { if (event.dataTransfer?.files?.length) { const transfer = new DataTransfer(); [...event.dataTransfer.files].slice(0, input.multiple ? undefined : 1).forEach((file) => transfer.items.add(file)); input.files = transfer.files; update(); } });
    input.addEventListener("change", update);
    component.querySelector(".file-upload-clear").addEventListener("click", () => { input.value = ""; update(); });
}

function logoSvg() {
    return `<svg class="brand-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M24 3.5 41 10v12.6c0 10.2-6.7 18.3-17 21.9C13.7 40.9 7 32.8 7 22.6V10L24 3.5Z" fill="currentColor" opacity=".2"/><path d="M24 5.8 38.5 11v11.6c0 8.5-5.4 15.4-14.5 18.9-9.1-3.5-14.5-10.4-14.5-18.9V11L24 5.8Z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="m16.4 23.8 5 5 10.8-11" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function logoLockup(extraClass = "") {
    return `<div class="brand-lockup ${extraClass}" aria-label="Intervium">${logoSvg()}<span>Intervium</span></div>`;
}

function authError(message) {
    const box = document.getElementById("auth-error");
    box.textContent = message;
    box.classList.remove("hidden");
}

function formFromSubmitEvent(event) {
    const form = event?.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
        throw new TypeError("Le formulaire HTML est indisponible.");
    }
    return form;
}

async function handleLogin(event) {
    event.preventDefault();
    const form = formFromSubmitEvent(event);
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector("button[type='submit']");
    await withBusy(button, async () => {
        try {
            await api("/auth/login", { method: "POST", body: JSON.stringify(values) });
            await initApp();
        } catch (error) { authError(error.message); }
    });
}

async function handleRegister(event) {
    event.preventDefault();
    const form = formFromSubmitEvent(event);
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector("button[type='submit']");
    await withBusy(button, async () => {
        try {
            await api("/auth/register", { method: "POST", body: JSON.stringify(values) });
            await api("/auth/login", { method: "POST", body: JSON.stringify({ email: values.email, password: values.password }) });
            await initApp();
        } catch (error) { authError(error.message); }
    });
}

async function logout() {
    try { await api("/auth/logout", { method: "POST" }); } catch {}
    currentUser = null;
    currentEntreprise = null;
    showAuth();
}

async function loadAllData() {
    const collectionLimit = COLLECTION_PAGE_LIMIT;
    Object.values(collectionPages).forEach((state) => { state.limit = collectionLimit; });
    appVersion = (await api("/version").catch(() => ({ version: appVersion }))).version;
    emailMailStatus = await api("/email-connections").catch(() => ({ connections: [], providers: [], configuration: {} }));
    platformCompanies = currentUser.is_super_developer ? await api("/auth/companies") : [];
    if (currentUser.role === "CLIENT") {
        const page = await api(`/interventions?page=1&limit=${collectionLimit}`);
        interventions = page.items;
        Object.assign(collectionPages.interventions, page);
        dashboardStats = await api("/interventions/stats");
        clients = [];
        equipements = [];
        technicians = [];
        creationClients = [];
        creationEquipements = [];
        reportTemplates = [];
        commercialDocuments = [];
        return;
    }
    const results = await Promise.allSettled([
        api(`/interventions?page=1&limit=${collectionLimit}`),
        api(`/clients?page=1&limit=${collectionLimit}`),
        api(`/equipements?page=1&limit=${collectionLimit}`),
        currentUser.role === "ADMIN" ? api("/auth/users") : Promise.resolve([]),
        api("/interventions/stats"),
        api("/modeles"),
        currentUser.role === "ADMIN" ? api("/documents") : Promise.resolve([]),
    ]);
    const stateTargets = [
        (value) => { interventions = value.items; Object.assign(collectionPages.interventions, value); },
        (value) => { clients = value.items; Object.assign(collectionPages.clients, value); },
        (value) => { equipements = value.items; Object.assign(collectionPages.equipements, value); },
        (value) => { technicians = value; },
        (value) => { dashboardStats = value; },
        (value) => { reportTemplates = value; },
        (value) => { commercialDocuments = value; },
    ];
    const failures = [];
    results.forEach((result, index) => {
        if (result.status === "fulfilled") stateTargets[index](result.value);
        else failures.push(result.reason?.message || "Données indisponibles");
    });
    if (failures.length) {
        throw new Error(`Certaines données n'ont pas pu être chargées : ${[...new Set(failures)].join(" ")}`);
    }
}

function renderMain(view = "dashboard") {
    currentView = view;
    const mobileNavigation = renderMobileNavigation(view);
    const sessionCompany = currentEntreprise?.nom || "Votre entreprise";
    const sessionRole = currentUser.role === "ADMIN" ? "Admin" : currentUser.role === "TECHNICIEN" ? "Technicien" : "Client";
    app.innerHTML = `<div class="shell">
      <aside class="sidebar"><div>${logoLockup()}<div class="muted">${escapeHtml(currentEntreprise?.nom || "")}</div></div>
        <nav class="nav">${navButton("dashboard", "Tableau de bord", view, "home")}${navButton("interventions", "Rapports", view, "interventions")}${currentUser.role === "CLIENT" ? "" : `${navButton("planning", "Planning", view, "calendar")}${navButton("clients", "Clients", view, "clients")}${navButton("equipements", "Matériels", view, "equipment")}${navButton("modeles", "Modèles de rapport", view, "template")}`}${currentUser.role === "ADMIN" ? navButton("equipe", "Équipe", view, "team") : ""}</nav>
        <div class="profile"><strong>${escapeHtml(currentUser.nom)}</strong><br>${escapeHtml(currentUser.role)}<div class="profile-actions"><button class="icon-button install-button" data-install-app hidden>${icon("download")} Installer Intervium</button><button id="desktop-settings" class="icon-button">${icon("settings")} Paramètres</button><button id="desktop-logout" class="secondary">${icon("logout")} Déconnexion</button></div></div>
      </aside>
      <header class="mobile-header">${logoLockup("compact mobile-brand")}<div class="mobile-session" aria-label="Session connectée"><strong>${escapeHtml(currentUser.nom)}</strong><span>${escapeHtml(sessionCompany)} · ${escapeHtml(sessionRole)}</span></div><div class="mobile-user"><button id="mobile-settings" class="mobile-settings icon-only" aria-label="Ouvrir les paramètres" title="Paramètres">${icon("settings")}</button><button id="mobile-logout" class="mobile-logout icon-only" aria-label="Se déconnecter" title="Déconnexion">${icon("logout")}</button></div></header>
      <main class="main">${currentUser.support_session ? `<div class="support-banner"><strong>Assistance : vous consultez ${escapeHtml(currentEntreprise?.nom || "une entreprise")}</strong><span>${currentUser.support_session.write_enabled ? "Écriture temporaire activée" : "Lecture seule"}</span><button id="leave-support" class="secondary" type="button">Quitter l’entreprise</button></div>` : ""}<header class="topbar"><div><h1>${titleForView(view)}</h1><div class="muted">Données de ${escapeHtml(currentEntreprise?.nom || "votre entreprise")}</div></div><div class="topbar-actions"><button class="secondary icon-only" id="global-search" aria-label="Recherche globale" title="Recherche globale">${icon("search")}</button><button class="secondary notification-button icon-only" id="open-notifications" aria-label="Notifications" title="Notifications">${icon("alert")}<span id="notification-count" class="notification-count hidden">0</span></button>${adminButtonFor(view)}</div></header><div id="view">${renderView(view)}</div></main>
      <nav class="bottom-nav" aria-label="Navigation principale" data-mobile-nav>${mobileNavigation}</nav>
    </div><div id="modal-root"></div><div id="onboarding-root"></div>`;

    document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => navigateTo(button.dataset.view)));
    document.querySelectorAll("[data-install-app]").forEach((button) => button.addEventListener("click", installIntervium));
    document.getElementById("desktop-logout").addEventListener("click", logout);
    document.getElementById("mobile-logout").addEventListener("click", logout);
    document.getElementById("desktop-settings").addEventListener("click", openSettings);
    document.getElementById("mobile-settings").addEventListener("click", openSettings);
    document.getElementById("mobile-more")?.addEventListener("click", openMoreMenu);
    document.getElementById("global-search")?.addEventListener("click", openGlobalSearch);
    document.getElementById("open-notifications")?.addEventListener("click", openNotifications);
    document.getElementById("leave-support")?.addEventListener("click", async () => {
        await api("/auth/support-session", { method: "DELETE" });
        window.location.reload();
    });
    bindMainActions(view);
    bindServerPagination();
    bindServerSearch();
    bindMobileNavigationReorder();
    updateInstallUi();
    refreshNotificationCount();
}

function navButton(view, label, active, iconName) { return `<button data-view="${view}" class="${view === active ? "active" : ""}">${icon(iconName)}<span>${label}</span></button>`; }
function mobileNavButton(view, iconName, label, active) { return `<button data-view="${view}" data-mobile-nav-item class="${view === active ? "active" : ""}" aria-label="${label}" title="${label}"><span class="nav-icon">${icon(iconName)}</span><span class="nav-label">${label}</span></button>`; }

function mobileNavigationItems() {
    const items = [
        { view: "dashboard", icon: "home", label: "Accueil" },
        { view: "interventions", icon: "interventions", label: currentUser.role === "CLIENT" ? "Rapports" : "Missions" },
    ];
    if (currentUser.role !== "CLIENT") items.push(
        { view: "planning", icon: "calendar", label: "Planning" },
        { view: "clients", icon: "clients", label: "Clients" },
        { view: "equipements", icon: "equipment", label: "Matériels" },
        { view: "modeles", icon: "template", label: "Modèles" },
    );
    if (currentUser.role === "ADMIN") items.push(
        { view: "equipe", icon: "team", label: "Équipe" },
        { view: "activity", icon: "history", label: "Historique" },
    );
    return items;
}

function mobileNavStorageKey() { return `intervium_mobile_nav:${currentEntreprise?.id || currentUser?.entreprise_id}:${currentUser?.id}`; }
function orderedMobileNavigationItems() {
    const available = mobileNavigationItems();
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(mobileNavStorageKey()) || "[]"); } catch {}
    const rank = new Map(saved.map((view, index) => [view, index]));
    return [...available].sort((left, right) => (rank.get(left.view) ?? 999) - (rank.get(right.view) ?? 999) || available.indexOf(left) - available.indexOf(right));
}
function renderMobileNavigation(active) {
    const ordered = orderedMobileNavigationItems();
    const visibleCount = currentUser.role === "CLIENT" ? ordered.length : 4;
    const visible = ordered.slice(0, visibleCount);
    const buttons = visible.map((item) => mobileNavButton(item.view, item.icon, item.label, active)).join("");
    return `${buttons}${ordered.length > visibleCount ? `<button id="mobile-more" aria-label="Plus de rubriques" title="Plus"><span class="nav-icon">${icon("more")}</span><span class="nav-label">Plus</span></button>` : ""}`;
}

function saveMobileNavigationOrder(nav) {
    const visible = [...nav.querySelectorAll("[data-mobile-nav-item]")].map((button) => button.dataset.view);
    const remainder = orderedMobileNavigationItems().map((item) => item.view).filter((view) => !visible.includes(view));
    try { localStorage.setItem(mobileNavStorageKey(), JSON.stringify([...visible, ...remainder])); } catch {}
}

function bindMobileNavigationReorder() {
    const nav = document.querySelector("[data-mobile-nav]");
    if (!nav || !window.matchMedia("(max-width: 768px)").matches) return;
    if (nav.dataset.dragBound === "true") return;
    nav.dataset.dragBound = "true";
    let dragged = null;
    let startX = 0, startY = 0, latestX = 0;
    let suppressClick = false;
    let activePointerId = null;
    let placeholder = null;
    let dragOffsetX = 0;
    let initialOrder = [];
    let originalNextSibling = null;
    let frame = null;
    const cancelPending = () => { clearTimeout(mobileNavLongPressTimer); mobileNavLongPressTimer = null; };
    const visibleOrder = () => [...nav.querySelectorAll("[data-mobile-nav-item]")].map((item) => item.dataset.view);
    const resetFloatingStyles = () => {
        if (!dragged) return;
        for (const property of ["left", "top", "width", "height"]) dragged.style.removeProperty(property);
        dragged.classList.remove("is-lifted");
        nav.classList.remove("is-reordering");
    };
    const placeAtOriginalPosition = () => {
        if (!dragged || !placeholder) return;
        if (originalNextSibling?.isConnected && originalNextSibling.parentElement === nav) nav.insertBefore(placeholder, originalNextSibling);
        else nav.insertBefore(placeholder, nav.querySelector("#mobile-more"));
    };
    const finish = ({ commit = true } = {}) => {
        cancelPending();
        if (!dragged) return;
        if (frame) cancelAnimationFrame(frame);
        if (!commit) placeAtOriginalPosition();
        const floatingBox = dragged.getBoundingClientRect();
        placeholder.replaceWith(dragged);
        resetFloatingStyles();
        const finalBox = dragged.getBoundingClientRect();
        const changed = commit && visibleOrder().join("|") !== initialOrder.join("|");
        dragged.animate?.([
            { transform: `translate(${floatingBox.left - finalBox.left}px, ${floatingBox.top - finalBox.top}px) scale(1.1)`, boxShadow: "0 12px 28px #0f172a35" },
            { transform: "translate(0, 0) scale(1)", boxShadow: "none" },
        ], { duration: 210, easing: "cubic-bezier(.2,.8,.2,1)" });
        if (changed) {
            saveMobileNavigationOrder(nav);
            toast("Ordre de navigation enregistré.");
        }
        dragged = null; placeholder = null; activePointerId = null; originalNextSibling = null; initialOrder = [];
        setTimeout(() => { suppressClick = false; }, 320);
    };
    const updateDragFrame = () => {
        frame = null;
        if (!dragged || !placeholder) return;
        const navBox = nav.getBoundingClientRect();
        const width = Number.parseFloat(dragged.style.width) || dragged.getBoundingClientRect().width;
        dragged.style.left = `${Math.max(navBox.left, Math.min(latestX - dragOffsetX, navBox.right - width))}px`;
        // Les rectangles sont relus à chaque frame, après toute mutation précédente du DOM.
        const candidates = [...nav.children].filter((item) =>
            item.matches?.("[data-mobile-nav-item]") && item !== dragged && !item.hidden
        );
        let targetIndex = candidates.length;
        for (let index = 0; index < candidates.length; index += 1) {
            const rect = candidates[index].getBoundingClientRect();
            if (latestX < rect.left + rect.width / 2) { targetIndex = index; break; }
        }
        const currentIndex = [...nav.children].filter((item) => item === placeholder || candidates.includes(item)).indexOf(placeholder);
        if (targetIndex === currentIndex) return;
        const targetElement = candidates[targetIndex] || nav.querySelector("#mobile-more");
        if (targetElement) nav.insertBefore(placeholder, targetElement);
        else nav.appendChild(placeholder);
    };
    nav.addEventListener("pointerdown", (event) => {
            const button = event.target.closest("[data-mobile-nav-item]");
            if (!button || button.parentElement !== nav || (event.pointerType === "mouse" && event.button !== 0)) return;
            cancelPending();
            startX = latestX = event.clientX; startY = event.clientY;
            activePointerId = event.pointerId;
            mobileNavLongPressTimer = setTimeout(() => {
                if (!button.isConnected || button.parentElement !== nav) return;
                dragged = button; suppressClick = true;
                const box = button.getBoundingClientRect();
                initialOrder = visibleOrder();
                originalNextSibling = button.nextSibling;
                dragOffsetX = event.clientX - box.left;
                placeholder = document.createElement("span"); placeholder.className = "nav-placeholder"; placeholder.setAttribute("aria-hidden", "true");
                button.before(placeholder);
                nav.classList.add("is-reordering"); button.classList.add("is-lifted");
                Object.assign(button.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
                try {
                    button.setPointerCapture?.(event.pointerId);
                } catch (error) {
                    console.warn("[mobile-nav-drag] pointer capture failed", error);
                }
                navigator.vibrate?.(35);
            }, 450);
    });
    nav.addEventListener("pointermove", (event) => {
            if (event.pointerId !== activePointerId) return;
            latestX = event.clientX;
            if (!dragged) {
                const dx = event.clientX - startX; const dy = event.clientY - startY;
                const distance = Math.hypot(dx, dy);
                if (distance >= 12) cancelPending();
                return;
            }
            if (Math.abs(event.clientY - startY) > 52) return finish({ commit: false });
            event.preventDefault();
            if (!frame) frame = requestAnimationFrame(updateDragFrame);
    });
    nav.addEventListener("pointerup", (event) => { if (event.pointerId === activePointerId) finish({ commit: true }); });
    nav.addEventListener("pointercancel", (event) => { if (event.pointerId === activePointerId) { if (dragged) finish({ commit: false }); else cancelPending(); } });
    nav.addEventListener("contextmenu", (event) => { if (event.target.closest("[data-mobile-nav-item]")) event.preventDefault(); });
    nav.addEventListener("click", (event) => { if (suppressClick && event.target.closest("[data-mobile-nav-item]")) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
}
function adminButtonFor(view) {
    const canAdd = currentUser.role === "ADMIN" ||
        (currentUser.role === "TECHNICIEN" && ["interventions", "planning"].includes(view));
    if (!canAdd || view === "dashboard") return "";
    if (view === "modeles" && currentUser.role !== "ADMIN") return "";
    return `<button class="primary" id="add-${view}">${icon("plus")} Ajouter</button>`;
}

function renderView(view) {
    if (view === "dashboard") return renderDashboard();
    if (view === "interventions") return renderInterventions();
    if (view === "planning") return renderPlanning();
    if (view === "clients") return renderClients();
    if (view === "equipements") return renderEquipements();
    if (view === "modeles") return renderTemplates();
    if (view === "documents") return renderDocuments();
    if (view === "activity") return `<section class="panel"><div class="table-tools"><select id="activity-type"><option value="">Toutes les ressources</option><option value="client">Clients</option><option value="equipement">Matériels</option><option value="intervention">Interventions</option><option value="modele">Modèles</option><option value="utilisateur">Utilisateurs</option></select><button class="secondary" id="activity-refresh">Actualiser</button></div><div id="activity-list" class="activity-list"><div class="empty"><span class="spinner"></span> Chargement…</div></div></section>`;
    return renderTeam();
}

function renderDashboard() {
    const finished = dashboardStats.finished;
    const quickActions = currentUser.role === "CLIENT" ? "" : `<section class="quick-actions"><button class="primary" data-quick-action="intervention">${icon("plus")} Planifier une intervention</button><button class="secondary" data-quick-view="planning">${icon("calendar")} Ouvrir le planning</button><button class="secondary" data-quick-view="modeles">${icon("template")} Modèles de rapport</button></section>`;
    return `<section class="stats"><div class="stat"><span class="muted">Rapports</span><strong>${dashboardStats.reports}</strong></div><div class="stat"><span class="muted">Terminés</span><strong>${finished}</strong></div><div class="stat"><span class="muted">Clients visibles</span><strong>${dashboardStats.visible_clients}</strong></div><div class="stat"><span class="muted">Matériels visibles</span><strong>${dashboardStats.visible_equipments}</strong></div></section>${quickActions}<section class="panel"><div class="panel-head"><h2>Prochaines interventions</h2></div>${interventionTable(interventions.filter((item) => item.creation_type !== "RAPPORT_DIRECT").slice(0, 5), false)}</section>`;
}

function serverPager(view) {
    const state = collectionPages[view];
    if (!state || state.total <= state.limit) return "";
    const pages = Math.max(1, Math.ceil(state.total / state.limit));
    return `<div class="pagination server-pagination"><button class="secondary" data-server-page="${state.page - 1}" data-server-view="${view}" ${state.page <= 1 ? "disabled" : ""}>Précédent</button><span>${state.total} résultat(s) · page ${state.page}/${pages}</span><button class="secondary" data-server-page="${state.page + 1}" data-server-view="${view}" ${state.page >= pages ? "disabled" : ""}>Suivant</button></div>`;
}

function serverSearch(view) {
    const state = collectionPages[view];
    if (!state) return "";
    return `<div class="table-tools"><label class="sr-only" for="server-search-${view}">Filtrer cette liste</label><input id="server-search-${view}" data-server-search="${view}" type="search" placeholder="Filtrer cette liste…" value="${escapeHtml(state.query)}"><button class="secondary" data-server-search-reset="${view}" type="button">Réinitialiser</button></div>`;
}

async function loadCollectionPage(view, page) {
    const state = collectionPages[view];
    if (!state) return;
    const requestId = ++state.requestId;
    const result = await api(collectionPageUrl(view, { page, limit: state.limit, query: state.query }));
    if (requestId !== state.requestId) return;
    if (view === "interventions") interventions = result.items;
    if (view === "clients") clients = result.items;
    if (view === "equipements") equipements = result.items;
    Object.assign(state, result);
    renderMain(view);
}

function bindServerPagination() {
    document.querySelectorAll("[data-server-page]").forEach((button) => button.addEventListener("click", () => {
        loadCollectionPage(button.dataset.serverView, Number(button.dataset.serverPage)).catch((error) => toast(error.message, true));
    }));
}

function bindServerSearch() {
    document.querySelectorAll("[data-server-search]").forEach((input) => {
        let timer;
        input.addEventListener("input", () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                const state = collectionPages[input.dataset.serverSearch];
                if (!state) return;
                state.query = input.value.trim();
                loadCollectionPage(input.dataset.serverSearch, 1).catch((error) => toast(error.message, true));
            }, 250);
        });
    });
    document.querySelectorAll("[data-server-search-reset]").forEach((button) => button.addEventListener("click", () => {
        const view = button.dataset.serverSearchReset;
        const state = collectionPages[view];
        if (!state) return;
        state.query = "";
        loadCollectionPage(view, 1).catch((error) => toast(error.message, true));
    }));
}

function renderInterventions() { return `<section class="panel">${serverSearch("interventions")}${interventionTable(interventions, true)}${serverPager("interventions")}</section>`; }

function renderPlanning() {
    const year = planningCursor.getFullYear();
    const month = planningCursor.getMonth();
    const firstMondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const start = new Date(year, month, 1 - firstMondayOffset);
    const todayKey = localDateKey(new Date());
    const cells = Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
        const key = localDateKey(date);
        const events = interventions.filter((item) => item.creation_type !== "RAPPORT_DIRECT" && String(item.date_intervention || "").slice(0, 10) === key);
        return `<div class="calendar-day ${date.getMonth() === month ? "" : "outside"} ${key === todayKey ? "today" : ""}"><span class="calendar-number">${date.getDate()}</span>${events.map((event) => `<button class="calendar-event" data-edit-intervention="${event.id}" title="${escapeHtml(event.titre)} — ${escapeHtml(event.client_nom)}${event.adresse_chantier ? ` — ${escapeHtml(event.adresse_chantier)}` : ""}">${escapeHtml(event.heure?.slice(0,5) || "")} ${escapeHtml(event.titre)}</button>`).join("")}</div>`;
    }).join("");
    const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(planningCursor);
    return `<section class="panel"><div class="calendar-head"><button class="secondary" id="planning-prev" aria-label="Mois précédent">‹</button><h2>${capitalize(monthLabel)}</h2><button class="secondary" id="planning-next" aria-label="Mois suivant">›</button></div><div class="calendar-grid">${["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map((day) => `<div class="calendar-weekday">${day}</div>`).join("")}${cells}</div></section>`;
}

function renderTemplates() {
    if (!reportTemplates.length) return `<section class="panel"><div class="empty">Aucun modèle de rapport. Un ADMIN peut créer une structure réutilisable pour accélérer la saisie terrain et uniformiser les PDF.</div></section>`;
    return `<section class="panel"><div class="panel-head"><div><h2>Modèles réutilisables</h2><p class="muted">Les champs du modèle apparaissent lors de la création et dans le PDF du rapport.</p></div></div><div class="template-list">${reportTemplates.map((template) => `<article class="template-card"><div><strong>${escapeHtml(template.nom)}</strong><div class="muted">${escapeHtml(template.description || "Sans description")} · ${(template.sections || []).length} bloc(s)</div></div>${currentUser.role === "ADMIN" ? `<div class="actions"><button class="secondary" data-duplicate-template="${template.id}">Dupliquer</button><button class="secondary" data-edit-template="${template.id}">${icon("edit")} Configurer</button><button class="danger" data-delete-template="${template.id}">${icon("trash")} Supprimer définitivement</button></div>` : ""}</article>`).join("")}</div></section>`;
}

function renderDocuments() {
    const total = commercialDocuments.reduce((sum, document) => sum + Number(document.total_ttc || 0), 0);
    const paid = commercialDocuments.filter((document) => document.statut === "PAYE").reduce((sum, document) => sum + Number(document.total_ttc || 0), 0);
    return `<section class="stats"><div class="stat"><span class="muted">Documents</span><strong>${commercialDocuments.length}</strong></div><div class="stat"><span class="muted">Total TTC</span><strong>${formatMoney(total)}</strong></div><div class="stat"><span class="muted">Payé</span><strong>${formatMoney(paid)}</strong></div><div class="stat"><span class="muted">À encaisser</span><strong>${formatMoney(total - paid)}</strong></div></section><section class="panel"><div class="document-list">${commercialDocuments.length ? commercialDocuments.map((document) => `<article class="document-card"><div><strong>${escapeHtml(document.numero || document.type)}</strong><div class="muted">${escapeHtml(document.client_nom)} · ${formatDate(document.date_emission)} · ${escapeHtml(document.statut)}</div></div><div class="actions"><strong>${formatMoney(document.total_ttc, document.devise)}</strong><button class="secondary" data-open-document="${document.id}">${icon("documents")} Voir</button><button class="danger" data-delete-document="${document.id}">${icon("trash")} Supprimer</button></div></article>`).join("") : `<div class="empty">Aucun devis ou facture.</div>`}</div></section>`;
}
function interventionTable(items, actions) {
    if (!items.length) {
        const emptyMessage = currentUser.role === "CLIENT"
            ? "Aucun rapport disponible avec votre compte actuellement."
            : "Aucun rapport pour le moment. Planifiez une intervention ou créez un rapport direct pour démarrer le suivi.";
        return `<div class="empty">${emptyMessage}</div>`;
    }
    return `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Client</th><th>Matériel</th><th>Rapport</th><th>Technicien</th><th>Statut</th>${actions ? "<th>Actions</th>" : ""}</tr></thead><tbody>${items.map((item) => `<tr><td data-label="Date">${formatDate(item.date_intervention)} ${escapeHtml(item.heure?.slice(0,5) || "")}</td><td data-label="Client">${escapeHtml(item.client_nom)}</td><td data-label="Matériel">${escapeHtml(equipmentLabel(item))}</td><td data-label="Rapport"><strong>${escapeHtml(item.numero_rapport || "Historique")}</strong><br>${escapeHtml(item.titre)}${item.creation_type === "RAPPORT_DIRECT" ? '<br><span class="badge off">Rapport direct</span>' : ""}</td><td data-label="Technicien">${escapeHtml(item.technicien_nom || "Non assigné")}</td><td data-label="Statut"><span class="badge">${statusLabel(item.statut)}</span></td>${actions ? `<td data-label="Actions" class="actions"><button class="secondary" data-edit-intervention="${item.id}">${icon("edit")} Ouvrir</button>${currentUser.role === "ADMIN" ? `<button class="danger" data-delete-intervention="${item.id}">${icon("trash")} Supprimer</button>` : ""}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

function renderClients() { return renderClientsView({ clients, currentUser, toolbar: serverSearch("clients"), pager: serverPager("clients") }); }

function renderEquipements() { return renderEquipmentsView({ equipments: equipements, currentUser, toolbar: serverSearch("equipements"), pager: serverPager("equipements") }); }

function renderTeam() { return renderTeamView({ technicians }); }

function bindMainActions(view) {
    document.getElementById(`add-${view}`)?.addEventListener("click", () => {
        if (view === "interventions") openNewIntervention();
        if (view === "planning") openNewIntervention();
        if (view === "clients") openNewClient();
        if (view === "equipements") openNewEquipment();
        if (view === "equipe") openNewTechnician();
        if (view === "modeles") openTemplateEditor();
        if (view === "documents") openDocumentEditor();
    });
    document.querySelectorAll("[data-quick-view]").forEach((button) => button.addEventListener("click", () => navigateTo(button.dataset.quickView)));
    document.querySelector("[data-quick-action='intervention']")?.addEventListener("click", () => openNewIntervention());
    document.getElementById("planning-prev")?.addEventListener("click", () => { planningCursor = new Date(planningCursor.getFullYear(), planningCursor.getMonth() - 1, 1); renderMain("planning"); });
    document.getElementById("planning-next")?.addEventListener("click", () => { planningCursor = new Date(planningCursor.getFullYear(), planningCursor.getMonth() + 1, 1); renderMain("planning"); });
    document.querySelectorAll("[data-edit-intervention]").forEach((b) => b.addEventListener("click", () => openIntervention(b.dataset.editIntervention)));
    document.querySelectorAll("[data-edit-template]").forEach((button) => button.addEventListener("click", () => openTemplateEditor(button.dataset.editTemplate)));
    document.querySelectorAll("[data-duplicate-template]").forEach((button) => button.addEventListener("click", () => duplicateTemplate(button.dataset.duplicateTemplate, button)));
    document.querySelectorAll("[data-delete-template]").forEach((button) => button.addEventListener("click", () => deleteTemplate(button.dataset.deleteTemplate, button)));
    document.querySelectorAll("[data-open-document]").forEach((button) => button.addEventListener("click", () => openDocumentDetails(button.dataset.openDocument)));
    document.querySelectorAll("[data-open-client]").forEach((button) => button.addEventListener("click", () => openClientDetails(button.dataset.openClient)));
    document.querySelectorAll("[data-edit-equipment]").forEach((button) => button.addEventListener("click", () => openEquipmentEditor(button.dataset.editEquipment)));
    document.querySelectorAll("[data-delete-document]").forEach((button) => button.addEventListener("click", () => deleteDocument(button.dataset.deleteDocument, button)));
    bindDeletes("intervention", "/interventions", "interventions");
    bindDeletes("client", "/clients", "clients");
    bindDeletes("equipment", "/equipements", "equipements");
    bindTeamActions();
    if (view === "activity") bindActivityView();
    enhanceBusinessTables(view);
}

function enhanceBusinessTables(view) {
    document.querySelectorAll("#view .table-wrap").forEach((wrap, tableIndex) => {
        const table = wrap.querySelector("table");
        const rows = [...table?.tBodies?.[0]?.rows || []];
        const serverState = collectionPages[view];
        const serverBacked = Boolean(serverState);
        if (!table || (!serverBacked && rows.length < 2) || wrap.dataset.enhanced) return;
        wrap.dataset.enhanced = "true";
        const storageKey = `intervium_table:${view}:${tableIndex}`;
        let saved = {}; try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "{}"); } catch {}
        let page = 1; const pageSize = serverBacked ? Number.MAX_SAFE_INTEGER : 10; let sortIndex = Number.isInteger(saved.sortIndex) ? saved.sortIndex : -1; let direction = saved.direction || "asc";
        if (serverBacked) {
            const renderServerRows = () => {
                const ordered = [...rows];
                if (sortIndex >= 0) ordered.sort((a, b) => a.cells[sortIndex].textContent.trim().localeCompare(b.cells[sortIndex].textContent.trim(), "fr", { numeric: true }) * (direction === "asc" ? 1 : -1));
                ordered.forEach((row) => { row.hidden = false; row.parentElement.append(row); });
                try { sessionStorage.setItem(storageKey, JSON.stringify({ sortIndex, direction })); } catch {}
            };
            [...table.tHead?.rows?.[0]?.cells || []].forEach((header, index) => {
                if (/actions?/i.test(header.textContent)) return;
                header.tabIndex = 0; header.title = "Trier cette colonne";
                header.addEventListener("click", () => { direction = sortIndex === index && direction === "asc" ? "desc" : "asc"; sortIndex = index; renderServerRows(); });
                header.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); header.click(); } });
            });
            renderServerRows();
            return;
        }
        const tools = document.createElement("div"); tools.className = "table-tools";
        tools.innerHTML = `<label class="sr-only" for="table-search-${tableIndex}">Filtrer ce tableau</label><input id="table-search-${tableIndex}" type="search" placeholder="Filtrer cette liste…" value="${escapeHtml(saved.query || "")}"><button class="secondary" type="button">Réinitialiser</button>`;
        wrap.before(tools);
        const pager = document.createElement("div"); pager.className = "pagination"; pager.hidden = serverBacked; wrap.after(pager);
        const search = tools.querySelector("input");
        const render = () => {
            const query = search.value.trim().toLocaleLowerCase("fr");
            let filtered = rows.filter((row) => row.textContent.toLocaleLowerCase("fr").includes(query));
            if (sortIndex >= 0) filtered.sort((a, b) => a.cells[sortIndex].textContent.trim().localeCompare(b.cells[sortIndex].textContent.trim(), "fr", { numeric: true }) * (direction === "asc" ? 1 : -1));
            const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); page = Math.min(page, pages);
            rows.forEach((row) => { row.hidden = true; }); filtered.slice((page - 1) * pageSize, page * pageSize).forEach((row) => { row.hidden = false; row.parentElement.append(row); });
            pager.innerHTML = `<button class="secondary" type="button" data-page="prev" ${page === 1 ? "disabled" : ""}>Précédent</button><span>${filtered.length ? `${filtered.length} résultat(s) · page ${page}/${pages}` : "Aucun résultat"}</span><button class="secondary" type="button" data-page="next" ${page === pages ? "disabled" : ""}>Suivant</button>`;
            pager.querySelector('[data-page="prev"]')?.addEventListener("click", () => { page -= 1; render(); }); pager.querySelector('[data-page="next"]')?.addEventListener("click", () => { page += 1; render(); });
            try { sessionStorage.setItem(storageKey, JSON.stringify({ query: search.value, sortIndex, direction })); } catch {}
        };
        let timer; search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; render(); }, 250); });
        tools.querySelector("button").addEventListener("click", () => { search.value = ""; sortIndex = -1; page = 1; render(); });
        [...table.tHead?.rows?.[0]?.cells || []].forEach((header, index) => { if (/actions?/i.test(header.textContent)) return; header.tabIndex = 0; header.title = "Trier cette colonne"; header.addEventListener("click", () => { direction = sortIndex === index && direction === "asc" ? "desc" : "asc"; sortIndex = index; page = 1; render(); }); header.addEventListener("keydown", (event) => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); header.click(); } }); });
        render();
    });
}

async function bindActivityView(page = 1) {
    const type = document.getElementById("activity-type")?.value || "";
    try {
        const result = await api(`/activity?page=${page}&limit=25${type ? `&type=${encodeURIComponent(type)}` : ""}`);
        const list = document.getElementById("activity-list"); if (!list) return;
        list.innerHTML = result.items.length ? result.items.map((item) => `<article class="activity-item"><span><strong>${escapeHtml(item.resume)}</strong><small>${escapeHtml(item.utilisateur_nom || "Utilisateur supprimé")} · ${escapeHtml(item.utilisateur_role || "—")} · ${new Date(item.created_at).toLocaleString("fr-FR")}</small></span><span class="badge">${escapeHtml(item.ressource_type)}</span></article>`).join("") + `<div class="pagination"><button class="secondary" data-activity-page="${page - 1}" ${page <= 1 ? "disabled" : ""}>Précédent</button><span>Page ${page} / ${Math.max(1, result.pagination.pages)}</span><button class="secondary" data-activity-page="${page + 1}" ${page >= result.pagination.pages ? "disabled" : ""}>Suivant</button></div>` : `<div class="empty">Aucune activité enregistrée.</div>`;
        list.querySelectorAll("[data-activity-page]").forEach((button) => button.addEventListener("click", () => bindActivityView(Number(button.dataset.activityPage))));
    } catch (error) { document.getElementById("activity-list").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`; }
    document.getElementById("activity-type")?.addEventListener("change", () => bindActivityView(1), { once: true });
    document.getElementById("activity-refresh")?.addEventListener("click", () => bindActivityView(page), { once: true });
}

function openMoreMenu() {
    const visible = new Set([...document.querySelectorAll("[data-mobile-nav-item]")].map((button) => button.dataset.view));
    const items = orderedMobileNavigationItems().filter((item) => !visible.has(item.view));
    modal("Plus de rubriques", `<div class="more-menu">${items.map((item) => `<button class="secondary" data-more-view="${item.view}">${icon(item.icon)} ${item.label}</button>`).join("")}</div><p class="muted">Maintenez une icône de la barre inférieure pour réorganiser vos raccourcis.</p><button class="secondary wide" id="customize-nav-from-more" type="button">Personnaliser la navigation</button>`);
    document.querySelectorAll("[data-more-view]").forEach((button) => button.addEventListener("click", () => navigateTo(button.dataset.moreView)));
    document.getElementById("customize-nav-from-more")?.addEventListener("click", openMobileNavigationCustomizer);
}

function openGlobalSearch() {
    modal("Recherche globale", `<div class="field"><label for="global-search-input">Rechercher dans votre espace</label><input id="global-search-input" type="search" autocomplete="off" placeholder="Client, équipement, intervention, document…"></div><div id="global-search-results" class="search-results"><div class="empty">Saisissez au moins 2 caractères.</div></div>`);
    const input = document.getElementById("global-search-input");
    input.addEventListener("input", () => {
        clearTimeout(globalSearchTimer);
        const query = input.value.trim();
        if (query.length < 2) { document.getElementById("global-search-results").innerHTML = `<div class="empty">Saisissez au moins 2 caractères.</div>`; return; }
        document.getElementById("global-search-results").innerHTML = `<div class="empty"><span class="spinner"></span> Recherche…</div>`;
        globalSearchTimer = setTimeout(async () => {
            try {
                const result = await api(`/search?q=${encodeURIComponent(query)}`);
                const target = document.getElementById("global-search-results");
                if (!target) return;
                target.innerHTML = result.items.length ? result.items.map((item) => `<button class="search-result" data-search-type="${escapeHtml(item.type)}" data-search-id="${item.id}"><span><strong>${escapeHtml(item.titre)}</strong><small>${escapeHtml(item.sous_titre || item.type)}</small></span><span class="badge">${escapeHtml(item.type)}</span></button>`).join("") : `<div class="empty">Aucun résultat.</div>`;
                target.querySelectorAll("[data-search-type]").forEach((button) => button.addEventListener("click", () => openSearchResult(button.dataset.searchType, button.dataset.searchId)));
            } catch (error) { document.getElementById("global-search-results").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`; }
        }, 350);
    });
}

function openSearchResult(type, id) {
    closeModal();
    if (["intervention", "rapport"].includes(type)) { navigateTo("interventions"); return setTimeout(() => openIntervention(id), 0); }
    if (type === "client") { navigateTo("clients"); return setTimeout(() => openClientDetails(id), 0); }
    if (["devis", "facture"].includes(type)) { navigateTo("documents"); return setTimeout(() => openDocumentDetails(id), 0); }
    navigateTo("equipements");
}

async function refreshNotificationCount() {
    try {
        const result = await api("/notifications?limit=10&unread=true");
        const badge = document.getElementById("notification-count");
        if (!badge) return;
        badge.textContent = result.unread > 99 ? "99+" : String(result.unread);
        badge.classList.toggle("hidden", !result.unread);
    } catch { /* Le centre reste discret si la migration n'est pas encore déployée. */ }
}

async function openNotifications() {
    modal("Notifications", `<div class="panel-head"><label><input id="notifications-unread" type="checkbox"> Non lues uniquement</label><div class="actions"><button class="secondary" id="read-all-notifications">Tout marquer comme lu</button><button class="danger" id="delete-all-notifications">Tout supprimer</button></div></div><div id="notifications-list" class="notification-list"><div class="empty"><span class="spinner"></span> Chargement…</div></div>`);
    const load = async () => {
        try {
            const unread = document.getElementById("notifications-unread")?.checked;
            const result = await api(`/notifications?limit=30${unread ? "&unread=true" : ""}`);
            const list = document.getElementById("notifications-list");
            if (!list) return;
            list.innerHTML = result.items.length ? result.items.map((item) => `<article class="notification-item ${item.lu_at ? "" : "unread"}"><button class="notification-open" data-notification-id="${item.id}" data-resource-type="${escapeHtml(item.ressource_type || "")}" data-resource-id="${item.ressource_id || ""}"><span><strong>${escapeHtml(item.titre)}</strong><small>${escapeHtml(item.message)}</small><small>${new Date(item.created_at).toLocaleString("fr-FR")}</small></span></button><button class="danger notification-delete" data-delete-notification="${item.id}" type="button" aria-label="Supprimer cette notification" title="Supprimer">${icon("trash")}</button></article>`).join("") : `<div class="empty">Aucune notification.</div>`;
            list.querySelectorAll("[data-notification-id]").forEach((button) => button.addEventListener("click", async () => { await api(`/notifications/${button.dataset.notificationId}/read`, { method: "PATCH" }); openSearchResult(button.dataset.resourceType, button.dataset.resourceId); }));
            list.querySelectorAll("[data-delete-notification]").forEach((button) => button.addEventListener("click", async () => {
                await withBusy(button, async () => {
                    try { await api(`/notifications/${button.dataset.deleteNotification}`, { method: "DELETE" }); await load(); }
                    catch (error) { toast(error.message, true); }
                });
            }));
            refreshNotificationCount();
        } catch (error) { document.getElementById("notifications-list").innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`; }
    };
    document.getElementById("notifications-unread").addEventListener("change", load);
    document.getElementById("read-all-notifications").addEventListener("click", async () => { await api("/notifications/read-all", { method: "POST" }); await load(); });
    document.getElementById("delete-all-notifications").addEventListener("click", async () => {
        if (!confirm("Supprimer définitivement toutes vos notifications ?")) return;
        await api("/notifications", { method: "DELETE" });
        await load();
    });
    await load();
}

function bindDeletes(name, path, view) {
    document.querySelectorAll(`[data-delete-${name}]`).forEach((button) => button.addEventListener("click", async () => {
        if (!confirm("Confirmer la suppression ?")) return;
        await withBusy(button, async () => {
            try {
                await api(`${path}/${button.dataset[`delete${capitalize(name)}`]}`, { method: "DELETE" });
                await finishMutation(view, "Suppression effectuée.");
            } catch (error) { toast(error.message, true); }
        });
    }));
}

function onboardingSteps() {
    const role = currentUser?.role;
    const sharedSteps = [
        {
            title: "Bienvenue dans Intervium",
            text: "Intervium regroupe les interventions, les rapports PDF, les clients et le planning dans un même espace.",
            selector: null,
            items: [
                "Vérifie l’entreprise et le compte connectés avant de travailler.",
                "Utilise la navigation pour passer rapidement d’un module à l’autre.",
                "Le tutoriel reste disponible depuis les paramètres.",
            ],
        },
        {
            title: "Tableau de bord",
            text: "Le tableau de bord donne l’état immédiat de l’activité.",
            view: "dashboard",
            selector: ".stats",
            items: [
                "Suis les rapports, interventions terminées, clients et matériels visibles.",
                "Utilise les boutons rapides pour planifier, ouvrir le planning ou gérer les modèles.",
            ],
        },
        {
            title: "Navigation",
            text: "Sur ordinateur le menu est à gauche ; sur mobile les raccourcis principaux sont en bas.",
            selector: ".sidebar .nav, .bottom-nav",
            items: [
                "Le bouton Plus affiche les rubriques restantes sur mobile.",
                "L’ordre de la barre mobile se personnalise depuis les paramètres.",
            ],
        },
    ];
    const staffSteps = role !== "CLIENT" ? [
        {
            title: "Planifier une intervention",
            text: "Crée une intervention avec client, matériel, technicien, date et modèle de rapport.",
            view: "interventions",
            selector: "#add-interventions",
            items: [
                "Le technicien retrouve ensuite la mission dans Rapports ou Planning.",
                "Les brouillons de rapport sont protégés pendant la saisie.",
            ],
        },
        {
            title: "Clients et matériels",
            text: "Centralise les coordonnées, contacts destinataires et équipements.",
            view: "clients",
            selector: '[data-view="clients"]',
            items: [
                "Les e-mails de rapport peuvent être enregistrés par client.",
                "Les matériels restent reliés à l’historique des interventions.",
            ],
        },
        {
            title: "Planning",
            text: "Le planning permet de suivre les interventions à venir et leur statut.",
            view: "planning",
            selector: '[data-view="planning"]',
            items: [
                "Ouvre une intervention pour compléter son rapport.",
                "Les statuts gardent l’équipe alignée.",
            ],
        },
    ] : [];
    const adminSteps = role === "ADMIN" ? [
        {
            title: "Modèles de rapport",
            text: "Les modèles définissent les blocs à remplir et leur rendu PDF.",
            view: "modeles",
            selector: "#add-modeles",
            items: [
                "Ajoute textes, cases à cocher, photos, signatures, tableaux et sauts de page.",
                "Configure l’affichage PDF, les choix Autre et les options de signature.",
            ],
        },
        {
            title: "Équipe et paramètres",
            text: "Les administrateurs gèrent les accès, l’identité PDF et les comptes e-mail.",
            view: "equipe",
            selector: '[data-view="equipe"]',
            items: [
                "Connecte Google, Microsoft ou SMTP pour envoyer les rapports.",
                "Personnalise le logo, le pied de page et le message e-mail par défaut.",
            ],
        },
    ] : [];
    const clientSteps = role === "CLIENT" ? [
        {
            title: "Espace client",
            text: "Tu retrouves ici les rapports qui te concernent.",
            view: "interventions",
            selector: '[data-view="interventions"]',
            items: [
                "Ouvre un rapport pour consulter les informations disponibles.",
                "Les données affichées sont limitées à ton entreprise et à tes accès.",
            ],
        },
    ] : [];
    return [
        ...sharedSteps,
        ...staffSteps,
        ...adminSteps,
        ...clientSteps,
        {
            title: "Rapports, photos et PDF",
            text: "Dans une fiche rapport, complète les champs, ajoute des photos et génère le PDF.",
            view: "interventions",
            selector: '[data-view="interventions"]',
            items: [
                "Les signatures et brouillons sont conservés pendant la rédaction.",
                "Tu peux choisir les photos incluses avant export ou envoi e-mail.",
            ],
        },
        {
            title: "Recherche et notifications",
            text: "Les icônes en haut ouvrent la recherche globale et les notifications.",
            selector: "#global-search, #open-notifications",
            items: [
                "La recherche aide à retrouver rapidement rapports, clients ou matériels.",
                "Les notifications signalent les actions importantes.",
            ],
        },
        {
            title: "Personnaliser le compte",
            text: "Les paramètres regroupent sécurité, thème, e-mail, identité PDF et tutoriel.",
            selector: "#desktop-settings, #mobile-settings",
            items: [
                "Sur mobile, l’en-tête rappelle le compte et l’entreprise connectés.",
                "Tu peux relancer ce tutoriel à tout moment.",
            ],
        },
        {
            title: "Tout est prêt !",
            text: "Tu peux maintenant utiliser Intervium avec les principaux repères.",
            selector: null,
            items: [
                "Commence par planifier une intervention ou ouvrir un rapport existant.",
                "En cas de doute, reviens aux paramètres pour relancer l’aide.",
            ],
        },
    ];
}

function visibleOnboardingTarget(selector) {
    if (!selector) return null;
    return [...document.querySelectorAll(selector)].find((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    }) || null;
}

function removeOnboardingListeners() {
    if (onboardingKeyHandler) document.removeEventListener("keydown", onboardingKeyHandler);
    if (onboardingPositionHandler) {
        window.removeEventListener("resize", onboardingPositionHandler);
        document.removeEventListener("scroll", onboardingPositionHandler, true);
    }
    onboardingKeyHandler = null;
    onboardingPositionHandler = null;
}

function closeOnboarding() {
    removeOnboardingListeners();
    document.getElementById("onboarding-root")?.replaceChildren();
    onboardingStepIndex = -1;
}

function positionOnboarding(target) {
    const root = document.getElementById("onboarding-root");
    const bubble = root?.querySelector(".onboarding-bubble");
    if (!root || !bubble) return;
    const shades = [...root.querySelectorAll(".onboarding-shade")];
    const spotlight = root.querySelector(".onboarding-spotlight");
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const gap = 14;

    if (!target) {
        shades[0].style.cssText = "inset:0";
        shades.slice(1).forEach((shade) => { shade.style.cssText = "display:none"; });
        spotlight.hidden = true;
        const bubbleRect = bubble.getBoundingClientRect();
        bubble.style.left = `${Math.max(margin, (viewportWidth - bubbleRect.width) / 2)}px`;
        bubble.style.top = `${Math.max(margin, (viewportHeight - bubbleRect.height) / 2)}px`;
        bubble.dataset.arrow = "none";
        return;
    }

    const raw = target.getBoundingClientRect();
    const pad = 7;
    const rect = {
        top: Math.max(0, raw.top - pad), left: Math.max(0, raw.left - pad),
        right: Math.min(viewportWidth, raw.right + pad), bottom: Math.min(viewportHeight, raw.bottom + pad),
    };
    shades.forEach((shade) => { shade.style.display = "block"; });
    shades[0].style.cssText = `left:0;top:0;width:100%;height:${rect.top}px`;
    shades[1].style.cssText = `left:0;top:${rect.top}px;width:${rect.left}px;height:${Math.max(0, rect.bottom - rect.top)}px`;
    shades[2].style.cssText = `left:${rect.right}px;top:${rect.top}px;width:${Math.max(0, viewportWidth - rect.right)}px;height:${Math.max(0, rect.bottom - rect.top)}px`;
    shades[3].style.cssText = `left:0;top:${rect.bottom}px;width:100%;height:${Math.max(0, viewportHeight - rect.bottom)}px`;
    spotlight.hidden = false;
    spotlight.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.right - rect.left}px;height:${rect.bottom - rect.top}px`;

    const bubbleRect = bubble.getBoundingClientRect();
    let left = rect.left + (rect.right - rect.left - bubbleRect.width) / 2;
    left = Math.min(viewportWidth - bubbleRect.width - margin, Math.max(margin, left));
    const fitsBelow = rect.bottom + gap + bubbleRect.height <= viewportHeight - margin;
    let top = fitsBelow ? rect.bottom + gap : rect.top - bubbleRect.height - gap;
    if (top < margin) top = Math.min(viewportHeight - bubbleRect.height - margin, rect.bottom + gap);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${Math.max(margin, top)}px`;
    bubble.dataset.arrow = fitsBelow || top >= rect.bottom ? "top" : "bottom";
}

async function saveOnboardingCompleted() {
    try {
        await api("/auth/onboarding", { method: "PUT", body: JSON.stringify({ completed: true }) });
        currentUser.onboarding_completed = true;
        closeOnboarding();
    } catch (error) { toast(error.message, true); }
}

async function showOnboardingStep(index, direction = 1) {
    const steps = onboardingSteps();
    if (index < 0 || index >= steps.length) return saveOnboardingCompleted();
    removeOnboardingListeners();
    onboardingStepIndex = index;
    const step = steps[index];
    if (step.view && currentView !== step.view) {
        navigateTo(step.view);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    const target = visibleOnboardingTarget(step.selector);
    if (step.selector && !target) {
        const next = index + direction;
        if (next >= 0 && next < steps.length) return showOnboardingStep(next, direction);
    }

    const root = document.getElementById("onboarding-root");
    if (!root) return;
    const stepItems = Array.isArray(step.items) && step.items.length
        ? `<ul class="onboarding-list">${step.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : "";
    root.innerHTML = `<div class="onboarding-shade"></div><div class="onboarding-shade"></div><div class="onboarding-shade"></div><div class="onboarding-shade"></div><div class="onboarding-spotlight" aria-hidden="true"></div><section class="onboarding-bubble" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-text" tabindex="-1"><div class="onboarding-progress">Étape ${index + 1} sur ${steps.length}</div><h2 id="onboarding-title">${escapeHtml(step.title)}</h2><p id="onboarding-text">${escapeHtml(step.text)}</p>${stepItems}<div class="onboarding-actions"><button class="secondary" id="skip-onboarding" type="button">Passer le tutoriel</button><div>${index > 0 ? '<button class="secondary" id="previous-onboarding" type="button">Précédent</button>' : ""}<button class="primary" id="next-onboarding" type="button">${index === steps.length - 1 ? "Terminer" : "Suivant"}</button></div></div></section>`;
    const bubble = root.querySelector(".onboarding-bubble");
    document.getElementById("skip-onboarding").addEventListener("click", saveOnboardingCompleted);
    document.getElementById("previous-onboarding")?.addEventListener("click", () => showOnboardingStep(index - 1, -1));
    document.getElementById("next-onboarding").addEventListener("click", () => index === steps.length - 1 ? saveOnboardingCompleted() : showOnboardingStep(index + 1, 1));
    onboardingKeyHandler = (event) => {
        if (event.key === "Escape") { event.preventDefault(); saveOnboardingCompleted(); return; }
        if (event.key !== "Tab") return;
        const focusable = [...bubble.querySelectorAll("button:not(:disabled)")];
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    };
    onboardingPositionHandler = () => requestAnimationFrame(() => positionOnboarding(target));
    document.addEventListener("keydown", onboardingKeyHandler);
    window.addEventListener("resize", onboardingPositionHandler);
    document.addEventListener("scroll", onboardingPositionHandler, true);
    positionOnboarding(target);
    requestAnimationFrame(() => (document.getElementById("next-onboarding") || bubble).focus());
}

function startOnboarding() {
    closeModal(true);
    onboardingStepIndex = 0;
    showOnboardingStep(0);
}

function modal(title, content) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header class="modal-head"><h2 id="modal-title">${escapeHtml(title)}</h2><button class="close icon-only" id="close-modal" type="button" aria-label="Fermer" title="Fermer">${icon("close")}</button></header>${content}</section></div>`;
    const dialog = root.querySelector(".modal");
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')];
    const keyHandler = (event) => {
        if (event.key === "Escape") return closeModal();
        if (event.key !== "Tab") return;
        const items = focusable(); if (!items.length) return;
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    root._keyHandler = keyHandler;
    root._dirty = false;
    document.addEventListener("keydown", keyHandler);
    dialog.addEventListener("input", () => { root._dirty = true; });
    dialog.addEventListener("change", () => { root._dirty = true; });
    dialog.addEventListener("submit", () => { root._dirty = false; }, true);
    root.querySelector(".modal-backdrop").addEventListener("mousedown", (event) => { if (event.target.classList.contains("modal-backdrop")) closeModal(); });
    document.getElementById("close-modal").addEventListener("click", closeModal);
    requestAnimationFrame(() => (focusable()[0] || dialog).focus());
}
function closeModal(force = false) { closeTemplateSectionDrawer(); const root = document.getElementById("modal-root"); if (!force && root?._dirty && !confirm("Fermer sans enregistrer les modifications ?")) return; if (root?._keyHandler) document.removeEventListener("keydown", root._keyHandler); if (root) { root._dirty = false; root.innerHTML = ""; } }

function emailConnectionCard(connection) {
    const provider = emailMailStatus.providers.find((item) => item.id === connection.provider)?.label || connection.provider;
    const tested = connection.last_test_at ? new Date(connection.last_test_at).toLocaleString("fr-FR") : "Jamais";
    return `<article class="settings-intro"><strong>${escapeHtml(provider)} · ${escapeHtml(connection.email)}</strong><p>Statut : ${connection.status === "ACTIVE" ? "Connecté" : "Attention requise"} · Dernier test : ${escapeHtml(tested)}</p>${connection.last_error ? `<p class="muted">${escapeHtml(connection.last_error)}</p>` : ""}<div class="grid2">${connection.id ? `<button class="secondary" type="button" data-test-email="${connection.id}">Tester la connexion</button>` : ""}${connection.connection_type === "SMTP" ? `<button class="secondary" type="button" data-edit-email="${connection.id}">Modifier</button>` : ""}</div>${connection.id ? `<button class="danger wide" type="button" data-delete-email="${connection.id}">Déconnecter / supprimer</button>` : ""}</article>`;
}

function openSmtpConnection(existing = null) {
    const providers = emailMailStatus.providers || [];
    const currentProvider = existing?.provider || "orange";
    modal(existing ? "Modifier le compte SMTP" : "Configurer une autre adresse e-mail", `<form id="smtp-connection-form">
      <div class="field"><label>Fournisseur</label><select name="provider">${providers.map((item)=>`<option value="${item.id}" ${item.id===currentProvider?"selected":""}>${escapeHtml(item.label)}</option>`).join("")}</select><span class="field-help" id="smtp-provider-help"></span></div>
      <div class="grid2">${field("Adresse e-mail","email","email",true,existing?.email||"")}${field("Nom d’expéditeur","sender_name","text",false,existing?.sender_name||"")}</div>
      <div class="grid2">${field("Serveur SMTP","smtp_host","text",true,existing?.smtp_host||"")}${field("Port","smtp_port","number",true,existing?.smtp_port||587)}</div>
      <div class="grid2"><div class="field"><label>Sécurité</label><select name="smtp_security"><option value="TLS">SSL/TLS</option><option value="STARTTLS">STARTTLS</option><option value="NONE">Aucune (développement uniquement)</option></select></div><label class="setting-check"><input name="smtp_auth_required" type="checkbox" ${existing?.smtp_auth_required===false?"":"checked"}> Authentification requise</label></div>
      ${field("Nom d’utilisateur SMTP","smtp_username","text",false,existing?.smtp_username||"")}
      <div class="field"><label>${existing ? "Nouveau mot de passe SMTP (laisser vide pour conserver l’actuel)" : "Mot de passe SMTP ou mot de passe d’application"}</label><input name="smtp_password" type="password" autocomplete="new-password" ${existing?"":"required"}></div>
      <p class="muted">Le secret est chiffré côté serveur et ne sera jamais réaffiché.</p><button class="primary wide" type="submit">Enregistrer</button></form>`);
    const form=document.getElementById("smtp-connection-form");
    const applyPreset=()=>{ const preset=providers.find((item)=>item.id===form.elements.provider.value); if(!preset)return; if(!existing||form.elements.provider.value!==existing.provider){ form.elements.smtp_host.value=preset.host; form.elements.smtp_port.value=preset.port; form.elements.smtp_security.value=preset.security; form.elements.smtp_auth_required.checked=preset.authRequired; if(preset.usernameIsEmail)form.elements.smtp_username.value=form.elements.email.value; } document.getElementById("smtp-provider-help").textContent=preset.help||""; };
    form.elements.smtp_security.value=existing?.smtp_security||"STARTTLS"; applyPreset();
    form.elements.provider.addEventListener("change",applyPreset); form.elements.email.addEventListener("input",()=>{ const preset=providers.find((item)=>item.id===form.elements.provider.value); if(preset?.usernameIsEmail)form.elements.smtp_username.value=form.elements.email.value; });
    form.addEventListener("submit",async(event)=>{ event.preventDefault(); const button=form.querySelector('button[type="submit"]'); await withBusy(button,async()=>{ try { const values=Object.fromEntries(new FormData(form)); values.smtp_port=Number(values.smtp_port); values.smtp_auth_required=form.elements.smtp_auth_required.checked; await api(existing?`/email-connections/${existing.id}`:"/email-connections/smtp",{method:existing?"PUT":"POST",body:JSON.stringify(values)}); emailMailStatus=await api("/email-connections"); closeModal(); openSettings(); toast("Compte e-mail enregistré. Testez maintenant la connexion."); } catch(error){ toast(error.message,true); } }); });
}

function openSettings() {
    const activeTheme = document.documentElement.dataset.theme || "classic";
    const reportSettings = currentEntreprise?.report_settings || {};
    const reportNumberYear = new Date().getFullYear();
    const pwaSettings = isStandaloneMode()
        ? `<div class="pwa-help"><strong>Intervium est installée</strong><p>L'application fonctionne actuellement en mode autonome.</p></div>`
        : isIosDevice()
          ? `<div class="pwa-help"><strong>Installer sur iPhone ou iPad</strong><p>Dans Safari, touchez Partager puis « Ajouter à l'écran d'accueil ».</p></div>`
          : `<div class="pwa-help"><strong>Application installable</strong><p>Installez Intervium pour l'ouvrir comme une application.</p><button class="primary install-button" type="button" data-install-app hidden>Installer Intervium</button></div>`;
    const companySettings = currentUser.role === "ADMIN" ? `
        <form id="company-report-settings" class="company-branding">
          <div class="panel-head"><div><h2>Identité des rapports PDF</h2><p class="muted">Ces informations remplacent entièrement la marque Intervium dans vos documents.</p></div></div>
          <div class="company-logo-preview">${currentEntreprise?.logo_url ? `<img src="${companyLogoSourceUrl()}" alt="Logo actuel de l’entreprise">` : `<span class="muted">Aucun logo d’entreprise</span>`}</div>
          ${fileUpload({ id: "company-logo-file", name: "logo", label: "Logo de l’entreprise", help: "PNG, JPEG ou WebP", accept: "image/png,image/jpeg,image/webp", maxMb: 5 })}
          ${currentEntreprise?.logo_url ? `<button class="danger" id="remove-company-logo" type="button">${icon("trash")} Supprimer le logo actuel</button>` : ""}
          <div class="grid2"><div class="field"><label>Nom affiché</label><input name="display_name" maxlength="150" required value="${escapeHtml(reportSettings.display_name || currentEntreprise?.nom || "")}"></div><div class="field"><label>Identifiant légal / SIRET</label><input name="registration" maxlength="120" value="${escapeHtml(reportSettings.registration || "")}"></div></div>
          <div class="field"><label>Adresse</label><textarea name="address" rows="2" maxlength="300">${escapeHtml(reportSettings.address || "")}</textarea></div>
          <div class="grid2"><div class="field"><label>Téléphone</label><input name="phone" maxlength="40" value="${escapeHtml(reportSettings.phone || "")}"></div><div class="field"><label>Email</label><input name="email" type="email" maxlength="254" value="${escapeHtml(reportSettings.email || "")}"></div></div>
          <div class="field"><label>Site internet</label><input name="website" maxlength="200" placeholder="https://www.mon-entreprise.fr" value="${escapeHtml(reportSettings.website || "")}"></div>
          <div class="grid2"><div class="field color-field"><label>Couleur d’accent</label><input name="accent_color" type="color" value="${escapeHtml(reportSettings.accent_color || "#1d4ed8")}"></div><div class="field"><label>Style d’en-tête</label><select name="header_style"><option value="minimal" ${(reportSettings.header_style || "minimal") === "minimal" ? "selected" : ""}>Minimal - logo sur fond blanc</option><option value="band" ${reportSettings.header_style === "band" ? "selected" : ""}>Bandeau coloré</option><option value="none" ${reportSettings.header_style === "none" ? "selected" : ""}>Sans en-tête</option></select></div></div>
          <div class="field"><label>Taille du logo dans le PDF (%)</label><input name="logo_scale" type="number" min="60" max="140" value="${escapeHtml(reportSettings.logo_scale || 100)}"><span class="field-help">Réglage global entreprise, de 60 % à 140 %.</span></div>
          <div class="field"><label>Dernier numéro papier utilisé en ${reportNumberYear}</label><input name="report_number_start_sequence" type="number" min="0" max="9999" value="${escapeHtml(reportSettings.report_number_start_sequence || 0)}"><span class="field-help">Exemple : indiquez 120 si le dernier rapport papier est le n° 120 ; le prochain rapport Intervium sera ${reportNumberYear}-0121. La numérotation repart par année.</span></div>
          <div class="field"><label>Texte du pied de page</label><input name="footer_text" maxlength="240" placeholder="Ex. Merci pour votre confiance" value="${escapeHtml(reportSettings.footer_text || "")}"></div>
          <div class="field"><label>Texte par défaut des e-mails de rapport</label><textarea name="default_email_message" rows="6" maxlength="1200" placeholder="Bonjour,\n\nVeuillez trouver ci-joint le rapport « {titre} ».\n\nCordialement,\n{entreprise}">${escapeHtml(reportSettings.default_email_message || "")}</textarea><span class="field-help">Variables disponibles : {titre}, {numero}, {client}, {entreprise}.</span></div>
          <div class="field"><label><input name="show_intervium" type="checkbox" ${reportSettings.show_intervium ? "checked" : ""}> Afficher discrètement « Généré avec Intervium »</label></div>
          <button class="primary wide" type="submit">Enregistrer l’identité des PDF</button>
        </form>` : "";
    const developerSettings = currentUser.is_super_developer ? `<section class="settings-intro"><strong>Super-développeur</strong><p>Entreprise consultée : <strong>${escapeHtml(currentEntreprise?.nom || "")}</strong></p><div class="field"><label>Ouvrir une session d’assistance (30 minutes)</label><select id="developer-company"><option value="">Choisir une entreprise</option>${platformCompanies.map((company) => `<option value="${company.id}" ${String(company.id) === String(currentUser.support_session?.company_id) ? "selected" : ""}>${escapeHtml(company.nom)}</option>`).join("")}</select></div>${currentUser.support_session && !currentUser.support_session.write_enabled ? '<button class="secondary wide" id="elevate-support" type="button">Autoriser l’écriture pendant 10 minutes</button>' : ""}<p class="muted">Lecture seule par défaut. Toutes les ouvertures et élévations sont journalisées. Les suppressions et la gestion des accès restent interdites.</p></section>` : "";
    const personalSignatureSettings = ["ADMIN", "TECHNICIEN"].includes(currentUser.role) ? `
        <section class="settings-intro">
          <strong>Signature technicien</strong>
          <p class="muted">Elle sera utilisée automatiquement dans les modèles qui contiennent le bloc « Signature technicien ».</p>
          ${currentUser.signature_url ? `<div class="saved-signature"><img src="${userSignatureSourceUrl(currentUser.id)}" alt="Signature technicien enregistrée"><span class="field-help">Signature mémorisée pour votre compte.</span></div>` : `<p class="muted">Aucune signature mémorisée pour votre compte.</p>`}
          <canvas class="canvas" id="user-signature-canvas" aria-label="Zone de dessin pour votre signature technicien"></canvas>
          <div class="actions"><button class="secondary" type="button" id="clear-user-signature">Effacer</button><button class="primary" type="button" id="save-user-signature">Enregistrer ma signature</button>${currentUser.signature_url ? `<button class="danger" type="button" id="delete-user-signature">Supprimer ma signature</button>` : ""}</div>
        </section>` : "";
    const accountDeletionScope = currentUser.role === "ADMIN"
        ? "votre compte administrateur, l’entreprise et toutes les données associées : clients, matériels, rapports, photos, signatures, modèles, documents, notifications et connexions e-mail"
        : "votre compte, vos connexions, notifications et données personnelles associées. Les rapports déjà créés dans l’entreprise seront conservés mais ne vous seront plus assignés";
    const accountDeletionSettings = !currentUser.is_super_developer && !currentUser.support_session ? `
        <form id="delete-account-settings" class="settings-intro">
          <strong>Zone dangereuse</strong>
          <p class="muted">Cette action supprimera définitivement ${accountDeletionScope}. Elle est irréversible.</p>
          <div class="field"><label>Mot de passe actuel</label><input name="current_password" type="password" autocomplete="current-password" required></div>
          <div class="field"><label>Confirmation</label><input name="confirmation" autocomplete="off" placeholder="Tapez SUPPRIMER" required><span class="field-help">Tapez exactement SUPPRIMER pour confirmer.</span></div>
          <button class="danger wide" type="submit">${icon("trash")} Supprimer définitivement mon compte</button>
        </form>` : "";
    modal("Paramètres", `
        ${developerSettings}
        <div class="settings-intro">
            <strong>Personnalisez Intervium</strong>
            <div>Choisissez l’apparence la plus confortable pour votre environnement de travail.</div>
        </div>
        <div class="theme-options" role="radiogroup" aria-label="Thème de l’application">
            <label class="theme-option"><input type="radio" name="visual-theme" value="classic" ${activeTheme === "classic" ? "checked" : ""}><span class="theme-option-card"><span class="theme-option-icon">${icon("sun")}</span><span>Classique</span></span></label>
            <label class="theme-option"><input type="radio" name="visual-theme" value="glass" ${activeTheme === "glass" ? "checked" : ""}><span class="theme-option-card"><span class="theme-option-icon">${icon("glass")}</span><span>Liquid Glass</span></span></label>
            <label class="theme-option"><input type="radio" name="visual-theme" value="dark" ${activeTheme === "dark" ? "checked" : ""}><span class="theme-option-card"><span class="theme-option-icon">${icon("moon")}</span><span>Sombre</span></span></label>
        </div>
        <p class="muted">Cette préférence visuelle est enregistrée uniquement sur cet appareil.</p>
        <form id="password-settings" class="settings-intro">
          <strong>Sécurité du compte</strong>
          <div class="field"><label>Mot de passe actuel</label><input name="current_password" type="password" autocomplete="current-password" required></div>
          <div class="field"><label>Nouveau mot de passe</label><input name="new_password" type="password" minlength="8" autocomplete="new-password" required></div>
          <div class="field"><label>Confirmer le nouveau mot de passe</label><input name="confirm_password" type="password" minlength="8" autocomplete="new-password" required></div>
          <button class="secondary wide" type="submit">Modifier mon mot de passe</button>
        </form>
        ${personalSignatureSettings}
        <section class="settings-intro">
          <strong>Comptes e-mail connectés</strong>
          <p class="muted">L’adresse d’expédition reste celle du compte réellement connecté.</p>
          <div class="grid2"><button class="primary" id="connect-google" type="button" ${emailMailStatus.configuration?.google?.enabled ? "" : "disabled"}>Continuer avec Google</button><button class="primary" id="connect-microsoft" type="button" ${emailMailStatus.configuration?.microsoft?.enabled ? "" : "disabled"}>Continuer avec Microsoft</button></div>
          <button class="secondary wide" id="connect-smtp" type="button">Configurer une autre adresse e-mail</button>
          <div class="email-connections">${emailMailStatus.connections.length ? emailMailStatus.connections.map(emailConnectionCard).join("") : '<p class="muted">Aucun compte connecté.</p>'}</div>
        </section>
        <section class="settings-intro"><strong>Navigation mobile</strong><p>Choisissez l’ordre des raccourcis et les rubriques placées dans « Plus ».</p><button class="secondary wide" id="customize-mobile-nav" type="button">${icon("more")} Personnaliser la navigation</button></section>
        <section class="settings-intro"><strong>Aide et prise en main</strong><p>Revoir la présentation des principales fonctions d’Intervium.</p><button class="primary wide" id="restart-onboarding" type="button">Relancer le tutoriel</button></section>
        ${pwaSettings}
        ${companySettings}
        ${currentUser.role === "ADMIN" ? '<section class="settings-intro"><strong>État du service</strong><p>Consultez l’usage de la base, du stockage et la version serveur.</p><button class="secondary wide" id="open-admin-status" type="button">Afficher l’état interne</button></section>' : ""}
        ${accountDeletionSettings}
        <section class="settings-intro" aria-labelledby="about-intervium"><strong id="about-intervium">À propos</strong><p>Intervium — gestion des interventions, rapports et documents métier.</p><p class="muted">Version ${escapeHtml(appVersion)} · Conçu par Sylvain Lecoeuvre</p></section>
    `);

    document.querySelectorAll('input[name="visual-theme"]').forEach((input) => input.addEventListener("change", (event) => {
        const theme = setTheme(event.target.value);
        toast(({ classic: "Thème classique activé.", glass: "Mode Liquid Glass activé.", dark: "Thème sombre activé." })[theme]);
    }));
    document.getElementById("developer-company")?.addEventListener("change", async (event) => {
        if (!event.target.value) return;
        try { await api("/auth/support-session", { method: "POST", body: JSON.stringify({ entreprise_id: Number(event.target.value) }) }); window.location.reload(); }
        catch (error) { toast(error.message, true); }
    });
    document.getElementById("elevate-support")?.addEventListener("click", async () => {
        const password = prompt("Confirmez votre mot de passe pour autoriser l’écriture pendant 10 minutes.");
        if (!password) return;
        const totpCode = prompt("Saisissez le code à 6 chiffres de votre application d’authentification.");
        if (!totpCode) return;
        try { await api("/auth/support-session/elevate", { method: "POST", body: JSON.stringify({ password, totp_code: totpCode }) }); window.location.reload(); }
        catch (error) { toast(error.message, true); }
    });
    document.querySelectorAll("[data-install-app]").forEach((button) => button.addEventListener("click", installIntervium));
    document.getElementById("customize-mobile-nav")?.addEventListener("click", openMobileNavigationCustomizer);
    document.getElementById("restart-onboarding")?.addEventListener("click", async (event) => {
        await withBusy(event.currentTarget, async () => {
            try {
                await api("/auth/onboarding", { method: "PUT", body: JSON.stringify({ completed: false }) });
                currentUser.onboarding_completed = false;
                closeModal(true);
                startOnboarding();
            } catch (error) { toast(error.message, true); }
        });
    });
    document.getElementById("open-admin-status")?.addEventListener("click", async () => {
        try {
            const status = await api("/admin/status");
            modal("État interne", `<div class="stats"><div class="stat"><span class="muted">Base Neon</span><strong>${escapeHtml((status.database_bytes / 1024 / 1024).toFixed(1))} Mo</strong></div><div class="stat"><span class="muted">Entreprises</span><strong>${status.companies}</strong></div><div class="stat"><span class="muted">Utilisateurs actifs</span><strong>${status.active_users}</strong></div><div class="stat"><span class="muted">Rapports</span><strong>${status.reports}</strong></div></div><p>Stockage : <strong>${escapeHtml(status.storage_driver)}</strong>${status.cloudinary?.credits_used != null ? ` · ${escapeHtml(status.cloudinary.credits_used)} / ${escapeHtml(status.cloudinary.credits_limit || "—")} crédits` : ""}</p><p>Sauvegardes Neon : <strong>${status.backups_configured ? "confirmées" : "à configurer et tester"}</strong></p><p>Version serveur : <strong>${escapeHtml(status.version)}</strong> · Disponibilité du processus : ${Math.floor(status.uptime_seconds / 60)} min</p>`);
        } catch (error) { toast(error.message, true); }
    });
    document.getElementById("connect-google")?.addEventListener("click", async (event) => withBusy(event.currentTarget, async () => {
        try { const result = await api("/email-connections/google/authorize"); window.location.assign(result.url); }
        catch (error) { toast(error.message, true); }
    }));
    document.getElementById("connect-microsoft")?.addEventListener("click", async (event) => withBusy(event.currentTarget, async () => { try { const result=await api("/email-connections/microsoft/authorize"); window.location.assign(result.url); } catch(error){ toast(error.message,true); } }));
    document.getElementById("connect-smtp")?.addEventListener("click", () => openSmtpConnection());
    document.querySelectorAll("[data-test-email]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => { try { await api(`/email-connections/${button.dataset.testEmail}/test`,{method:"POST",body:"{}"}); emailMailStatus=await api("/email-connections"); openSettings(); toast("Connexion vérifiée."); } catch(error){ toast(error.message,true); } })));
    document.querySelectorAll("[data-edit-email]").forEach((button) => button.addEventListener("click", () => openSmtpConnection(emailMailStatus.connections.find((item)=>String(item.id)===button.dataset.editEmail))));
    document.querySelectorAll("[data-delete-email]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => { if(!confirm("Déconnecter ce compte e-mail ?"))return; try { await api(`/email-connections/${button.dataset.deleteEmail}`,{method:"DELETE"}); emailMailStatus=await api("/email-connections"); openSettings(); toast("Compte e-mail déconnecté."); } catch(error){ toast(error.message,true); } })));
    document.getElementById("password-settings")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const values = Object.fromEntries(new FormData(form));
        if (values.new_password !== values.confirm_password) return toast("Les deux nouveaux mots de passe ne correspondent pas.", true);
        const button = form.querySelector('button[type="submit"]');
        await withBusy(button, async () => {
            try {
                await api("/auth/password", { method: "PUT", body: JSON.stringify({ current_password: values.current_password, new_password: values.new_password }) });
                form.reset();
                toast("Mot de passe modifié.");
            } catch (error) { toast(error.message, true); }
        });
    });
    bindSignatureCanvas({
        canvas: document.getElementById("user-signature-canvas"),
        clearButton: document.getElementById("clear-user-signature"),
        saveButton: document.getElementById("save-user-signature"),
        onEmpty: () => toast("La signature est vide.", true),
        onSave: async ({ event, signatureData }) => {
            await withBusy(event.currentTarget, async () => {
                try {
                    const result = await api("/uploads/user-signature/me", { method: "POST", body: JSON.stringify({ signatureData }) });
                    currentUser.signature_url = result.signature_url;
                    openSettings();
                    toast("Signature technicien enregistrée.");
                } catch (error) { toast(error.message, true); }
            });
        },
    });
    document.getElementById("delete-user-signature")?.addEventListener("click", (event) => withBusy(event.currentTarget, async () => {
        if (!confirm("Supprimer votre signature technicien mémorisée ?")) return;
        try {
            await api("/uploads/user-signature/me", { method: "DELETE" });
            currentUser.signature_url = null;
            openSettings();
            toast("Signature technicien supprimée.");
        } catch (error) { toast(error.message, true); }
    }));
    document.getElementById("delete-account-settings")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const values = Object.fromEntries(new FormData(form));
        if (values.confirmation !== "SUPPRIMER") return toast("Tapez exactement SUPPRIMER pour confirmer.", true);
        const warning = currentUser.role === "ADMIN"
            ? "Supprimer définitivement votre entreprise et toutes ses données ? Cette action est irréversible."
            : "Supprimer définitivement votre compte ? Cette action est irréversible.";
        if (!confirm(warning)) return;
        const button = form.querySelector('button[type="submit"]');
        await withBusy(button, async () => {
            try {
                await api("/auth/account", {
                    method: "DELETE",
                    body: JSON.stringify({
                        current_password: values.current_password,
                        confirmation: values.confirmation,
                    }),
                });
                currentUser = null;
                currentEntreprise = null;
                closeModal(true);
                showAuth();
                toast("Compte supprimé définitivement.");
            } catch (error) { toast(error.message, true); }
        });
    });
    updateInstallUi();
    document.getElementById("company-report-settings")?.addEventListener("submit", saveCompanyReportSettings);
    bindFileUpload(document.querySelector("#company-logo-file")?.closest("[data-file-upload]"), { onChange: (file, component) => {
        const input = component.querySelector("input");
        if (!file) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
            input.setCustomValidity("Utilisez une image PNG, JPEG ou WebP.");
            component.classList.add("is-error"); component.querySelector(".file-upload-status").textContent = input.validationMessage;
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            input.setCustomValidity("Le logo dépasse la limite de 5 Mo.");
            component.classList.add("is-error"); component.querySelector(".file-upload-status").textContent = input.validationMessage;
            return;
        }
        const preview = document.querySelector(".company-logo-preview");
        const objectUrl = URL.createObjectURL(file);
        preview.classList.add("logo-preview-pending");
        preview.innerHTML = `<img src="${objectUrl}" alt="Aperçu du nouveau logo"><span class="muted">Aperçu avant enregistrement</span>`;
    }});
    document.getElementById("remove-company-logo")?.addEventListener("click", (event) => withBusy(event.currentTarget, async () => {
        if (!confirm("Supprimer le logo des prochains rapports PDF ?")) return;
        try {
            const result = await api("/uploads/company-logo", { method: "DELETE" });
            currentEntreprise = result.entreprise;
            openSettings();
            toast("Logo supprimé des rapports.");
        } catch (error) { toast(error.message, true); }
    }));
}

function openMobileNavigationCustomizer() {
    const render = () => {
        const items = orderedMobileNavigationItems();
        const visibleCount = currentUser.role === "CLIENT" ? items.length : 4;
        closeModal();
        modal("Navigation mobile", `<p class="muted">Les ${visibleCount} premières rubriques apparaissent dans la barre. Les suivantes restent accessibles dans « Plus ».</p><div class="nav-customizer">${items.map((item, index) => `${index === visibleCount ? '<div class="nav-customizer-divider">Dans « Plus »</div>' : ""}<div class="nav-customizer-row ${index >= visibleCount ? "is-more" : ""}"><span>${icon(item.icon)}<strong>${escapeHtml(item.label)}</strong></span><div class="actions"><button class="secondary icon-only" type="button" data-nav-up="${index}" ${index === 0 ? "disabled" : ""} aria-label="Monter ${escapeHtml(item.label)}" title="Monter">↑</button><button class="secondary icon-only" type="button" data-nav-down="${index}" ${index === items.length - 1 ? "disabled" : ""} aria-label="Descendre ${escapeHtml(item.label)}" title="Descendre">↓</button></div></div>`).join("")}</div><div class="actions"><button class="secondary" id="reset-mobile-navigation" type="button">Réinitialiser</button><button class="primary" id="save-mobile-navigation" type="button">Enregistrer</button></div>`);
        const move = (index, direction) => { const target = index + direction; if (target < 0 || target >= items.length) return; [items[index], items[target]] = [items[target], items[index]]; try { localStorage.setItem(mobileNavStorageKey(), JSON.stringify(items.map((item) => item.view))); } catch {} render(); };
        document.querySelectorAll("[data-nav-up]").forEach((button) => button.addEventListener("click", () => move(Number(button.dataset.navUp), -1)));
        document.querySelectorAll("[data-nav-down]").forEach((button) => button.addEventListener("click", () => move(Number(button.dataset.navDown), 1)));
        document.getElementById("reset-mobile-navigation").addEventListener("click", () => { try { localStorage.removeItem(mobileNavStorageKey()); } catch {} render(); });
        document.getElementById("save-mobile-navigation").addEventListener("click", () => { closeModal(); renderMain(currentView); toast("Navigation mobile enregistrée."); });
    };
    render();
}

async function saveCompanyReportSettings(event) {
    event.preventDefault();
    // currentTarget n'est garanti que pendant l'exécution synchrone du listener.
    // On conserve donc le formulaire avant le premier await.
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) {
        toast("Le formulaire de paramètres est indisponible. Rechargez la page.", true);
        return;
    }
    const button = form.querySelector('button[type="submit"]');
    await withBusy(button, async () => {
        try {
            const logoFile = document.getElementById("company-logo-file")?.files[0];
            if (logoFile) {
                if (!["image/png", "image/jpeg", "image/webp"].includes(logoFile.type)) {
                    throw new Error("Format refusé. Utilisez une image PNG, JPEG ou WebP.");
                }
                if (logoFile.size > 5 * 1024 * 1024) {
                    throw new Error("Le logo dépasse la limite de 5 Mo.");
                }
                const logoData = new FormData();
                logoData.append("logo", logoFile);
                const logoResult = await api("/uploads/company-logo", { method: "POST", body: logoData });
                currentEntreprise = logoResult.entreprise;
            }
            const values = Object.fromEntries(new FormData(form));
            values.logo_scale = Number(values.logo_scale || 100);
            values.report_number_start_sequence = Number(values.report_number_start_sequence || 0);
            values.show_intervium = form.elements.show_intervium.checked;
            const result = await api("/auth/company", {
                method: "PUT",
                body: JSON.stringify({ report_settings: values }),
            });
            currentEntreprise = result.entreprise;
            closeModal();
            toast("Identité des rapports PDF enregistrée.");
        } catch (error) { toast(error.message, true); }
    });
}

const TEMPLATE_FIELD_TYPES = [
    ["title", "Titre"], ["text", "Texte court"], ["textarea", "Zone de texte"],
    ["date", "Date et heure"], ["number", "Numérique"], ["checkbox", "Case à cocher"],
    ["select", "Liste de choix"], ["client", "Client"], ["equipment", "Matériel client"],
    ["photo", "Photo"], ["multi_photo", "Multi-photos"], ["event_photos", "Photos événement"],
    ["signature", "Signature"], ["electronic_signature", "Signature électronique"],
    ["technician_signature", "Signature technicien"],
    ["creator", "Profil du créateur"], ["gps", "Position GPS"], ["address", "Adresse"],
    ["table", "Tableau"], ["price_table", "Tableau de prix"], ["page_break", "Saut de page"],
];
const TABLE_COLUMN_TYPES = [
    ["text", "Texte"], ["textarea", "Texte long"], ["integer", "Nombre entier"],
    ["decimal", "Nombre décimal"], ["currency", "Montant"], ["percentage", "Pourcentage"],
    ["date", "Date"], ["time", "Heure"], ["datetime", "Date et heure"],
    ["boolean", "Oui / Non"], ["checkbox", "Case à cocher"], ["select", "Liste"],
    ["photo", "Photo"], ["row_number", "N° de ligne"], ["calculated", "Calcul automatique"],
];

function normalizeTableColumn(column, index, priceTable = false) {
    const source = typeof column === "string" ? { label: column } : (column || {});
    const fallbackType = priceTable && index === 1 ? "decimal" : priceTable && index === 2 ? "currency" : priceTable && index === 3 ? "percentage" : "text";
    return {
        key: String(source.key || `c${index}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || `c${index}`,
        label: String(source.label || source.name || `Colonne ${index + 1}`).slice(0, 80),
        type: TABLE_COLUMN_TYPES.some(([type]) => type === source.type) ? source.type : fallbackType,
        required: source.required === true,
        width: Math.min(12, Math.max(1, Number(source.width) || 3)),
        align: ["left", "center", "right"].includes(source.align) ? source.align : "left",
        visibleForm: source.visibleForm !== false,
        visiblePdf: source.visiblePdf !== false,
        defaultValue: source.defaultValue ?? "",
        options: Array.isArray(source.options) ? source.options.map(String).slice(0, 40) : [],
        allowOther: source.allowOther === true,
        min: source.min ?? null,
        max: source.max ?? null,
        decimals: Math.min(4, Math.max(0, Number(source.decimals) || 0)),
        unit: String(source.unit || "").slice(0, 20),
        calculation: ["sum", "multiply", "average", "count"].includes(source.calculation) ? source.calculation : "",
    };
}

function normalizeTemplateSection(section) {
    const normalized = { ...newTemplateSection(section.type, section.label, section.key), ...section };
    normalized.options = [...(section.options || [])];
    normalized.columns = (section.columns || []).map((column, index) => normalizeTableColumn(column, index, section.type === "price_table"));
    normalized.defaultRows = Array.isArray(section.defaultRows) ? structuredClone(section.defaultRows).slice(0, 30) : [];
    normalized.listMode = ["select", "radio", "checkboxes", "segments"].includes(section.listMode) ? section.listMode : "select";
    normalized.multiple = section.multiple === true;
    normalized.allowOther = section.allowOther === true;
    normalized.showCheckmark = section.showCheckmark === true;
    normalized.allowAddRows = section.allowAddRows !== false;
    normalized.minRows = Math.max(0, Number(section.minRows) || 0);
    normalized.maxRows = Math.min(100, Math.max(normalized.minRows || 1, Number(section.maxRows) || 30));
    normalized.tableMode = ["table", "rows", "cards", "compact", "detailed"].includes(section.tableMode) ? section.tableMode : "table";
    return normalized;
}

function templatePdfConfiguration(existing) {
    const style = existing?.pdf_config?.fieldTitleStyle || {};
    return `<details class="template-preview"><summary>Configuration du PDF</summary><div class="grid2"><div class="field"><label for="pdf-margin">Marges (24 à 90 pt)</label><input id="pdf-margin" type="number" min="24" max="90" value="${existing?.pdf_config?.margin || 48}"></div><div class="field"><label for="pdf-title-size">Taille du titre</label><input id="pdf-title-size" type="number" min="14" max="28" value="${existing?.pdf_config?.titleSize || 20}"></div></div><div class="checkbox-options"><label><input id="pdf-show-header" type="checkbox" ${existing?.pdf_config?.showHeader !== false ? "checked" : ""}> Afficher l’en-tête</label><label><input id="pdf-show-client" type="checkbox" ${existing?.pdf_config?.showClient !== false ? "checked" : ""}> Informations client</label><label><input id="pdf-show-equipment" type="checkbox" ${existing?.pdf_config?.showEquipment !== false ? "checked" : ""}> Équipements</label><label><input id="pdf-show-photos" type="checkbox" ${existing?.pdf_config?.showPhotos !== false ? "checked" : ""}> Photos</label><label><input id="pdf-show-signature" type="checkbox" ${existing?.pdf_config?.showSignature !== false ? "checked" : ""}> Signature</label><label><input id="pdf-show-pages" type="checkbox" ${existing?.pdf_config?.showPageNumbers !== false ? "checked" : ""}> Numéros de page</label></div><div class="section-setting-group"><h3>Titres des champs du PDF</h3><div class="grid2"><div class="field color-field"><label for="pdf-field-title-color">Couleur du texte</label><input id="pdf-field-title-color" type="color" value="${escapeHtml(style.color || "#64748b")}"></div><div class="field"><label for="pdf-field-title-size">Taille</label><input id="pdf-field-title-size" type="number" min="7" max="14" value="${escapeHtml(style.size || 9)}"></div><div class="field"><label for="pdf-field-title-font">Police</label><select id="pdf-field-title-font"><option value="Helvetica" ${(style.font || "Helvetica") === "Helvetica" ? "selected" : ""}>Helvetica</option><option value="Times" ${style.font === "Times" ? "selected" : ""}>Times</option><option value="Courier" ${style.font === "Courier" ? "selected" : ""}>Courier</option></select></div><div class="field color-field"><label for="pdf-field-title-background">Fond coloré</label><input id="pdf-field-title-background" type="color" value="${escapeHtml(style.backgroundColor || "#ffffff")}"></div></div><div class="checkbox-options"><label><input id="pdf-field-title-bold" type="checkbox" ${style.bold !== false ? "checked" : ""}> Gras</label><label><input id="pdf-field-title-underline" type="checkbox" ${style.underline ? "checked" : ""}> Souligné</label><label><input id="pdf-field-title-background-enabled" type="checkbox" ${style.backgroundColor ? "checked" : ""}> Utiliser le fond coloré</label></div><p class="field-help">Réglage global pour tous les titres de champs de ce modèle.</p></div><div class="field"><label for="pdf-footer">Pied de page</label><input id="pdf-footer" maxlength="240" value="${escapeHtml(existing?.pdf_config?.footerText || "")}"></div></details>`;
}

function openTemplateEditor(id = null) {
    const existing = reportTemplates.find((template) => String(template.id) === String(id));
    templateDraftSections = (existing?.sections || []).map(normalizeTemplateSection);
    modal(existing ? "Configurer le modèle" : "Nouveau modèle de rapport", `<form id="template-form">
      ${field("Nom du modèle", "template-name", "text", true, existing?.nom || "")}
      <div class="field"><label for="template-description">Description</label><textarea id="template-description" rows="2">${escapeHtml(existing?.description || "")}</textarea></div>
      <div class="builder-palette">${TEMPLATE_FIELD_TYPES.map(([type, label]) => `<button type="button" class="secondary" data-add-template-field="${type}">＋ ${label}</button>`).join("")}</div>
      <div id="template-fields" class="template-fields"></div>
      ${templatePdfConfiguration(existing)}
      <button class="primary wide" type="submit">${existing ? "Enregistrer le modèle" : "Créer le modèle"}</button>
    </form><details class="template-preview"><summary>Prévisualiser le formulaire</summary><div id="template-preview" inert></div></details>`);
    renderTemplateDraft();
    document.querySelectorAll("[data-add-template-field]").forEach((button) => button.addEventListener("click", () => {
        const type = button.dataset.addTemplateField;
        const defaultLabel = TEMPLATE_FIELD_TYPES.find(([value]) => value === type)?.[1] || "Champ";
        templateDraftSections.push(newTemplateSection(type, defaultLabel));
        renderTemplateDraft();
    }));
    document.getElementById("template-name").addEventListener("input", renderTemplatePreview);
    document.getElementById("template-form").addEventListener("submit", (event) => saveTemplate(event, existing));
}

function newTemplateSection(type, label, key = null) {
    return {
        key: key || `champ_${Date.now()}_${templateDraftSections.length}`,
        type,
        label,
        required: false,
        options: ["select", "checkbox"].includes(type) ? ["Oui", "Non", "Non applicable"] : [],
        columns: type === "price_table" ? ["Désignation", "Quantité", "Prix HT", "TVA %"].map((column, index) => normalizeTableColumn(column, index, true)) : type === "table" ? ["Colonne 1", "Colonne 2"].map((column, index) => normalizeTableColumn(column, index)) : [],
        defaultRows: [], allowAddRows: true, minRows: 0, maxRows: 30, tableMode: "table",
        listMode: "select", multiple: false, allowOther: false, showCheckmark: false,
        placeholder: "",
        helpText: "",
        defaultValue: "",
        width: "full",
        rows: 4,
        min: null,
        max: null,
        step: 1,
        unit: "",
        dateMode: "date",
        maxPhotos: type === "photo" ? 1 : 5,
    };
}

function templateSpecificConfiguration(section, index) {
    const property = (name, value, kind = "text") => `data-template-property="${name}" data-template-index="${index}" data-value-kind="${kind}" value="${escapeHtml(value ?? "")}"`;
    const fields = [];
    if (["text", "textarea", "date", "number", "select", "address", "gps"].includes(section.type)) {
        fields.push(`<div class="field"><label>Texte indicatif</label><input ${property("placeholder", section.placeholder)} placeholder="Exemple affiché dans le champ"></div>`);
    }
    if (["text", "textarea", "date", "number", "select", "address"].includes(section.type)) {
        fields.push(`<div class="field"><label>Valeur par défaut</label><input ${property("defaultValue", section.defaultValue)}></div>`);
    }
    if (["select", "checkbox"].includes(section.type)) {
        fields.push(`<div class="field full"><label>Choix proposés (un par ligne)</label><textarea data-template-property="options" data-value-kind="lines" rows="6" placeholder="Conforme\nNon conforme\nNon applicable">${escapeHtml((section.options || []).join("\n"))}</textarea></div><div class="field"><label>Mode d’affichage</label><select data-template-property="listMode"><option value="select" ${section.listMode === "select" ? "selected" : ""}>Menu déroulant</option><option value="radio" ${section.listMode === "radio" ? "selected" : ""}>Boutons radio</option><option value="checkboxes" ${section.listMode === "checkboxes" ? "selected" : ""}>Cases à cocher</option><option value="segments" ${section.listMode === "segments" ? "selected" : ""}>Boutons segmentés</option></select></div><label class="setting-check"><input type="checkbox" data-template-property="multiple" ${section.multiple ? "checked" : ""}> Autoriser plusieurs réponses</label><label class="setting-check"><input type="checkbox" data-template-property="allowOther" ${section.allowOther ? "checked" : ""}> Ajouter le choix « Autre »</label>`);
        fields.push(`<label class="setting-check"><input type="checkbox" data-template-property="showCheckmark" ${section.showCheckmark ? "checked" : ""}> Afficher « √ » devant les choix dans le PDF</label>`);
    }
    if (section.type === "textarea") {
        fields.push(`<div class="field"><label>Nombre de lignes</label><input type="number" min="2" max="12" ${property("rows", section.rows || 4, "number")}></div>`);
    }
    if (section.type === "number") {
        fields.push(`<div class="field"><label>Minimum</label><input type="number" ${property("min", section.min, "nullable-number")}></div><div class="field"><label>Maximum</label><input type="number" ${property("max", section.max, "nullable-number")}></div><div class="field"><label>Pas</label><input type="number" min="0.001" step="0.001" ${property("step", section.step || 1, "number")}></div><div class="field"><label>Unité</label><input ${property("unit", section.unit)} placeholder="bar, °C, mm..."></div>`);
    }
    if (section.type === "date") {
        fields.push(`<div class="field"><label>Format</label><select data-template-property="dateMode" data-template-index="${index}"><option value="date" ${section.dateMode !== "datetime-local" ? "selected" : ""}>Date</option><option value="datetime-local" ${section.dateMode === "datetime-local" ? "selected" : ""}>Date et heure</option></select></div>`);
    }
    if (["table", "price_table"].includes(section.type)) {
        fields.push(`<div class="field full"><label>Colonnes du tableau</label><div class="advanced-column-list">${(section.columns || []).map((column, columnIndex) => `<article class="advanced-column" data-column-index="${columnIndex}"><div class="advanced-column-head"><strong>${escapeHtml(column.label)}</strong><span class="badge off">${escapeHtml(TABLE_COLUMN_TYPES.find(([type]) => type === column.type)?.[1] || column.type)}</span></div><div class="grid2"><div class="field"><label>Nom</label><input data-column-property="label" value="${escapeHtml(column.label)}"></div><div class="field"><label>Type</label><select data-column-property="type">${TABLE_COLUMN_TYPES.map(([type, label]) => `<option value="${type}" ${column.type === type ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label>Largeur (1–12)</label><input type="number" min="1" max="12" data-column-property="width" value="${column.width}"></div><div class="field"><label>Alignement</label><select data-column-property="align"><option value="left" ${column.align === "left" ? "selected" : ""}>Gauche</option><option value="center" ${column.align === "center" ? "selected" : ""}>Centre</option><option value="right" ${column.align === "right" ? "selected" : ""}>Droite</option></select></div><div class="field"><label>Calcul de synthèse</label><select data-column-property="calculation"><option value="">Aucun</option><option value="sum" ${column.calculation === "sum" ? "selected" : ""}>Somme</option><option value="average" ${column.calculation === "average" ? "selected" : ""}>Moyenne</option><option value="count" ${column.calculation === "count" ? "selected" : ""}>Comptage</option></select></div><div class="field"><label>Valeur par défaut</label><input data-column-property="defaultValue" value="${escapeHtml(column.defaultValue ?? "")}"></div></div>${column.type === "select" ? `<div class="field"><label>Choix de la colonne (un par ligne)</label><textarea data-column-property="options" data-value-kind="lines" rows="4">${escapeHtml((column.options || []).join("\n"))}</textarea></div>` : ""}${["integer", "decimal", "currency", "percentage"].includes(column.type) ? `<div class="grid2"><div class="field"><label>Minimum</label><input type="number" data-column-property="min" value="${column.min ?? ""}"></div><div class="field"><label>Maximum</label><input type="number" data-column-property="max" value="${column.max ?? ""}"></div><div class="field"><label>Décimales</label><input type="number" min="0" max="4" data-column-property="decimals" value="${column.decimals || 0}"></div><div class="field"><label>Unité / suffixe</label><input data-column-property="unit" value="${escapeHtml(column.unit || "")}"></div></div>` : ""}<div class="actions"><label><input type="checkbox" data-column-property="required" ${column.required ? "checked" : ""}> Obligatoire</label><label><input type="checkbox" data-column-property="visibleForm" ${column.visibleForm !== false ? "checked" : ""}> Formulaire</label><label><input type="checkbox" data-column-property="visiblePdf" ${column.visiblePdf !== false ? "checked" : ""}> PDF</label><button type="button" class="secondary" data-duplicate-column="${columnIndex}">Dupliquer</button><button type="button" class="danger" data-delete-column="${columnIndex}">Supprimer</button></div></article>`).join("")}</div><button type="button" class="secondary wide" data-add-column>＋ Ajouter une colonne</button></div><div class="grid2 full"><div class="field"><label>Minimum de lignes</label><input type="number" min="0" max="100" data-template-property="minRows" data-value-kind="number" value="${section.minRows || 0}"></div><div class="field"><label>Maximum de lignes</label><input type="number" min="1" max="100" data-template-property="maxRows" data-value-kind="number" value="${section.maxRows || 30}"></div></div><label class="setting-check"><input type="checkbox" data-template-property="allowAddRows" ${section.allowAddRows !== false ? "checked" : ""}> Autoriser le technicien à ajouter des lignes</label><div class="field full"><label>Mode d’affichage</label><select data-template-property="tableMode"><option value="table" ${section.tableMode === "table" ? "selected" : ""}>Colonnes classiques</option><option value="rows" ${section.tableMode === "rows" ? "selected" : ""}>Ligne par ligne</option><option value="cards" ${section.tableMode === "cards" ? "selected" : ""}>Cartes</option><option value="compact" ${section.tableMode === "compact" ? "selected" : ""}>Compact</option><option value="detailed" ${section.tableMode === "detailed" ? "selected" : ""}>Détaillé</option></select></div>`);
        fields.push(`<div class="field full"><label>Lignes présentes par défaut</label><div class="advanced-column-list">${(section.defaultRows || []).map((row, rowIndex) => `<article class="advanced-column" data-default-row-index="${rowIndex}"><div class="advanced-column-head"><strong>Ligne ${rowIndex + 1}</strong><div class="actions"><button type="button" class="secondary" data-duplicate-default-row="${rowIndex}">Dupliquer</button><button type="button" class="danger" data-delete-default-row="${rowIndex}">Supprimer</button></div></div><div class="grid2">${(section.columns || []).filter((column) => !["row_number", "calculated", "photo"].includes(column.type)).map((column) => `<div class="field"><label>${escapeHtml(column.label)}</label><input data-default-row-column="${escapeHtml(column.key)}" value="${escapeHtml(row[column.key] ?? column.defaultValue ?? "")}"></div>`).join("")}</div></article>`).join("") || '<p class="muted">Aucune ligne prédéfinie.</p>'}</div><button type="button" class="secondary wide" data-add-default-row>＋ Ajouter une ligne prédéfinie</button></div>`);
    }
    if (["photo", "multi_photo", "event_photos"].includes(section.type)) {
        fields.push(`<div class="field"><label>Nombre maximum de photos</label><input type="number" min="1" max="20" ${property("maxPhotos", section.maxPhotos || (section.type === "photo" ? 1 : 5), "number")}></div>`);
    }
    if (["signature", "electronic_signature"].includes(section.type)) {
        fields.push(`<p class="field-help">Le titre affiché identifie le signataire (par exemple « Signature du technicien »). Chaque bloc possède sa propre signature.</p>`);
    }
    if (section.type === "technician_signature") {
        fields.push(`<p class="field-help">Ce bloc utilise automatiquement le technicien assigné. Sans signature mémorisée, le technicien signe manuellement dans la fiche du rapport.</p>`);
    }
    return fields.join("");
}

function renderTemplateDraft() {
    const container = document.getElementById("template-fields");
    if (!container) return;
    container.innerHTML = templateDraftSections.length ? templateDraftSections.map((section, index) => templateSectionCard(section, index)).join("") : `<div class="empty">Ajoutez les blocs qui composeront ce rapport.</div>`;
    container.querySelectorAll("[data-configure-template-field]").forEach((button) => button.addEventListener("click", () => openTemplateSectionDrawer(Number(button.dataset.configureTemplateField))));
    container.querySelectorAll("[data-move-template-up]").forEach((button) => button.addEventListener("click", () => moveTemplateField(Number(button.dataset.moveTemplateUp), -1)));
    container.querySelectorAll("[data-move-template-down]").forEach((button) => button.addEventListener("click", () => moveTemplateField(Number(button.dataset.moveTemplateDown), 1)));
    container.querySelectorAll("[data-remove-template-field]").forEach((button) => button.addEventListener("click", () => { templateDraftSections.splice(Number(button.dataset.removeTemplateField), 1); renderTemplateDraft(); }));
    let draggedIndex = null;
    container.querySelectorAll("[data-template-drag-index]").forEach((row) => {
        row.addEventListener("dragstart", (event) => { draggedIndex = Number(row.dataset.templateDragIndex); row.classList.add("is-dragging"); event.dataTransfer.effectAllowed = "move"; });
        row.addEventListener("dragend", () => row.classList.remove("is-dragging"));
        row.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; });
        row.addEventListener("drop", (event) => { event.preventDefault(); const target = Number(row.dataset.templateDragIndex); if (draggedIndex === null || target === draggedIndex) return; const [moved] = templateDraftSections.splice(draggedIndex, 1); templateDraftSections.splice(target, 0, moved); renderTemplateDraft(); });
    });
    renderTemplatePreview();
}

function templateTypeLabel(type) { return TEMPLATE_FIELD_TYPES.find(([value]) => value === type)?.[1] || type; }
function templateSectionSummary(section) {
    if (["select", "checkbox"].includes(section.type)) return `${(section.options || []).length} choix : ${(section.options || []).slice(0, 3).join(", ")}${section.options?.length > 3 ? "…" : ""}`;
    if (["table", "price_table"].includes(section.type)) return `${(section.columns || []).length} colonnes : ${(section.columns || []).map((column) => typeof column === "string" ? column : column.label).join(", ")}`;
    if (["photo", "multi_photo", "event_photos"].includes(section.type)) return `${section.maxPhotos || 1} photo(s) maximum`;
    if (section.type === "number") return [section.min != null && `min. ${section.min}`, section.max != null && `max. ${section.max}`, section.unit].filter(Boolean).join(" · ") || "Nombre libre";
    return section.helpText || section.placeholder || section.defaultValue || "Aucun réglage complémentaire";
}
function templateSectionCard(section, index) {
    return `<article class="template-field-row compact ${section.width === "half" ? "half" : "full"}" draggable="true" data-template-drag-index="${index}">
      <span class="drag-handle" title="Glisser pour réordonner" aria-label="Réordonner le bloc">${icon("more")}</span>
      <div class="template-card-copy"><strong>${escapeHtml(section.label)}</strong><div class="template-card-summary"><span class="badge">${escapeHtml(templateTypeLabel(section.type))}</span>${section.required ? '<span class="badge off">Obligatoire</span>' : ""}<span class="badge off">${section.width === "half" ? "Demi-largeur" : "Pleine largeur"}</span><small>${escapeHtml(templateSectionSummary(section))}</small></div></div>
      <div class="template-card-actions"><button type="button" class="secondary icon-only" data-move-template-up="${index}" ${index === 0 ? "disabled" : ""} aria-label="Monter ce bloc" title="Monter">↑</button><button type="button" class="secondary icon-only" data-move-template-down="${index}" ${index === templateDraftSections.length - 1 ? "disabled" : ""} aria-label="Descendre ce bloc" title="Descendre">↓</button><button type="button" class="secondary icon-only" data-configure-template-field="${index}" aria-label="Configurer ${escapeHtml(section.label)}" title="Configurer">${icon("edit")}</button></div>
    </article>`;
}

function openTemplateSectionDrawer(index, activeTab = "settings", workingDraft = null) {
    closeTemplateSectionDrawer();
    const original = templateDraftSections[index];
    if (!original) return;
    const draft = workingDraft || structuredClone(original);
    const root = document.createElement("div");
    root.id = "template-section-drawer";
    root.className = "section-drawer-backdrop";
    root.innerHTML = `<aside class="section-drawer" role="dialog" aria-modal="true" aria-labelledby="section-drawer-title">
      <header class="section-drawer-head"><div><h2 id="section-drawer-title">Configurer le bloc</h2><span class="muted">Bloc ${index + 1} · ${escapeHtml(templateTypeLabel(draft.type))}</span></div><button class="close icon-only" type="button" data-close-section-drawer aria-label="Fermer">${icon("close")}</button></header>
      <div class="section-drawer-tabs" role="tablist"><button class="${activeTab === "settings" ? "primary" : "secondary"}" type="button" data-section-tab="settings" role="tab" aria-selected="${activeTab === "settings"}">Réglages</button><button class="${activeTab === "display" ? "primary" : "secondary"}" type="button" data-section-tab="display" role="tab" aria-selected="${activeTab === "display"}">Affichage</button></div>
      <div class="section-drawer-body"><form id="section-settings-form">${activeTab === "settings" ? templateSectionSettings(draft, index) : templateSectionDisplay(draft, index)}</form></div>
      <footer class="section-drawer-footer"><button class="secondary" type="button" data-close-section-drawer>Annuler</button><button class="primary" type="button" id="apply-section-settings">Valider les réglages</button><button class="danger" type="button" id="delete-section-from-drawer">${icon("trash")} Supprimer</button><button class="secondary" type="button" id="duplicate-section">Dupliquer</button></footer>
    </aside>`;
    document.body.append(root);
    root.querySelectorAll("[data-close-section-drawer]").forEach((button) => button.addEventListener("click", closeTemplateSectionDrawer));
    root.addEventListener("mousedown", (event) => { if (event.target === root) closeTemplateSectionDrawer(); });
    root.querySelectorAll("[data-section-tab]").forEach((button) => button.addEventListener("click", () => {
        readSectionDrawerValues(draft, root);
        closeTemplateSectionDrawer();
        openTemplateSectionDrawer(index, button.dataset.sectionTab, draft);
    }));
    root.querySelector("#drawer-type")?.addEventListener("change", (event) => {
        readSectionDrawerValues(draft, root);
        const defaults = newTemplateSection(event.target.value, draft.label, draft.key);
        Object.assign(draft, defaults, { label: draft.label, key: draft.key, helpText: draft.helpText || "", width: draft.width || "full", required: draft.required || false });
        closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, "settings", draft);
    });
    document.getElementById("apply-section-settings").addEventListener("click", () => {
        readSectionDrawerValues(draft, root);
        templateDraftSections[index] = draft;
        closeTemplateSectionDrawer(); renderTemplateDraft(); renderTemplatePreview();
    });
    document.getElementById("delete-section-from-drawer").addEventListener("click", () => { templateDraftSections.splice(index, 1); closeTemplateSectionDrawer(); renderTemplateDraft(); });
    document.getElementById("duplicate-section").addEventListener("click", () => { readSectionDrawerValues(draft, root); const copy = structuredClone(draft); copy.key = `champ_${Date.now()}_${templateDraftSections.length}`; copy.label = `${copy.label} (copie)`; templateDraftSections.splice(index + 1, 0, copy); closeTemplateSectionDrawer(); renderTemplateDraft(); });
    root.querySelector("[data-add-column]")?.addEventListener("click", () => { readSectionDrawerValues(draft, root); draft.columns.push(normalizeTableColumn({ label: `Colonne ${draft.columns.length + 1}` }, draft.columns.length, draft.type === "price_table")); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); });
    root.querySelectorAll("[data-delete-column]").forEach((button) => button.addEventListener("click", () => { readSectionDrawerValues(draft, root); if (draft.columns.length <= 1) return toast("Un tableau doit conserver au moins une colonne.", true); draft.columns.splice(Number(button.dataset.deleteColumn), 1); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); }));
    root.querySelectorAll("[data-duplicate-column]").forEach((button) => button.addEventListener("click", () => { readSectionDrawerValues(draft, root); const sourceIndex = Number(button.dataset.duplicateColumn); const copy = structuredClone(draft.columns[sourceIndex]); copy.key = `${copy.key}_copie_${Date.now()}`; copy.label = `${copy.label} (copie)`; draft.columns.splice(sourceIndex + 1, 0, copy); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); }));
    root.querySelector("[data-add-default-row]")?.addEventListener("click", () => { readSectionDrawerValues(draft, root); draft.defaultRows.push(Object.fromEntries(draft.columns.filter((column) => !["row_number", "calculated", "photo"].includes(column.type)).map((column) => [column.key, column.defaultValue ?? ""]))); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); });
    root.querySelectorAll("[data-delete-default-row]").forEach((button) => button.addEventListener("click", () => { readSectionDrawerValues(draft, root); draft.defaultRows.splice(Number(button.dataset.deleteDefaultRow), 1); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); }));
    root.querySelectorAll("[data-duplicate-default-row]").forEach((button) => button.addEventListener("click", () => { readSectionDrawerValues(draft, root); const rowIndex = Number(button.dataset.duplicateDefaultRow); draft.defaultRows.splice(rowIndex + 1, 0, structuredClone(draft.defaultRows[rowIndex])); closeTemplateSectionDrawer(); openTemplateSectionDrawer(index, activeTab, draft); }));
    root.querySelector("input,select,textarea")?.focus();
}

function templateSectionSettings(section, index) {
    return `<div class="section-setting-group"><h3>Identification du champ</h3><div class="field"><label for="drawer-label">Titre affiché</label><input id="drawer-label" data-drawer-property="label" value="${escapeHtml(section.label)}" maxlength="150" required></div><div class="field"><label for="drawer-type">Type de contenu</label><select id="drawer-type" data-drawer-property="type">${TEMPLATE_FIELD_TYPES.map(([type, label]) => `<option value="${type}" ${type === section.type ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select><span class="field-help">Détermine la façon dont l’information sera saisie dans le rapport.</span></div></div>
    <div class="section-setting-group"><h3>Contenu et valeurs</h3>${templateSpecificConfiguration(section, index) || '<p class="muted">Ce type de bloc ne nécessite aucun réglage supplémentaire.</p>'}</div>`;
}

function templateSectionDisplay(section, index) {
    return `<div class="section-setting-group"><h3>Disposition dans le rapport</h3><div class="field"><label for="drawer-width">Largeur du bloc</label><select id="drawer-width" data-drawer-property="width"><option value="full" ${section.width !== "half" ? "selected" : ""}>Pleine largeur</option><option value="half" ${section.width === "half" ? "selected" : ""}>Moitié de la page</option></select></div><p class="section-type-help">La demi-largeur permet de placer deux champs côte à côte lorsque l’écran ou le PDF dispose de suffisamment d’espace.</p></div>
    <div class="section-setting-group"><h3>Comportement</h3>${templateFieldSupportsRequired(section.type) ? `<label class="setting-check"><input type="checkbox" data-drawer-property="required" ${section.required ? "checked" : ""}> Ce champ doit obligatoirement être rempli</label>` : ""}<label class="setting-check"><input type="checkbox" data-drawer-property="showLabel" ${section.showLabel !== false ? "checked" : ""}> Afficher le titre du champ</label><div class="field"><label for="drawer-help">Consigne affichée à l’utilisateur</label><textarea id="drawer-help" data-drawer-property="helpText" rows="3" placeholder="Expliquez ce qui doit être renseigné">${escapeHtml(section.helpText || "")}</textarea></div></div>`;
}

function readSectionDrawerValues(section, root) {
    root.querySelectorAll("[data-drawer-property]").forEach((input) => { section[input.dataset.drawerProperty] = input.type === "checkbox" ? input.checked : input.value; });
    root.querySelectorAll("[data-template-property]").forEach((input) => {
        const kind = input.dataset.valueKind;
        section[input.dataset.templateProperty] = input.type === "checkbox" ? input.checked : kind === "list" ? input.value.split(",").map((value) => value.trim()).filter(Boolean) : kind === "lines" ? input.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) : kind === "number" ? Number(input.value) : kind === "nullable-number" ? (input.value === "" ? null : Number(input.value)) : input.value;
    });
    root.querySelectorAll("[data-column-index]").forEach((card) => {
        const column = section.columns[Number(card.dataset.columnIndex)];
        card.querySelectorAll("[data-column-property]").forEach((input) => {
            const value = input.type === "checkbox" ? input.checked : input.dataset.valueKind === "lines" ? input.value.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean) : input.type === "number" ? (input.value === "" ? null : Number(input.value)) : input.value;
            column[input.dataset.columnProperty] = value;
        });
    });
    section.defaultRows = [...root.querySelectorAll("[data-default-row-index]")].map((card) => Object.fromEntries([...card.querySelectorAll("[data-default-row-column]")].map((input) => [input.dataset.defaultRowColumn, input.value])));
}
function closeTemplateSectionDrawer() { document.getElementById("template-section-drawer")?.remove(); }

function templateFieldSupportsRequired(type) {
    return ["text", "textarea", "date", "number", "checkbox", "select", "creator", "gps", "address", "table", "price_table"].includes(type);
}

function moveTemplateField(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= templateDraftSections.length) return;
    [templateDraftSections[index], templateDraftSections[target]] = [templateDraftSections[target], templateDraftSections[index]];
    renderTemplateDraft();
}

function renderTemplatePreview() {
    const preview = document.getElementById("template-preview");
    if (!preview) return;
    const nom = document.getElementById("template-name")?.value.trim() || "Aperçu du rapport";
    preview.innerHTML = templateDraftSections.length
        ? renderReportFields({ nom, sections: templateDraftSections }, {})
        : `<div class="empty">Ajoutez un bloc pour afficher l’aperçu.</div>`;
}

async function saveTemplate(event, existing) {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type='submit']");
    await withBusy(button, async () => {
        try {
            const payload = {
                nom: document.getElementById("template-name").value.trim(),
                description: document.getElementById("template-description").value.trim() || null,
                sections: templateDraftSections,
                pdf_config: {
                    margin: Number(document.getElementById("pdf-margin").value),
                    titleSize: Number(document.getElementById("pdf-title-size").value),
                    showHeader: document.getElementById("pdf-show-header").checked,
                    showClient: document.getElementById("pdf-show-client").checked,
                    showEquipment: document.getElementById("pdf-show-equipment").checked,
                    showPhotos: document.getElementById("pdf-show-photos").checked,
                    showSignature: document.getElementById("pdf-show-signature").checked,
                    showPageNumbers: document.getElementById("pdf-show-pages").checked,
                    footerText: document.getElementById("pdf-footer").value.trim(),
                    fieldTitleStyle: {
                        color: document.getElementById("pdf-field-title-color").value,
                        size: Number(document.getElementById("pdf-field-title-size").value),
                        font: document.getElementById("pdf-field-title-font").value,
                        bold: document.getElementById("pdf-field-title-bold").checked,
                        underline: document.getElementById("pdf-field-title-underline").checked,
                        backgroundColor: document.getElementById("pdf-field-title-background-enabled").checked ? document.getElementById("pdf-field-title-background").value : "",
                    },
                },
                actif: true,
            };
            await api(existing ? `/modeles/${existing.id}` : "/modeles", { method: existing ? "PUT" : "POST", body: JSON.stringify(payload) });
            closeModal();
            await finishMutation("modeles", existing ? "Modèle mis à jour." : "Modèle créé.");
        } catch (error) { toast(error.message, true); }
    });
}

async function deleteTemplate(id, button) {
    const template = reportTemplates.find((item) => String(item.id) === String(id));
    if (!confirm(`Supprimer définitivement le modèle « ${template?.nom || id} » ? Les rapports existants conserveront leur contenu et leur PDF.`)) return;
    await withBusy(button, async () => {
        try {
            await api(`/modeles/${id}`, { method: "DELETE" });
            await finishMutation("modeles", "Modèle supprimé définitivement.");
        } catch (error) { toast(error.message, true); }
    });
}

async function duplicateTemplate(id, button) {
    await withBusy(button, async () => {
        try {
            await api(`/modeles/${id}/duplicate`, { method: "POST", body: "{}" });
            await finishMutation("modeles", "Modèle dupliqué.");
        } catch (error) { toast(error.message, true); }
    });
}

function openDocumentEditor() {
    if (!clients.length) return toast("Créez d’abord un client.", true);
    modal("Nouveau devis ou facture", `<form id="document-form">
      <div class="grid2"><div class="field"><label>Type</label><select name="type"><option value="DEVIS">Devis</option><option value="FACTURE">Facture</option><option value="AVOIR">Avoir</option></select></div><div class="field"><label>Statut</label><select name="statut"><option value="BROUILLON">Brouillon</option><option value="ENVOYE">Envoyé</option><option value="ACCEPTE">Accepté</option><option value="PAYE">Payé</option></select></div></div>
      <div class="field"><label>Client</label><select name="client_id" required>${clientOptions()}</select></div>
      <div class="grid2">${field("Date d’émission", "date_emission", "date", true, localDateKey(new Date()))}${field("Date d’échéance", "date_echeance", "date")}</div>
      <div class="grid2"><div class="field"><label>Devise</label><select name="devise"><option value="EUR">Euro (EUR)</option><option value="CHF">Franc suisse (CHF)</option><option value="USD">Dollar (USD)</option></select></div>${field("Mode de paiement", "mode_paiement")}</div>
      <div class="panel-head"><h2>Lignes</h2><button id="add-document-line" class="secondary" type="button">＋ Ajouter une ligne</button></div>
      <div id="document-lines"></div>
      <div class="money-summary"><div><span class="muted">Total HT</span><strong id="document-total-ht">0,00 €</strong></div><div><span class="muted">TVA</span><strong id="document-total-tva">0,00 €</strong></div><div><span class="muted">Total TTC</span><strong id="document-total-ttc">0,00 €</strong></div></div>
      <div class="field"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
      <button class="primary wide" type="submit">Enregistrer le document</button>
    </form>`);
    addDocumentLine();
    document.getElementById("add-document-line").addEventListener("click", addDocumentLine);
    document.getElementById("document-form").addEventListener("submit", saveDocument);
}

function addDocumentLine(values = {}) {
    const container = document.getElementById("document-lines");
    const row = document.createElement("div");
    row.className = "document-line";
    row.innerHTML = `<div class="field line-description"><label>Description</label><input data-line="description" required value="${escapeHtml(values.description || "")}"></div><div class="field"><label>Quantité</label><input data-line="quantite" type="number" min="0.01" step="0.01" required value="${values.quantite || 1}"></div><div class="field"><label>Prix HT</label><input data-line="prix_unitaire" type="number" min="0" step="0.01" required value="${values.prix_unitaire || 0}"></div><div class="field"><label>TVA %</label><input data-line="taux_tva" type="number" min="0" max="100" step="0.1" value="${values.taux_tva ?? 20}"></div><button class="danger" type="button" aria-label="Supprimer la ligne">×</button>`;
    row.querySelector("button").addEventListener("click", () => { if (container.children.length > 1) row.remove(); updateDocumentTotals(); });
    row.querySelectorAll("input").forEach((input) => input.addEventListener("input", updateDocumentTotals));
    container.append(row);
    updateDocumentTotals();
}

function documentLines() {
    return [...document.querySelectorAll(".document-line")].map((row) => ({
        description: row.querySelector('[data-line="description"]').value.trim(),
        quantite: Number(row.querySelector('[data-line="quantite"]').value),
        prix_unitaire: Number(row.querySelector('[data-line="prix_unitaire"]').value),
        taux_tva: Number(row.querySelector('[data-line="taux_tva"]').value),
    }));
}

function updateDocumentTotals() {
    if (!document.getElementById("document-total-ht")) return;
    const totals = calculateDocumentTotals(documentLines());
    document.getElementById("document-total-ht").textContent = formatMoney(totals.ht);
    document.getElementById("document-total-tva").textContent = formatMoney(totals.tva);
    document.getElementById("document-total-ttc").textContent = formatMoney(totals.ht + totals.tva);
}

async function saveDocument(event) {
    event.preventDefault();
    const form = formFromSubmitEvent(event);
    const button = form.querySelector("button[type='submit']");
    const payload = Object.fromEntries(new FormData(form));
    payload.lignes = documentLines();
    await withBusy(button, async () => {
        try {
            await api("/documents", { method: "POST", body: JSON.stringify(payload) });
            closeModal();
            await finishMutation("documents", "Document créé.");
        } catch (error) { toast(error.message, true); }
    });
}

function openDocumentDetails(id) {
    const item = commercialDocuments.find((document) => String(document.id) === String(id));
    if (!item) return;
    modal(item.numero || item.type, `<p><strong>${escapeHtml(item.client_nom)}</strong><br><span class="muted">${escapeHtml(item.type)} · ${escapeHtml(item.statut)} · ${formatDate(item.date_emission)}</span></p><div class="table-wrap"><table><thead><tr><th>Description</th><th>Qté</th><th>Prix HT</th><th>TVA</th><th>Total HT</th></tr></thead><tbody>${(item.lignes || []).map((line) => `<tr><td data-label="Description">${escapeHtml(line.description)}</td><td data-label="Qté">${line.quantite}</td><td data-label="Prix HT">${formatMoney(line.prix_unitaire, item.devise)}</td><td data-label="TVA">${line.taux_tva}%</td><td data-label="Total HT">${formatMoney(line.montant_ht, item.devise)}</td></tr>`).join("")}</tbody></table></div><div class="money-summary"><div>Total HT<br><strong>${formatMoney(item.total_ht, item.devise)}</strong></div><div>TVA<br><strong>${formatMoney(item.total_tva, item.devise)}</strong></div><div>Total TTC<br><strong>${formatMoney(item.total_ttc, item.devise)}</strong></div></div><button class="danger wide" id="delete-open-document">Supprimer définitivement ce document</button>`);
    document.getElementById("delete-open-document").addEventListener("click", (event) => deleteDocument(item.id, event.currentTarget));
}

async function deleteDocument(id, button) {
    const item = commercialDocuments.find((document) => String(document.id) === String(id));
    const label = item?.numero || item?.type || "ce document";
    if (!confirm(`Supprimer définitivement ${label} ? Cette action est irréversible.`)) return;
    await withBusy(button, async () => {
        try { await api(`/documents/${id}`, { method: "DELETE" }); closeModal(); await finishMutation("documents", "Document supprimé."); }
        catch (error) { toast(error.message, true); }
    });
}

function openNewClient() {
    modal("Nouveau client", `<form id="client-form">${field("Nom", "nom", "text", true)}${field("Email principal", "email", "email")}<div class="field"><label>Emails destinataires des rapports</label><textarea name="report_emails_text" rows="4" placeholder="Une adresse par ligne"></textarea></div>${field("Téléphone", "telephone")}${field("Adresse", "adresse")}<button class="primary wide">Créer le client</button></form>`);
    document.getElementById("client-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"],button:not([type])');
        const values = Object.fromEntries(new FormData(form));
        values.report_emails = parseEmailList(values.report_emails_text);
        delete values.report_emails_text;
        await withBusy(button, async () => {
            try { await api("/clients", { method: "POST", body: JSON.stringify(values) }); closeModal(); await finishMutation("clients", "Client créé."); }
            catch (error) { toast(error.message, true); }
        });
    });
}

async function openClientDetails(id, tab = "info") {
    modal("Fiche client", `<div class="empty"><span class="spinner" aria-hidden="true"></span> Chargement de la fiche…</div>`);
    try {
        const detail = await api(`/clients/${id}?limit=25&offset=0`);
        renderClientDetail(detail, tab);
    } catch (error) {
        closeModal();
        toast(error.message, true);
    }
}

function renderClientDetail(detail, activeTab = "info") {
    const client = detail.client;
    const tabs = [
        ["info", "Informations"],
        ["contacts", `Contacts (${(detail.contacts || []).length})`],
        ["equipements", `Matériels (${detail.equipements.length})`],
        ["interventions", `Interventions (${detail.pagination.interventions_total})`],
    ];

    let content;
    if (activeTab === "contacts") {
        content = `<div class="panel-head"><div><h2>Contacts du client</h2><p class="muted">Personnes à contacter et futurs destinataires des rapports.</p></div>${currentUser.role === "ADMIN" ? '<button class="primary" data-add-client-contact>+ Ajouter</button>' : ""}</div><div class="related-list">${(detail.contacts || []).length ? detail.contacts.map((contact) => `<article class="related-card"><span><strong>${escapeHtml(contact.nom)}</strong><small>${escapeHtml(contact.fonction || "Fonction non renseignée")}</small><small>${contact.email ? `<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a>` : "Pas d’e-mail"}${contact.telephone ? ` · <a href="tel:${escapeHtml(contact.telephone)}">${escapeHtml(contact.telephone)}</a>` : ""}</small>${contact.destinataire_rapport ? '<span class="badge">Destinataire des rapports</span>' : ""}</span>${currentUser.role === "ADMIN" ? `<span class="actions"><button class="secondary" data-edit-client-contact="${contact.id}">Modifier</button><button class="danger" data-delete-client-contact="${contact.id}">Supprimer</button></span>` : ""}</article>`).join("") : '<div class="empty">Aucun contact associé à ce client.</div>'}</div>`;
    } else if (activeTab === "equipements") {
        content = `<div class="panel-head"><h2>Matériels associés</h2>${currentUser.role === "ADMIN" ? `<button class="primary" data-add-client-equipment="${client.id}">+ Ajouter</button>` : ""}</div><div class="related-list">${detail.equipements.length ? detail.equipements.map((equipment) => `<button class="related-card" data-client-equipment="${equipment.id}"><span><strong>${escapeHtml([equipment.type, equipment.marque, equipment.modele].filter(Boolean).join(" · ") || `Matériel ${equipment.id}`)}</strong><small>N° série : ${escapeHtml(equipment.numero_serie || "—")} · Année : ${escapeHtml(equipment.annee_installation || "—")}</small><small>Dernière intervention : ${equipment.derniere_intervention_date ? `${formatDate(equipment.derniere_intervention_date)} — ${escapeHtml(equipment.derniere_intervention_titre || "")}` : "Aucune"}</small></span><span aria-hidden="true">›</span></button>`).join("") : `<div class="empty">Aucun matériel associé à ce client.</div>`}</div>`;
    } else if (activeTab === "devis" && currentUser.role === "ADMIN") {
        content = `<div class="related-list">${detail.devis.length ? detail.devis.map((document) => `<button class="related-card" data-client-document="${document.id}"><span><strong>${escapeHtml(document.numero || `Devis ${document.id}`)}</strong><small>${formatDate(document.date_emission)} · Échéance ${formatDate(document.date_echeance)} · ${escapeHtml(document.statut)}</small></span><strong>${formatMoney(document.total_ttc, document.devise)}</strong></button>`).join("") : `<div class="empty">Aucun devis pour ce client.</div>`}</div>${detail.pagination.devis_total > detail.devis.length ? `<p class="muted">Les ${detail.devis.length} devis les plus récents sont affichés sur ${detail.pagination.devis_total}.</p>` : ""}`;
    } else if (activeTab === "interventions") {
        content = `<div class="related-list">${detail.interventions.length ? detail.interventions.map((item) => `<button class="related-card" data-client-intervention="${item.id}"><span><strong>${escapeHtml(item.titre || `Intervention ${item.id}`)}</strong><small>${formatDate(item.date_intervention)} ${escapeHtml(item.heure?.slice(0, 5) || "")} · ${statusLabel(item.statut)}</small><small>${escapeHtml(item.technicien_nom || "Non assigné")} · ${escapeHtml([item.equipement_type, item.equipement_modele].filter(Boolean).join(" · ") || "Sans équipement")}</small></span><span aria-hidden="true">›</span></button>`).join("") : `<div class="empty">Aucune intervention pour ce client.</div>`}</div>${detail.pagination.interventions_total > detail.interventions.length ? `<p class="muted">Les ${detail.interventions.length} interventions les plus récentes sont affichées sur ${detail.pagination.interventions_total}.</p>` : ""}`;
    } else {
        content = `<div class="panel-head"><h2>Informations générales</h2>${currentUser.role === "ADMIN" ? `<button class="primary" data-edit-client="${client.id}">Modifier</button>` : ""}</div><div class="client-detail-grid"><div class="detail-box"><strong>Nom ou raison sociale</strong>${escapeHtml(client.nom)}</div><div class="detail-box"><strong>Contact lié</strong>${escapeHtml(client.utilisateur_nom || "Aucun compte client")}</div><div class="detail-box"><strong>E-mail principal</strong>${client.email ? `<a href="mailto:${escapeHtml(client.email)}">${escapeHtml(client.email)}</a>` : "—"}</div><div class="detail-box"><strong>Destinataires des rapports</strong>${(client.report_emails || []).length ? client.report_emails.map((email) => `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`).join("<br>") : "—"}</div><div class="detail-box"><strong>Téléphone</strong>${client.telephone ? `<a href="tel:${escapeHtml(client.telephone)}">${escapeHtml(client.telephone)}</a>` : "—"}</div><div class="detail-box"><strong>Adresse</strong>${escapeHtml(client.adresse || "—")}</div><div class="detail-box"><strong>Créé le</strong>${formatDate(client.created_at)}</div><div class="detail-box"><strong>Dernière modification</strong>${formatDate(client.updated_at)}</div></div>`;
    }

    modal(client.nom, `<div class="client-tabs" role="tablist">${tabs.map(([value, label]) => `<button class="${value === activeTab ? "primary" : "secondary"}" data-client-tab="${value}" role="tab" aria-selected="${value === activeTab}">${label}</button>`).join("")}</div><section>${content}</section>`);
    document.querySelectorAll("[data-client-tab]").forEach((button) => button.addEventListener("click", () => renderClientDetail(detail, button.dataset.clientTab)));
    document.querySelector("[data-edit-client]")?.addEventListener("click", () => openEditClient(detail));
    document.querySelector("[data-add-client-contact]")?.addEventListener("click", () => openClientContactForm(detail));
    document.querySelectorAll("[data-edit-client-contact]").forEach((button) => button.addEventListener("click", () => openClientContactForm(detail, (detail.contacts || []).find((contact) => String(contact.id) === String(button.dataset.editClientContact)))));
    document.querySelectorAll("[data-delete-client-contact]").forEach((button) => button.addEventListener("click", () => deleteClientContact(detail, button.dataset.deleteClientContact, button)));
    document.querySelector("[data-add-client-equipment]")?.addEventListener("click", () => openClientEquipmentForm(detail));
    document.querySelectorAll("[data-client-equipment]").forEach((button) => button.addEventListener("click", () => openClientEquipmentDetail(detail, button.dataset.clientEquipment)));
    document.querySelectorAll("[data-client-document]").forEach((button) => button.addEventListener("click", () => {
        const document = commercialDocuments.find((item) => String(item.id) === String(button.dataset.clientDocument));
        if (!document) return toast("Le détail de ce devis n'est pas disponible.", true);
        openDocumentDetails(document.id);
    }));
    document.querySelectorAll("[data-client-intervention]").forEach((button) => button.addEventListener("click", () => openIntervention(button.dataset.clientIntervention)));
}

function openClientContactForm(detail, contact = null) {
    modal(contact ? "Modifier le contact" : "Nouveau contact", `<form id="client-contact-form">${clientContactFields(field, contact || {})}<button class="primary wide" type="submit">Enregistrer le contact</button></form>`);
    document.getElementById("client-contact-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"]');
        const values = Object.fromEntries(new FormData(form));
        values.destinataire_rapport = form.elements.destinataire_rapport.checked;
        await withBusy(button, async () => {
            try {
                const path = contact ? `/clients/${detail.client.id}/contacts/${contact.id}` : `/clients/${detail.client.id}/contacts`;
                const saved = await api(path, { method: contact ? "PUT" : "POST", body: JSON.stringify(values) });
                detail.contacts = contact ? detail.contacts.map((item) => String(item.id) === String(saved.id) ? saved : item) : [...(detail.contacts || []), saved];
                renderClientDetail(detail, "contacts");
                toast(contact ? "Contact modifié." : "Contact ajouté.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

async function deleteClientContact(detail, contactId, button) {
    const contact = (detail.contacts || []).find((item) => String(item.id) === String(contactId));
    if (!confirm(`Supprimer le contact « ${contact?.nom || "sélectionné"} » ?`)) return;
    await withBusy(button, async () => {
        try {
            await api(`/clients/${detail.client.id}/contacts/${contactId}`, { method: "DELETE" });
            detail.contacts = detail.contacts.filter((item) => String(item.id) !== String(contactId));
            renderClientDetail(detail, "contacts");
            toast("Contact supprimé.");
        } catch (error) { toast(error.message, true); }
    });
}

function openEditClient(detail) {
    const client = detail.client;
    modal(`Modifier ${client.nom}`, `<form id="edit-client-form">${field("Nom ou raison sociale", "nom", "text", true, client.nom)}${field("E-mail principal", "email", "email", false, client.email || "")}<div class="field"><label>Emails destinataires des rapports</label><textarea name="report_emails_text" rows="4">${escapeHtml((client.report_emails || []).join("\n"))}</textarea><span class="field-help">Une adresse par ligne, 20 maximum.</span></div>${field("Téléphone", "telephone", "tel", false, client.telephone || "")}<div class="field"><label for="edit-client-address">Adresse</label><textarea id="edit-client-address" name="adresse" rows="3">${escapeHtml(client.adresse || "")}</textarea></div><button class="primary wide" type="submit">Enregistrer les modifications</button></form>`);
    document.getElementById("edit-client-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"]');
        await withBusy(button, async () => {
            try {
                const values = Object.fromEntries(new FormData(form));
                values.report_emails = parseEmailList(values.report_emails_text);
                delete values.report_emails_text;
                const updated = await api(`/clients/${client.id}`, { method: "PUT", body: JSON.stringify(values) });
                detail.client = { ...detail.client, ...updated };
                clients = clients.map((item) => String(item.id) === String(updated.id) ? { ...item, ...updated } : item);
                renderClientDetail(detail, "info");
                toast("Fiche client mise à jour.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

function openClientEquipmentForm(detail) {
    modal(`Nouvel équipement — ${detail.client.nom}`, `<form id="client-equipment-form">${equipmentFields(field)}<button class="primary wide" type="submit">Créer l’équipement</button></form>`);
    document.getElementById("client-equipment-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"]');
        await withBusy(button, async () => {
            try {
                const values = Object.fromEntries(new FormData(form));
                values.client_id = detail.client.id;
                const equipment = await api("/equipements", { method: "POST", body: JSON.stringify(values) });
                equipements.push({ ...equipment, client_nom: detail.client.nom });
                creationEquipements.push(equipment);
                await openClientDetails(detail.client.id, "equipements");
                toast("Équipement associé au client.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

function openClientEquipmentDetail(detail, equipmentId) {
    const equipment = detail.equipements.find((item) => String(item.id) === String(equipmentId));
    if (!equipment) return;
    modal("Détail de l’équipement", `<div class="client-detail-grid"><div class="detail-box"><strong>Type</strong>${escapeHtml(equipment.type || "—")}</div><div class="detail-box"><strong>Marque</strong>${escapeHtml(equipment.marque || "—")}</div><div class="detail-box"><strong>Modèle</strong>${escapeHtml(equipment.modele || "—")}</div><div class="detail-box"><strong>Numéro de série</strong>${escapeHtml(equipment.numero_serie || "—")}</div><div class="detail-box"><strong>Année d’installation</strong>${escapeHtml(equipment.annee_installation || "—")}</div><div class="detail-box"><strong>Dernière intervention</strong>${equipment.derniere_intervention_date ? `${formatDate(equipment.derniere_intervention_date)} — ${escapeHtml(equipment.derniere_intervention_titre || "")}` : "Aucune"}</div></div>${currentUser.role === "ADMIN" ? '<button class="primary wide" id="edit-client-equipment">Modifier l’équipement</button>' : ""}<button class="secondary wide" id="back-to-client">Retour à la fiche client</button>`);
    document.getElementById("edit-client-equipment")?.addEventListener("click", () => openEditEquipment(detail, equipment));
    document.getElementById("back-to-client").addEventListener("click", () => renderClientDetail(detail, "equipements"));
}

function openEditEquipment(detail, equipment) {
    modal("Modifier l’équipement", `<form id="edit-equipment-form">${equipmentFields(field, equipment)}<button class="primary wide" type="submit">Enregistrer</button></form>`);
    document.getElementById("edit-equipment-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"]');
        await withBusy(button, async () => {
            try {
                const values = Object.fromEntries(new FormData(form));
                const updated = await api(`/equipements/${equipment.id}`, { method: "PUT", body: JSON.stringify(values) });
                Object.assign(equipment, updated);
                equipements = equipements.map((item) => String(item.id) === String(updated.id) ? { ...item, ...updated } : item);
                creationEquipements = creationEquipements.map((item) => String(item.id) === String(updated.id) ? { ...item, ...updated } : item);
                openClientEquipmentDetail(detail, equipment.id);
                toast("Équipement modifié.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

function openNewEquipment() {
    modal("Nouveau matériel", `<form id="equipment-form"><div class="field"><label>Client</label><select name="client_id" required><option value="">Sélectionner un client</option>${clientOptions()}</select></div>${equipmentFields(field)}<button class="primary wide">Créer le matériel</button></form>`);
    document.getElementById("equipment-form").addEventListener("submit", async (event) => submitForm(event, "/equipements", "equipements"));
}

function openEquipmentEditor(id) {
    const equipment = equipements.find((item) => String(item.id) === String(id));
    if (!equipment) return;
    modal("Modifier le matériel", `<form id="main-equipment-edit-form"><div class="field"><label>Client</label><select name="client_id" required>${clientOptions(equipment.client_id)}</select></div>${equipmentFields(field, equipment)}<button class="primary wide" type="submit">Enregistrer</button></form>`);
    document.getElementById("main-equipment-edit-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector("button[type='submit']");
        const values = Object.fromEntries(new FormData(form));
        for (const key of Object.keys(values)) if (values[key] === "") values[key] = null;
        await withBusy(button, async () => {
            try {
                await api(`/equipements/${id}`, { method: "PUT", body: JSON.stringify(values) });
                closeModal();
                await finishMutation("equipements", "Matériel modifié.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

function openNewTechnician() {
    modal("Ajouter un technicien", `<form id="technician-form">${field("Nom complet", "nom", "text", true)}${field("Adresse email", "email", "email", true)}<div class="field"><label for="technician-password">Mot de passe initial</label><input id="technician-password" name="password" type="password" minlength="8" autocomplete="new-password" required><span class="muted">8 caractères minimum. Le technicien pourra l’utiliser dès l’activation du compte.</span></div><button class="primary wide" type="submit">Créer le compte technicien</button></form>`);
    document.getElementById("technician-form").addEventListener("submit", (event) =>
        submitForm(event, "/auth/users", "equipe")
    );
}

function bindTeamActions() {
    document.querySelectorAll("[data-edit-technician-profile]").forEach((button) => button.addEventListener("click", () => {
        const user = technicians.find((entry) => String(entry.id) === String(button.dataset.editTechnicianProfile));
        if (!user) return;
        modal("Modifier le technicien", `<form id="edit-technician-profile-form"><div class="field"><label>Nom complet</label><input name="nom" maxlength="100" required value="${escapeHtml(user.nom)}"></div><div class="field"><label>Nouveau mot de passe</label><input name="password" type="password" minlength="8" autocomplete="new-password"><span class="field-help">Laissez vide pour conserver le mot de passe actuel. L’ancien mot de passe n’est jamais affiché.</span></div><button class="primary wide" type="submit">Enregistrer</button></form>`);
        document.getElementById("edit-technician-profile-form").addEventListener("submit", async (event) => {
            event.preventDefault();
            const form = formFromSubmitEvent(event);
            const submit = form.querySelector("button[type='submit']");
            const payload = { nom: form.elements.nom.value };
            if (form.elements.password.value) payload.password = form.elements.password.value;
            await withBusy(submit, async () => {
                try {
                    const result = await api(`/auth/users/${user.id}`, { method: "PATCH", body: JSON.stringify(payload) });
                    replaceTechnician(result.user);
                    closeModal(true);
                    renderMain("equipe");
                    toast("Technicien modifié.");
                } catch (error) { toast(error.message, true); }
            });
        });
    }));
    document.querySelectorAll("[data-edit-technician-email]").forEach((button) => button.addEventListener("click", () => {
        const user = technicians.find((entry) => String(entry.id) === String(button.dataset.editTechnicianEmail));
        if (!user) return;
        modal("Modifier l’adresse de connexion", `<form id="edit-technician-email-form"><p class="muted">Le compte Google n’est pas transféré. L’utilisateur devra déconnecter l’ancien compte Google puis connecter le nouveau depuis ses paramètres.</p>${field("Nouvelle adresse e-mail", "email", "email", true, user.email)}<button class="primary wide" type="submit">Enregistrer</button></form>`);
        document.getElementById("edit-technician-email-form").addEventListener("submit", async (event) => {
            event.preventDefault(); const form = formFromSubmitEvent(event); const submit = form.querySelector("button[type='submit']");
            await withBusy(submit, async () => { try { const result = await api(`/auth/users/${user.id}/email`, { method: "PATCH", body: JSON.stringify({ email: form.elements.email.value }) }); replaceTechnician(result.user); closeModal(true); renderMain("equipe"); toast("Adresse de connexion modifiée."); } catch (error) { toast(error.message, true); } });
        });
    }));
    document.querySelectorAll("[data-disable-technician]").forEach((button) =>
        button.addEventListener("click", () => withBusy(button, async () => {
            if (!confirm("Désactiver ce technicien ? Il ne pourra plus se connecter.")) return;
            try {
                const result = await api(`/auth/users/${button.dataset.disableTechnician}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ actif: false }),
                });
                replaceTechnician(result.user);
                renderMain("equipe");
                toast("Technicien désactivé.");
            } catch (error) { toast(error.message, true); }
        }))
    );
    document.querySelectorAll("[data-enable-technician]").forEach((button) =>
        button.addEventListener("click", () => withBusy(button, async () => {
            try {
                const result = await api(`/auth/users/${button.dataset.enableTechnician}/status`, {
                    method: "PATCH",
                    body: JSON.stringify({ actif: true }),
                });
                replaceTechnician(result.user);
                renderMain("equipe");
                toast("Technicien réactivé.");
            } catch (error) { toast(error.message, true); }
        }))
    );
    document.querySelectorAll("[data-delete-technician]").forEach((button) =>
        button.addEventListener("click", () => withBusy(button, async () => {
            const name = button.dataset.technicianName || "ce technicien";
            if (!confirm(`Supprimer définitivement ${name} ?\n\nLe compte sera effacé de la base de données et ses interventions seront désassignées. Cette action est irréversible.`)) return;
            try {
                const result = await api(`/auth/users/${button.dataset.deleteTechnician}`, {
                    method: "DELETE",
                });
                if (result?.deleted !== true || !result?.user?.id) {
                    throw new Error("Le serveur n'a pas confirmé la suppression définitive. Redémarrez le backend puis réessayez.");
                }
                technicians = technicians.filter(
                    (user) => String(user.id) !== String(result.user.id)
                );
                await loadAllData();
                renderMain("equipe");
                toast(`Technicien supprimé définitivement. ${result.detached_interventions} intervention(s) désassignée(s).`);
            } catch (error) { toast(error.message, true); }
        }))
    );
    document.querySelectorAll("[data-delete-technician-signature]").forEach((button) =>
        button.addEventListener("click", () => withBusy(button, async () => {
            const name = button.dataset.technicianName || "ce technicien";
            if (!confirm(`Supprimer la signature mémorisée de ${name} ?`)) return;
            try {
                const result = await api(`/uploads/user-signature/${button.dataset.deleteTechnicianSignature}`, { method: "DELETE" });
                const user = technicians.find((entry) => String(entry.id) === String(result.user_id));
                if (user) replaceTechnician({ ...user, signature_url: null });
                renderMain("equipe");
                toast("Signature technicien supprimée.");
            } catch (error) { toast(error.message, true); }
        }))
    );
}

function replaceTechnician(updatedUser) {
    technicians = technicians
        .map((user) => String(user.id) === String(updatedUser.id) ? updatedUser : user)
        .sort((a, b) => Number(b.actif) - Number(a.actif) || a.nom.localeCompare(b.nom, "fr"));
}

async function loadCreationOptions() {
    if (!creationClients.length) {
        const options = await api("/interventions/options");
        creationClients = options.clients || [];
        creationEquipements = options.equipements || [];
    }
}

async function openNewIntervention() {
    await loadCreationOptions();
    if (!creationClients.length) return toast("Aucun client disponible. Contactez un administrateur.", true);
    const technicianField = currentUser.role === "ADMIN"
        ? `<div class="field"><label>Technicien assigné</label><select name="technicien_id">${technicianOptions()}</select></div>`
        : `<div class="field"><label>Technicien</label><input value="${escapeHtml(currentUser.nom)}" disabled></div>`;
    const scheduleFields = `<div class="grid2">${field("Date prévue", "date_intervention", "date", true)}${field("Heure", "heure", "time")}</div>`;
    const siteAddressField = `<div class="field"><label>Adresse du chantier</label><input id="new-site-address" name="adresse_chantier" autocomplete="street-address"><label class="setting-check"><input id="copy-client-address" type="checkbox"> Reprendre l’adresse du client</label></div>`;
    modal("Planifier une intervention", `<form id="intervention-form"><input type="hidden" name="creation_type" value="PLANIFIEE"><input type="hidden" name="statut" value="PLANIFIEE"><div class="grid2"><div class="field"><label>Client</label><select id="new-client" name="client_id" required><option value="">Sélectionner un client</option>${creationClientOptions()}</select></div>${technicianField}</div><div class="field"><label>Matériel concerné</label><select id="new-equipment" name="equipement_id" disabled><option value="">Sélectionner d’abord un client</option></select></div>${field("Objet de l’intervention", "titre", "text", true)}${siteAddressField}<div class="field"><label>Description</label><textarea name="description"></textarea></div>${scheduleFields}<div class="field"><label>Modèle de rapport</label><select id="new-report-template" name="modele_rapport_id"><option value="">Rapport libre</option>${reportTemplates.filter((template) => template.actif).map((template) => `<option value="${template.id}">${escapeHtml(template.nom)}</option>`).join("")}</select></div><div id="new-report-fields"></div><button class="primary wide">Planifier l’intervention</button></form>`);
    document.getElementById("new-client").addEventListener("change", (event) => {
        const equipmentSelect = document.getElementById("new-equipment");
        equipmentSelect.innerHTML = `<option value="">Aucun matériel / sélectionner</option>${creationEquipmentOptions(event.target.value)}`;
        equipmentSelect.disabled = !event.target.value;
        if (document.getElementById("copy-client-address")?.checked) {
            const client = creationClients.find((item) => String(item.id) === String(event.target.value));
            document.getElementById("new-site-address").value = client?.adresse || "";
        }
    });
    document.getElementById("copy-client-address")?.addEventListener("change", (event) => {
        if (!event.target.checked) return;
        const client = creationClients.find((item) => String(item.id) === String(document.getElementById("new-client").value));
        document.getElementById("new-site-address").value = client?.adresse || "";
    });
    document.getElementById("new-report-template").addEventListener("change", (event) => {
        const template = reportTemplates.find((item) => String(item.id) === String(event.target.value));
        document.getElementById("new-report-fields").innerHTML = template ? renderReportFields(template, {}) : "";
        bindReportFieldActions(document.getElementById("new-report-fields"));
    });
    document.getElementById("intervention-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector("button[type='submit'], button:not([type])");
        const values = Object.fromEntries(new FormData(form));
        for (const key of Object.keys(values)) if (values[key] === "") values[key] = null;
        values.donnees_rapport = collectReportData(form);
        await withBusy(button, async () => {
            try {
                await api("/interventions", { method: "POST", body: JSON.stringify(values) });
                closeModal();
                await finishMutation("planning", "Intervention planifiée.");
            } catch (error) { toast(error.message, true); }
        });
    });
}

function renderReportFields(template, data = {}, interventionId = null, reportContext = template) {
    const sections = Array.isArray(template?.sections || template?.modele_rapport_sections) ? (template.sections || template.modele_rapport_sections) : [];
    if (!sections.length) return "";
    return `<section class="panel"><div class="panel-head"><div><h2>${escapeHtml(template.nom || template.modele_rapport_nom || "Rapport personnalisé")}</h2><p class="muted">Complétez les contrôles définis dans le modèle.</p></div></div><div class="report-fields-grid">${sections.map((section) => {
        const value = Object.hasOwn(data || {}, section.key)
            ? data[section.key]
            : section.type === "date" && section.dateMode !== "datetime-local"
              ? localDateKey(new Date())
              : (section.defaultValue ?? "");
        const attributes = `data-report-key="${escapeHtml(section.key)}" ${section.required ? "required" : ""}`;
        const labelClass = section.showLabel === false ? ' class="sr-only"' : "";
        const label = `<label${labelClass}>${escapeHtml(section.label)}${section.required ? " *" : ""}</label>`;
        const help = section.helpText ? `<span class="field-help">${escapeHtml(section.helpText)}</span>` : "";
        const wrapper = (content, extra = "") => `<div class="report-field ${section.width === "half" ? "half" : "full"} ${extra}">${content}${help}</div>`;
        if (section.type === "title") return `<h3 class="report-section-title">${escapeHtml(section.label)}</h3>`;
        if (section.type === "page_break") return `<div class="report-page-break"><hr><span class="field-help">Saut de page dans le PDF</span></div>`;
        if (["photo", "multi_photo", "event_photos"].includes(section.type)) return wrapper(`<div class="field">${label}<p class="muted">📷 Ajoutez jusqu’à ${Number(section.maxPhotos || (section.type === "photo" ? 1 : 5))} photo(s) depuis la fiche de l’intervention.</p></div>`);
        if (section.type === "technician_signature") {
            const manualSignatureUrl = typeof value === "string" && /^https?:\/\//i.test(value) ? value : "";
            const assignedTechnicianId = reportContext?.technicien_id;
            const assignedTechnicianName = reportContext?.technicien_nom || "";
            const savedTechnicianSignature = reportContext?.technicien_signature_url || "";
            const signerName = data?.[`${section.key}_name`] || assignedTechnicianName || "";
            if (!assignedTechnicianId) {
                return wrapper(`<div class="field">${label}<p class="muted">Technicien non assigné. Assignez un technicien pour utiliser ce bloc.</p><input type="hidden" data-report-key="${escapeHtml(section.key)}" value=""><input type="hidden" data-report-key="${escapeHtml(section.key)}_name" value="Technicien non assigné"></div>`, "signature-field");
            }
            if (savedTechnicianSignature) {
                const technicianName = assignedTechnicianName || "Technicien";
                return wrapper(`<div class="field">${label}<input value="${escapeHtml(technicianName)}" aria-label="Nom du technicien signataire" readonly><div class="saved-signature"><img src="${userSignatureSourceUrl(assignedTechnicianId)}" alt="Signature mémorisée de ${escapeHtml(technicianName)}"><span class="field-help">Signature mémorisée de ${escapeHtml(technicianName)}</span></div><input type="hidden" data-report-key="${escapeHtml(section.key)}" value=""><input type="hidden" data-report-key="${escapeHtml(section.key)}_name" value="${escapeHtml(technicianName)}"></div>`, "signature-field");
            }
            if (!interventionId) return wrapper(`<div class="field">${label}<p class="muted">Enregistrez d’abord l’intervention, puis ouvrez sa fiche pour recueillir la signature du technicien.</p><input type="hidden" data-report-key="${escapeHtml(section.key)}" value=""><input type="hidden" data-report-key="${escapeHtml(section.key)}_name" value="${escapeHtml(signerName)}"></div>`, "signature-field");
            return wrapper(`<div class="field report-signature-field" data-signature-field="${escapeHtml(section.key)}">${label}<input data-report-key="${escapeHtml(section.key)}_name" maxlength="150" value="${escapeHtml(signerName)}" placeholder="Nom du technicien">${manualSignatureUrl ? `<div class="saved-signature"><img src="${reportSignatureSourceUrl(interventionId, section.key)}" alt="${escapeHtml(section.label)}"><span class="field-help">Signature manuelle enregistrée</span></div>` : `<p class="muted">Aucune signature mémorisée pour ce technicien : signez manuellement ce rapport.</p>`}<canvas class="canvas report-signature-canvas" data-signature-canvas="${escapeHtml(section.key)}" aria-label="Zone de dessin pour ${escapeHtml(section.label)}"></canvas><input type="hidden" data-report-key="${escapeHtml(section.key)}" value="${escapeHtml(manualSignatureUrl)}"><div class="actions"><button class="secondary" type="button" data-clear-report-signature="${escapeHtml(section.key)}">Effacer</button><button class="primary" type="button" data-save-report-signature="${escapeHtml(section.key)}">Enregistrer</button>${manualSignatureUrl ? `<button class="danger" type="button" data-delete-report-signature="${escapeHtml(section.key)}">Supprimer</button>` : ""}</div></div>`, "signature-field");
        }
        if (["signature", "electronic_signature"].includes(section.type)) {
            const signatureUrl = typeof value === "string" && /^https?:\/\//i.test(value) ? value : "";
            const signerName = data?.[`${section.key}_name`] || "";
            if (!interventionId) return wrapper(`<div class="field">${label}<p class="muted">Enregistrez d’abord l’intervention, puis ouvrez sa fiche pour recueillir cette signature.</p><input type="hidden" data-report-key="${escapeHtml(section.key)}" value=""></div>`, "signature-field");
            return wrapper(`<div class="field report-signature-field" data-signature-field="${escapeHtml(section.key)}">${label}<input data-report-key="${escapeHtml(section.key)}_name" maxlength="150" value="${escapeHtml(signerName)}" placeholder="Nom du signataire">${signatureUrl ? `<div class="saved-signature"><img src="${reportSignatureSourceUrl(interventionId, section.key)}" alt="${escapeHtml(section.label)}"><span class="field-help">Signature enregistrée</span></div>` : ""}<canvas class="canvas report-signature-canvas" data-signature-canvas="${escapeHtml(section.key)}" aria-label="Zone de dessin pour ${escapeHtml(section.label)}"></canvas><input type="hidden" data-report-key="${escapeHtml(section.key)}" value="${escapeHtml(signatureUrl)}"><div class="actions"><button class="secondary" type="button" data-clear-report-signature="${escapeHtml(section.key)}">Effacer</button><button class="primary" type="button" data-save-report-signature="${escapeHtml(section.key)}">Enregistrer</button>${signatureUrl ? `<button class="danger" type="button" data-delete-report-signature="${escapeHtml(section.key)}">Supprimer</button>` : ""}</div></div>`, "signature-field");
        }
        if (section.type === "client") {
            const clientName = document.getElementById("new-client")?.selectedOptions?.[0]?.textContent || template.client_nom || data[section.key] || "Client sélectionné dans le rapport";
            return wrapper(`<div class="field">${label}<input value="${escapeHtml(clientName)}" disabled><input type="hidden" data-report-key="${escapeHtml(section.key)}" value="${escapeHtml(clientName)}"></div>`);
        }
        if (section.type === "equipment") return wrapper(`<div class="field">${label}<p class="muted">◇ Les informations du matériel sélectionné sont insérées automatiquement.</p></div>`);
        if (section.type === "creator") return wrapper(`<div class="field">${label}<input value="${escapeHtml(currentUser.nom)}" disabled><input type="hidden" data-report-key="${escapeHtml(section.key)}" value="${escapeHtml(currentUser.nom)}"></div>`);
        if (section.type === "gps") return wrapper(`<div class="field">${label}<div class="actions"><input ${attributes} value="${escapeHtml(value || "")}" placeholder="${escapeHtml(section.placeholder || "Latitude, longitude")}"><button type="button" class="secondary" data-capture-gps>Utiliser ma position</button></div></div>`);
        if (section.type === "address") return wrapper(`<div class="field">${label}<input ${attributes} value="${escapeHtml(value || "")}" autocomplete="street-address" placeholder="${escapeHtml(section.placeholder || "Adresse complète")}"></div>`);
        if (["table", "price_table"].includes(section.type)) return renderReportTable(section, Array.isArray(value) ? value : []);
        if (section.type === "textarea") return wrapper(`<div class="field">${label}<textarea ${attributes} rows="${Number(section.rows || 4)}" placeholder="${escapeHtml(section.placeholder || "")}">${escapeHtml(value || "")}</textarea></div>`);
        if (section.type === "select") {
            const choices = [...(section.options || []), ...(section.allowOther ? ["Autre"] : [])];
            const selected = Array.isArray(value) ? value : [value];
            const knownValues = section.options || [];
            const customValue = Array.isArray(value) ? value.find((entry) => !knownValues.includes(entry)) : (!knownValues.includes(value) && value !== "Autre" ? value : "");
            const otherInput = section.allowOther ? `<div class="field"><label>Précisez « Autre »</label><input data-report-other-for="${escapeHtml(section.key)}" value="${escapeHtml(customValue || "")}" placeholder="Saisissez votre réponse"></div>` : "";
            if (section.multiple || ["radio", "checkboxes", "segments"].includes(section.listMode)) {
                const inputType = section.multiple || section.listMode === "checkboxes" ? "checkbox" : "radio";
                return wrapper(`<fieldset class="field"><legend class="${section.showLabel === false ? "sr-only" : ""}">${escapeHtml(section.label)}${section.required ? " *" : ""}</legend><div class="checkbox-options list-mode-${escapeHtml(section.listMode || "radio")}">${choices.map((option) => `<label><input type="${inputType}" data-report-checkbox-group="${escapeHtml(section.key)}" name="${escapeHtml(section.key)}" value="${escapeHtml(option)}" ${selected.includes(option) || (option === "Autre" && customValue) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div>${otherInput}</fieldset>`);
            }
            return wrapper(`<div class="field">${label}<select ${attributes}><option value="">${escapeHtml(section.placeholder || "Sélectionner")}</option>${choices.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) || (option === "Autre" && customValue) ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}</select>${otherInput}</div>`);
        }
        if (section.type === "checkbox" && (section.options || []).length) {
            const selected = Array.isArray(value) ? value : (value ? [value] : []);
            const knownValues = section.options || [];
            const customValue = selected.find((entry) => !knownValues.includes(entry)) || "";
            const choices = [...knownValues, ...(section.allowOther ? ["Autre"] : [])];
            const otherInput = section.allowOther ? `<div class="field"><label>Précisez « Autre »</label><input data-report-other-for="${escapeHtml(section.key)}" value="${escapeHtml(customValue)}" placeholder="Saisissez votre réponse"></div>` : "";
            return wrapper(`<fieldset class="field"><legend class="${section.showLabel === false ? "sr-only" : ""}">${escapeHtml(section.label)}${section.required ? " *" : ""}</legend><div class="checkbox-options">${choices.map((option) => `<label><input type="checkbox" data-report-checkbox-group="${escapeHtml(section.key)}" value="${escapeHtml(option)}" ${selected.includes(option) || (option === "Autre" && customValue) ? "checked" : ""}> ${escapeHtml(option)}</label>`).join("")}</div>${otherInput}</fieldset>`);
        }
        if (section.type === "checkbox") return wrapper(`<div class="field"><label><input type="checkbox" ${attributes} ${value ? "checked" : ""}> ${escapeHtml(section.label)}${section.required ? " *" : ""}</label></div>`);
        const inputType = section.type === "date" ? (section.dateMode || "date") : section.type === "number" ? "number" : "text";
        const numberRules = section.type === "number" ? `${section.min !== null && section.min !== undefined ? `min="${Number(section.min)}"` : ""} ${section.max !== null && section.max !== undefined ? `max="${Number(section.max)}"` : ""} step="${Number(section.step || 1)}"` : "";
        return wrapper(`<div class="field">${label}<div class="actions"><input type="${inputType}" ${attributes} ${numberRules} value="${escapeHtml(value ?? "")}" placeholder="${escapeHtml(section.placeholder || "")}">${section.unit ? `<span class="muted">${escapeHtml(section.unit)}</span>` : ""}</div></div>`);
    }).join("")}</div></section>`;
}

function tableCellInput(column, value, rowIndex) {
    const common = `data-table-column="${escapeHtml(column.key)}" ${column.required ? "required" : ""} aria-label="${escapeHtml(column.label)}"`;
    if (column.type === "row_number") return `<input ${common} value="${rowIndex + 1}" readonly>`;
    if (column.type === "select") return `<select ${common}><option value="">Sélectionner</option>${column.options.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}${column.allowOther ? '<option value="__other__">Autre…</option>' : ""}</select>`;
    if (["boolean", "checkbox"].includes(column.type)) return `<input type="checkbox" ${common} ${value === true || value === "true" ? "checked" : ""}>`;
    if (column.type === "textarea") return `<textarea ${common} rows="2">${escapeHtml(value ?? column.defaultValue ?? "")}</textarea>`;
    if (column.type === "photo") return `<input type="file" ${common} accept="image/png,image/jpeg,image/webp">`;
    const type = ({ integer: "number", decimal: "number", currency: "number", percentage: "number", date: "date", time: "time", datetime: "datetime-local", calculated: "number" })[column.type] || "text";
    const numeric = ["integer", "decimal", "currency", "percentage", "calculated"].includes(column.type);
    const step = column.type === "integer" ? 1 : 1 / (10 ** (column.decimals || 2));
    const limits = numeric ? `${column.min != null ? `min="${Number(column.min)}"` : ""} ${column.max != null ? `max="${Number(column.max)}"` : ""} step="${step}"` : "";
    return `<input type="${type}" ${common} ${limits} ${column.type === "calculated" ? "readonly" : ""} value="${escapeHtml(value ?? column.defaultValue ?? "")}">`;
}

function reportTableRow(columns, values = {}, _priceTable = false, rowIndex = 0) {
    return `<tr>${columns.filter((column) => column.visibleForm !== false).map((column) => `<td data-label="${escapeHtml(column.label)}" class="align-${["center", "right"].includes(column.align) ? column.align : "left"}">${tableCellInput(column, values[column.key], rowIndex)}</td>`).join("")}<td data-label="Action"><button type="button" class="danger" data-remove-report-row aria-label="Supprimer la ligne">×</button></td></tr>`;
}

function renderReportTable(section, rows) {
    const columns = (section.columns?.length ? section.columns : ["Colonne 1", "Colonne 2"]).map((column, index) => normalizeTableColumn(column, index, section.type === "price_table"));
    const initialRows = rows.length ? rows : (section.defaultRows?.length ? structuredClone(section.defaultRows) : Array.from({ length: Math.max(1, section.minRows || 0) }, () => ({})));
    return `<div class="report-table field mode-${escapeHtml(section.tableMode || "table")}" data-report-table="${escapeHtml(section.key)}" data-columns="${escapeHtml(JSON.stringify(columns))}" data-min-rows="${Number(section.minRows || 0)}" data-max-rows="${Number(section.maxRows || 30)}"><label class="${section.showLabel === false ? "sr-only" : ""}">${escapeHtml(section.label)}${section.required ? " *" : ""}</label>${section.helpText ? `<span class="field-help">${escapeHtml(section.helpText)}</span>` : ""}<table><thead><tr>${columns.filter((column) => column.visibleForm !== false).map((column) => `<th class="column-width-${Math.max(1, Math.min(4, Math.round(Number(column.width) || 1)))} align-${["center", "right"].includes(column.align) ? column.align : "left"}">${escapeHtml(column.label)}${column.required ? " *" : ""}</th>`).join("")}<th></th></tr></thead><tbody>${initialRows.map((row, rowIndex) => reportTableRow(columns, row, false, rowIndex)).join("")}</tbody></table>${section.allowAddRows !== false ? '<div class="report-table-actions"><button type="button" class="secondary" data-add-report-row>＋ Ajouter une ligne</button></div>' : ""}<div class="report-table-total" data-table-calculations></div></div>`;
}

function collectReportData(form) {
    const data = [...form.querySelectorAll("[data-report-key]")].reduce((result, input) => {
        result[input.dataset.reportKey] = input.type === "checkbox" ? input.checked : input.type === "number" && input.value !== "" ? Number(input.value) : input.value;
        return result;
    }, {});
    const groupKeys = new Set([...form.querySelectorAll("[data-report-checkbox-group]")].map((input) => input.dataset.reportCheckboxGroup));
    groupKeys.forEach((key) => {
        const inputs = [...form.querySelectorAll(`[data-report-checkbox-group="${CSS.escape(key)}"]`)];
        const checked = inputs.filter((input) => input.checked).map((input) => input.value);
        data[key] = inputs[0]?.type === "radio" ? (checked[0] || "") : checked;
    });
    form.querySelectorAll("[data-report-other-for]").forEach((input) => {
        const key = input.dataset.reportOtherFor;
        const custom = input.value.trim();
        if (!custom) return;
        if (Array.isArray(data[key])) data[key] = data[key].map((value) => value === "Autre" ? custom : value);
        else if (data[key] === "Autre") data[key] = custom;
    });
    form.querySelectorAll("[data-report-table]").forEach((table) => {
        data[table.dataset.reportTable] = [...table.querySelectorAll("tbody tr")].map((row) => Object.fromEntries(
            [...row.querySelectorAll("[data-table-column]")].filter((input) => input.type !== "file").map((input) => [input.dataset.tableColumn, input.type === "checkbox" ? input.checked : input.type === "number" && input.value !== "" ? Number(input.value) : input.value.trim()])
        )).filter((row) => Object.values(row).some((value) => value !== ""));
    });
    return data;
}

function bindReportFieldActions(container = document) {
    container.querySelectorAll("[data-capture-gps]").forEach((button) => button.addEventListener("click", () => {
        if (!navigator.geolocation) return toast("La géolocalisation n’est pas disponible sur cet appareil.", true);
        withBusy(button, () => new Promise((resolve) => navigator.geolocation.getCurrentPosition(
            (position) => {
                const input = button.closest(".field").querySelector("[data-report-key]");
                input.value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                toast("Position GPS ajoutée."); resolve();
            },
            () => { toast("Impossible d’obtenir la position. Vérifiez l’autorisation GPS.", true); resolve(); },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )));
    }));
    container.querySelectorAll("[data-report-table]").forEach((table) => {
        const columns = JSON.parse(table.dataset.columns || "[]");
        const recalculate = () => {
            const rows = [...table.querySelectorAll("tbody tr")];
            const summaries = [];
            columns.forEach((column) => {
                if (!column.calculation) return;
                const numbers = rows.map((row) => Number(row.querySelector(`[data-table-column="${CSS.escape(column.key)}"]`)?.value || 0));
                const result = column.calculation === "sum" ? numbers.reduce((a, b) => a + b, 0) : column.calculation === "average" ? numbers.reduce((a, b) => a + b, 0) / Math.max(1, numbers.length) : column.calculation === "count" ? rows.length : 0;
                summaries.push(`${column.label} : ${column.type === "currency" ? formatMoney(result) : result.toLocaleString("fr-FR")}`);
            });
            table.querySelector("[data-table-calculations]").textContent = summaries.join(" · ");
        };
        table.addEventListener("click", (event) => {
            const remove = event.target.closest("[data-remove-report-row]");
            if (remove) {
                const rows = table.querySelectorAll("tbody tr");
                if (rows.length > Number(table.dataset.minRows || 0) && rows.length > 1) remove.closest("tr").remove();
                else remove.closest("tr").querySelectorAll("input").forEach((input) => { input.value = ""; });
                recalculate();
            }
            if (event.target.closest("[data-add-report-row]")) {
                const rows = table.querySelectorAll("tbody tr");
                if (rows.length >= Number(table.dataset.maxRows || 30)) return toast("Nombre maximum de lignes atteint.", true);
                table.querySelector("tbody").insertAdjacentHTML("beforeend", reportTableRow(columns, {}, false, rows.length));
            }
        });
        table.addEventListener("input", recalculate);
        recalculate();
    });
}

function reportDataSummary(item) {
    const sections = Array.isArray(item.modele_rapport_sections) ? item.modele_rapport_sections : [];
    const data = item.donnees_rapport || {};
    const rows = sections.filter((section) => Object.hasOwn(data, section.key) && !["title", "page_break", "photo", "multi_photo", "event_photos", "signature", "electronic_signature", "technician_signature"].includes(section.type));
    if (!rows.length) return "";
    return `<section class="panel"><h3>${escapeHtml(item.modele_rapport_nom || "Informations du rapport")}</h3>${rows.map((section) => {
        const value = data[section.key];
        if (["table", "price_table"].includes(section.type) && Array.isArray(value)) {
            const columns = section.columns || [];
            return `<div class="table-wrap"><strong>${escapeHtml(section.label)}</strong><table><thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead><tbody>${value.map((row) => `<tr>${columns.map((_, index) => `<td data-label="${escapeHtml(columns[index])}">${escapeHtml(row?.[`c${index}`] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        }
        const display = typeof value === "boolean" ? (value ? "Oui" : "Non") : Array.isArray(value) ? value.join(", ") : value || "—";
        return `<p><strong>${escapeHtml(section.label)}</strong><br>${escapeHtml(display)}</p>`;
    }).join("")}</section>`;
}

async function submitForm(event, path, view) {
    event.preventDefault();
    const form = formFromSubmitEvent(event);
    const submitButton = form.querySelector("button[type='submit'], button:not([type])");
    const values = Object.fromEntries(new FormData(form));
    for (const key of Object.keys(values)) if (values[key] === "") values[key] = null;
    await withBusy(submitButton, async () => {
        try {
            await api(path, { method: "POST", body: JSON.stringify(values) });
            closeModal();
            await finishMutation(view, "Enregistrement effectué.");
        } catch (error) { toast(error.message, true); }
    });
}

async function openIntervention(id) {
    const item = interventions.find((entry) => String(entry.id) === String(id));
    if (!item) return;
    if (currentUser.role === "CLIENT") {
        modal("Rapport", `<p><strong>${escapeHtml(item.titre)}</strong><br><span class="muted">${escapeHtml(item.client_nom)} · ${formatDate(item.date_intervention)}</span></p><div class="field"><label>Description</label><p>${escapeHtml(item.description || "Aucune description.")}</p></div><div class="field"><label>Compte-rendu</label><p>${escapeHtml(item.compte_rendu || "Compte-rendu non disponible.")}</p></div>${reportDataSummary(item)}${mediaGallery(item)}${pdfButton(item)}`);
        bindPdfDownload();
        return;
    }

    if (currentUser.role === "ADMIN") {
        try {
            await loadCreationOptions();
        } catch (error) {
            return toast(`Impossible de charger les clients du rapport : ${error.message}`, true);
        }
    }

    const selectedTemplateId = item.modele_rapport_id || (item.modele_rapport_sections?.length ? "__snapshot__" : "");
    const templateSelector = `<div class="field"><label>Modèle de rapport</label><select id="edit-report-template" name="modele_rapport_id"><option value="">Rapport libre</option>${selectedTemplateId === "__snapshot__" ? `<option value="__snapshot__" selected>${escapeHtml(item.modele_rapport_nom || "Modèle supprimé")} (contenu conservé)</option>` : ""}${reportTemplates.filter((template) => template.actif).map((template) => `<option value="${template.id}" ${String(template.id) === String(selectedTemplateId) ? "selected" : ""}>${escapeHtml(template.nom)}</option>`).join("")}</select></div>`;
    const siteAddressField = `<div class="field"><label>Adresse du chantier</label><input name="adresse_chantier" autocomplete="street-address" value="${escapeHtml(item.adresse_chantier || "")}"></div>`;
    const adminFields = currentUser.role === "ADMIN" ? `<div class="grid2"><div class="field"><label>Client</label><select id="edit-client" name="client_id">${creationClientOptions(creationClients, item.client_id)}</select></div><div class="field"><label>Technicien assigné</label><select name="technicien_id">${technicianOptions(item.technicien_id)}</select></div></div><div class="field"><label>Équipement concerné</label><select id="edit-equipment" name="equipement_id">${creationEquipmentOptions(item.client_id, item.equipement_id, true)}</select></div>${siteAddressField}${field("Objet de l’intervention", "titre", "text", true, item.titre)}<div class="field"><label>Description</label><textarea name="description" rows="3">${escapeHtml(item.description || "")}</textarea></div><div class="grid2">${field("Date", "date_intervention", "date", false, String(item.date_intervention || "").slice(0,10))}${field("Heure", "heure", "time", false, String(item.heure || "").slice(0,5))}</div>${templateSelector}` : "";
    const localDraft = loadReportDraft(item);
    const customReportFields = Array.isArray(item.modele_rapport_sections) && item.modele_rapport_sections.length
        ? renderReportFields(item, localDraft?.payload?.donnees_rapport || item.donnees_rapport || {}, item.id)
        : "";
    modal("Rapport d’intervention", `<form id="edit-intervention-form" data-intervention-id="${item.id}">
      <p><strong>${escapeHtml(item.titre)}</strong><br><span class="muted">${escapeHtml(item.client_nom)} · ${formatDate(item.date_intervention)}</span></p>
      ${adminFields}
      ${currentUser.role === "ADMIN" ? "" : siteAddressField}
      <input type="hidden" name="statut" value="${escapeHtml(item.statut || "TERMINEE")}">
      <div id="edit-report-fields">${customReportFields}</div>
      <div id="report-autosave-status" class="autosave-status saved" role="status" aria-live="polite">${icon("check")} Enregistré</div>
      <button class="primary wide">Enregistrer le rapport</button>
    </form><hr>${fileUpload({ id: "photo-file", name: "photo", label: "Ajouter des photos", help: "PNG, JPEG, WebP depuis l’appareil photo ou la photothèque", accept: "image/png,image/jpeg,image/webp", maxMb: 5, multiple: true })}<button class="secondary wide" id="upload-photo" type="button">${icon("upload")} Envoyer les photos</button>
    ${mediaGallery(item, true)}${pdfButton(item, true)}${emailButton(item)}`);

    bindReportFieldActions(document.getElementById("edit-intervention-form"));
    setupReportSignatureCanvases(id, document.getElementById("edit-intervention-form"));
    restoreReportDraft(item, document.getElementById("edit-intervention-form"));
    bindReportAutosave(item, document.getElementById("edit-intervention-form"));

    document.getElementById("edit-intervention-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const submitButton = form.querySelector("button[type='submit'], button:not([type])");
        const values = Object.fromEntries(new FormData(form));
        values.expected_version = item.report_version || 1;
        if (values.modele_rapport_id === "__snapshot__") delete values.modele_rapport_id;
        for (const key of Object.keys(values)) if (values[key] === "") values[key] = null;
        if (form.querySelector("[data-report-key]")) values.donnees_rapport = collectReportData(form);
        await withBusy(submitButton, async () => {
            try {
                const updated = await api(`/interventions/${id}`, { method: "PUT", body: JSON.stringify(values) });
                Object.assign(item, updated);
                clearReportDraft(item.id);
                reportAutosavePending = false;
                setAutosaveStatus("saved", "Enregistré");
                toast("Rapport enregistré.");
            } catch (error) { toast(error.message, true); }
        });
    });
    document.getElementById("edit-client")?.addEventListener("change", (event) => {
        document.getElementById("edit-equipment").innerHTML = creationEquipmentOptions(event.target.value, null, true);
    });
    document.getElementById("edit-report-template")?.addEventListener("change", (event) => {
        const container = document.getElementById("edit-report-fields");
        if (event.target.value === "__snapshot__") container.innerHTML = renderReportFields(item, item.donnees_rapport || {}, item.id);
        else {
            const template = reportTemplates.find((entry) => String(entry.id) === String(event.target.value));
            container.innerHTML = template ? renderReportFields(template, {}, item.id, item) : "";
        }
        bindReportFieldActions(container);
        setupReportSignatureCanvases(id, container);
    });
    bindFileUpload(document.querySelector("#photo-file")?.closest("[data-file-upload]"));
    document.getElementById("upload-photo").addEventListener("click", () => uploadPhoto(id));
    bindMediaActions(item);
    bindPdfDownload();
    bindReportEmail(item);
}

function reportDraftKey(id) { return `intervium_report_draft:${currentEntreprise?.id || currentUser?.entreprise_id}:${currentUser?.id}:${id}`; }
function loadReportDraft(item) { try { const draft = JSON.parse(localStorage.getItem(reportDraftKey(item.id)) || "null"); return draft?.payload && Number(draft.version) === Number(item.report_version || 1) ? draft : null; } catch { return null; } }
function clearReportDraft(id) { try { localStorage.removeItem(reportDraftKey(id)); } catch {} }
function setAutosaveStatus(state, label) {
    const node = document.getElementById("report-autosave-status"); if (!node) return;
    node.className = `autosave-status ${state}`;
    node.innerHTML = `${state === "saving" ? '<span class="spinner"></span>' : icon(state === "saved" ? "check" : "alert")} ${escapeHtml(label)}`;
}
function currentReportPayload(form) {
    const data = Object.fromEntries(new FormData(form));
    return { statut: data.statut, adresse_chantier: data.adresse_chantier || null, donnees_rapport: collectReportData(form) };
}
function persistReportDraft(item, payload) {
    try { localStorage.setItem(reportDraftKey(item.id), JSON.stringify({ interventionId: item.id, version: item.report_version || 1, payload, savedAt: new Date().toISOString() })); } catch {}
}
function restoreReportDraft(item, form) {
    const draft = loadReportDraft(item);
    if (!draft) return;
    if (draft.payload.statut && form.elements.statut) form.elements.statut.value = draft.payload.statut;
    if (form.elements.adresse_chantier && draft.payload.adresse_chantier !== undefined) form.elements.adresse_chantier.value = draft.payload.adresse_chantier || "";
    Object.entries(draft.payload.donnees_rapport || {}).forEach(([key, value]) => {
        const input = form.querySelector(`[data-report-key="${CSS.escape(key)}"]`);
        if (input && !Array.isArray(value)) input.value = value ?? "";
    });
    reportAutosavePending = true;
    setAutosaveStatus("dirty", "Brouillon local restauré");
}
function bindReportAutosave(item, form) {
    const schedule = (event) => {
        const target = event.target;
        const reportInput = target.matches('[name="statut"],[name="adresse_chantier"],[data-report-key],[data-report-checkbox-group],[data-table-column]');
        if (!reportInput) return;
        reportAutosavePending = true;
        const payload = currentReportPayload(form);
        persistReportDraft(item, payload);
        setAutosaveStatus("dirty", "Modifications non enregistrées");
        clearTimeout(reportAutosaveTimer);
        reportAutosaveTimer = setTimeout(() => saveReportDraft(item, form), 1200);
    };
    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
}
async function saveReportDraft(item, form) {
    if (!document.body.contains(form) || !reportAutosavePending) return;
    const payload = { ...currentReportPayload(form), expected_version: item.report_version || 1 };
    setAutosaveStatus("saving", "Enregistrement…");
    try {
        const updated = await api(`/interventions/${item.id}`, { method: "PUT", body: JSON.stringify(payload) });
        item.report_version = updated.report_version;
        item.statut = updated.statut;
        item.adresse_chantier = updated.adresse_chantier;
        item.donnees_rapport = updated.donnees_rapport;
        reportAutosavePending = false;
        clearReportDraft(item.id);
        setAutosaveStatus("saved", "Enregistré");
    } catch (error) {
        persistReportDraft(item, payload);
        setAutosaveStatus("error", error.code === "REPORT_VERSION_CONFLICT" ? "Conflit : rechargez le rapport" : "Erreur de sauvegarde — brouillon conservé");
    }
}

window.addEventListener("beforeunload", (event) => { if (reportAutosavePending) { event.preventDefault(); event.returnValue = ""; } });
window.addEventListener("online", () => { const form = document.getElementById("edit-intervention-form"); const item = interventions.find((entry) => String(entry.id) === String(form?.dataset.interventionId)); if (form && item && loadReportDraft(item)) saveReportDraft(item, form); });

async function uploadPhoto(id) {
    const item = interventions.find((entry) => String(entry.id) === String(id));
    const photoSections = (item?.modele_rapport_sections || []).filter((section) => ["photo", "multi_photo", "event_photos"].includes(section.type));
    const photoLimit = photoSections.reduce((total, section) => total + Math.max(1, Number(section.maxPhotos) || (section.type === "photo" ? 1 : 5)), 0);
    if (photoSections.length && (item.photos || []).length >= photoLimit) {
        return toast(`La limite de ${photoLimit} photo(s) définie par le modèle est atteinte.`, true);
    }
    const input = document.getElementById("photo-file");
    const files = [...(input?.files || [])];
    if (!files.length) return toast("Sélectionnez au moins une photo.", true);
    if (!input.checkValidity()) return toast(input.validationMessage, true);
    if (photoSections.length && (item.photos || []).length + files.length > photoLimit) {
        const remaining = Math.max(0, photoLimit - (item.photos || []).length);
        return toast(`Le modèle autorise encore ${remaining} photo(s).`, true);
    }
    const button = document.getElementById("upload-photo");
    await withBusy(button, async () => {
        const uploaded = [];
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append("photo", file);
                const result = await api(`/uploads/photo/${id}`, { method: "POST", body: formData });
                uploaded.push(result.photo);
            }
            item.photos = [...(Array.isArray(item.photos) ? item.photos : []), ...uploaded];
            item.nombre_photos = item.photos.length;
            openIntervention(id);
            toast(`${uploaded.length} photo(s) envoyée(s).`);
        } catch (error) {
            if (uploaded.length) {
                item.photos = [...(Array.isArray(item.photos) ? item.photos : []), ...uploaded];
                item.nombre_photos = item.photos.length;
                openIntervention(id);
                return toast(`${uploaded.length} photo(s) envoyée(s), puis l’import a échoué : ${error.message}`, true);
            }
            toast(error.message, true);
        }
    });
}

function setupReportSignatureCanvases(interventionId, root) {
    root?.querySelectorAll("[data-signature-canvas]").forEach((canvas) => {
        const key = canvas.dataset.signatureCanvas;
        const field = canvas.closest("[data-signature-field]");
        bindSignatureCanvas({
            canvas,
            clearButton: field?.querySelector("[data-clear-report-signature]"),
            saveButton: field?.querySelector("[data-save-report-signature]"),
            onEmpty: () => toast("La signature est vide.", true),
            onSave: async ({ event, signatureData }) => {
                const pendingPayload = root?.matches("form") ? currentReportPayload(root) : { donnees_rapport: {} };
                await withBusy(event.currentTarget, async () => {
                    try {
                        const item = interventions.find((entry) => String(entry.id) === String(interventionId));
                        const signerName = field?.querySelector(`[data-report-key="${CSS.escape(`${key}_name`)}"]`)?.value || "";
                        const result = await api(`/uploads/signature-field/${interventionId}/${encodeURIComponent(key)}`, { method: "POST", body: JSON.stringify({ signatureData, signerName }) });
                        item.donnees_rapport = {
                            ...(pendingPayload.donnees_rapport || {}),
                            ...(result.donnees_rapport || { [key]: result.signature_url, [`${key}_name`]: result.signer_name || "" }),
                        };
                        item.report_version = result.report_version;
                        persistReportDraft(item, { ...pendingPayload, donnees_rapport: item.donnees_rapport });
                        reportAutosavePending = true;
                        openIntervention(interventionId); toast("Signature enregistrée.");
                    } catch (error) { toast(error.message, true); }
                });
            }});
        field?.querySelector("[data-delete-report-signature]")?.addEventListener("click", async (event) => {
            if (!confirm("Supprimer cette signature ?")) return;
            const pendingPayload = root?.matches("form") ? currentReportPayload(root) : { donnees_rapport: {} };
            await withBusy(event.currentTarget, async () => {
                try {
                    const result = await api(`/uploads/signature-field/${interventionId}/${encodeURIComponent(key)}`, { method: "DELETE" });
                    const item = interventions.find((entry) => String(entry.id) === String(interventionId));
                    item.donnees_rapport = result.donnees_rapport || { ...(item.donnees_rapport || {}) };
                    delete item.donnees_rapport[key];
                    delete item.donnees_rapport[`${key}_name`];
                    item.report_version = result.report_version;
                    pendingPayload.donnees_rapport = { ...(pendingPayload.donnees_rapport || {}) }; delete pendingPayload.donnees_rapport[key];
                    delete pendingPayload.donnees_rapport[`${key}_name`];
                    persistReportDraft(item, pendingPayload); reportAutosavePending = true;
                    openIntervention(interventionId); toast("Signature supprimée.");
                } catch (error) { toast(error.message, true); }
            });
        });
    });
}

async function refresh(view) { await loadAllData(); renderMain(view); }
async function finishMutation(view, successMessage) {
    try {
        await refresh(view);
        toast(successMessage);
    } catch (error) {
        renderMain(view);
        toast(`${successMessage} Actualisation partielle : ${error.message}`, true);
    }
}
async function withBusy(button, action) {
    if (!button || button.disabled) return;
    const previousContent = button.innerHTML;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span class="sr-only">Traitement en cours</span>`;
    try { await action(); } finally {
        if (button.isConnected) {
            button.disabled = false;
            button.removeAttribute("aria-busy");
            button.innerHTML = previousContent;
        }
    }
}
function clientOptions(selectedId = null) { return clients.map((c) => `<option value="${c.id}" ${String(c.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(c.nom)}</option>`).join(""); }
function creationClientOptions(source = creationClients, selectedId = null) { return source.map((client) => `<option value="${client.id}" ${String(client.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(client.nom)}</option>`).join(""); }
function creationEquipmentOptions(clientId, selectedId = null, allowEmpty = false) {
    const options = creationEquipements.filter((item) => String(item.client_id) === String(clientId));
    return `${allowEmpty ? '<option value="">Non renseigné</option>' : ""}${options.map((item) => `<option value="${item.id}" ${String(item.id) === String(selectedId) ? "selected" : ""}>${escapeHtml([item.type, item.modele, item.numero_serie].filter(Boolean).join(" · ") || `Équipement ${item.id}`)}</option>`).join("")}`;
}
function technicianOptions(selectedId = null) { return `<option value="">Non assigné</option>${technicians.filter((user) => user.actif || String(user.id) === String(selectedId)).map((user) => `<option value="${user.id}" ${String(user.id) === String(selectedId) ? "selected" : ""}>${escapeHtml(user.nom)}${user.actif ? "" : " (désactivé)"}</option>`).join("")}`; }
function mediaGallery(item, allowPdfSelection = false) {
    const photos = Array.isArray(item.photos) ? item.photos : [];
    if (!photos.length && !item.signature_url) return `<p class="muted">Aucun média enregistré.</p>`;
    const canDelete = currentUser.role !== "CLIENT";
    const selectionHelp = allowPdfSelection && photos.length
        ? '<p class="field-help">Cochez les photos à inclure dans le prochain PDF.</p>'
        : "";
    return `<div class="field"><label>Photos et signature enregistrées</label>${selectionHelp}<div class="media-grid">${photos.map((photo) => { const sourceUrl = photoSourceUrl(photo.id); return `<div class="media-item"><a href="${sourceUrl}" target="_blank" rel="noopener"><img src="${sourceUrl}" alt="Photo du rapport" class="rotation-${[90, 180, 270].includes(Number(photo.rotation)) ? Number(photo.rotation) : 0}"></a>${allowPdfSelection ? `<label class="media-pdf-choice"><input type="checkbox" data-pdf-photo-id="${photo.id}" checked> Inclure au PDF</label>` : ""}${canDelete ? `<button class="secondary" type="button" data-annotate-photo="${photo.id}">✎ Annoter</button><button class="secondary" type="button" data-rotate-photo="${photo.id}" title="Faire pivoter la photo">↻ Pivoter</button><button class="media-delete" data-delete-photo="${photo.id}" aria-label="Supprimer cette photo" title="Supprimer la photo">${icon("trash")}</button>` : ""}</div>`; }).join("")}${item.signature_url ? `<div class="media-item signature"><a href="${signatureSourceUrl(item.id)}" target="_blank" rel="noopener"><img src="${signatureSourceUrl(item.id)}" alt="Signature du client"></a>${canDelete ? `<button class="media-delete" data-delete-signature="${item.id}" aria-label="Supprimer la signature" title="Supprimer la signature">${icon("trash")}</button>` : ""}</div>` : ""}</div></div>`;
}
function bindMediaActions(item) {
    document.querySelectorAll("[data-annotate-photo]").forEach((button) => button.addEventListener("click", () => {
        const photo = (item.photos || []).find((entry) => String(entry.id) === String(button.dataset.annotatePhoto));
        if (photo) openPhotoAnnotator(item, photo);
    }));
    document.querySelectorAll("[data-rotate-photo]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => {
        const photo = (item.photos || []).find((entry) => String(entry.id) === String(button.dataset.rotatePhoto));
        if (!photo) return;
        try {
            const result = await api(`/uploads/photo/${photo.id}/rotation`, { method: "PATCH", body: JSON.stringify({ rotation: ((Number(photo.rotation) || 0) + 90) % 360 }) });
            Object.assign(photo, result.photo);
            openIntervention(item.id);
            toast("Photo pivotée.");
        } catch (error) { toast(error.message, true); }
    })));
    document.querySelectorAll("[data-delete-photo]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => {
        if (!confirm("Supprimer définitivement cette photo ?")) return;
        try {
            await api(`/uploads/photo/${button.dataset.deletePhoto}`, { method: "DELETE" });
            item.photos = (item.photos || []).filter((photo) => String(photo.id) !== String(button.dataset.deletePhoto));
            item.nombre_photos = item.photos.length;
            openIntervention(item.id);
            toast("Photo supprimée.");
        } catch (error) { toast(error.message, true); }
    })));
    document.querySelectorAll("[data-delete-signature]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => {
        if (!confirm("Supprimer définitivement la signature ?")) return;
        try {
            await api(`/uploads/signature/${item.id}`, { method: "DELETE" });
            item.signature_url = null;
            openIntervention(item.id);
            toast("Signature supprimée.");
        } catch (error) { toast(error.message, true); }
    })));
}

async function openPhotoAnnotator(item, photo) {
    modal("Annoter la photo", `<div class="field"><label>Couleur du trait</label><input id="annotation-color" type="color" value="#ef4444"></div><canvas id="photo-annotation-canvas" class="canvas photo-annotation-canvas"></canvas><div class="actions"><button class="secondary" id="reset-photo-annotation" type="button">Effacer les annotations</button><button class="primary" id="save-photo-annotation" type="button">Enregistrer l’image</button></div>`);
    const canvas = document.getElementById("photo-annotation-canvas");
    const context = canvas.getContext("2d");
    try {
        const response = await fetch(photoSourceUrl(photo.id), { credentials: "include" });
        if (!response.ok) throw new Error("Impossible de charger la photo.");
        const bitmap = await createImageBitmap(await response.blob());
        const rotation = Number(photo.rotation) || 0;
        const rotated = rotation === 90 || rotation === 270;
        const sourceWidth = rotated ? bitmap.height : bitmap.width;
        const sourceHeight = rotated ? bitmap.width : bitmap.height;
        const scale = Math.min(1, 1200 / sourceWidth, 900 / sourceHeight);
        canvas.width = Math.round(sourceWidth * scale);
        canvas.height = Math.round(sourceHeight * scale);
        const drawBase = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.save();
            context.translate(canvas.width / 2, canvas.height / 2);
            context.rotate(rotation * Math.PI / 180);
            context.drawImage(bitmap, -bitmap.width * scale / 2, -bitmap.height * scale / 2, bitmap.width * scale, bitmap.height * scale);
            context.restore();
        };
        drawBase();
        let drawing = false;
        const point = (event) => { const box = canvas.getBoundingClientRect(); return { x: (event.clientX - box.left) * canvas.width / box.width, y: (event.clientY - box.top) * canvas.height / box.height }; };
        canvas.addEventListener("pointerdown", (event) => { drawing = true; canvas.setPointerCapture(event.pointerId); const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); });
        canvas.addEventListener("pointermove", (event) => { if (!drawing) return; const p = point(event); context.strokeStyle = document.getElementById("annotation-color").value; context.lineWidth = Math.max(4, canvas.width / 180); context.lineCap = "round"; context.lineJoin = "round"; context.lineTo(p.x, p.y); context.stroke(); });
        canvas.addEventListener("pointerup", () => { drawing = false; });
        document.getElementById("reset-photo-annotation").addEventListener("click", drawBase);
        document.getElementById("save-photo-annotation").addEventListener("click", (event) => withBusy(event.currentTarget, async () => {
            try {
                const result = await api(`/uploads/photo/${photo.id}/image`, { method: "PATCH", body: JSON.stringify({ imageData: canvas.toDataURL("image/png") }) });
                Object.assign(photo, result.photo);
                openIntervention(item.id);
                toast("Photo annotée enregistrée.");
            } catch (error) { toast(error.message, true); }
        }));
    } catch (error) {
        closeModal();
        toast(error.message, true);
    }
}
function pdfButton(item, usePhotoSelection = false) { return `<p><button class="primary wide" data-download-pdf="${item.id}" ${usePhotoSelection ? "data-use-photo-selection" : ""}>${icon("download")} Exporter le rapport en PDF</button></p>`; }
function emailButton(item) { const connection=emailMailStatus.connections.find((entry)=>entry.status==="ACTIVE"); return connection ? `<p><button class="secondary wide" type="button" data-email-report="${item.id}">✉ Envoyer avec ${escapeHtml(connection.email)}</button></p>` : ""; }

function bindReportEmail(item) {
    document.querySelector(`[data-email-report="${item.id}"]`)?.addEventListener("click", () => openReportEmail(item));
}

function defaultReportEmailMessage(item) {
    const settings = currentEntreprise?.report_settings || {};
    const template = settings.default_email_message || `Bonjour,\n\nVeuillez trouver ci-joint le rapport « {titre} ».\n\nCordialement,\n{entreprise}`;
    const variables = {
        titre: item.titre || "",
        numero: item.numero_rapport || item.id || "",
        client: item.client_nom || "",
        entreprise: settings.display_name || currentEntreprise?.nom || "",
    };
    return template.replace(/\{(titre|numero|client|entreprise)\}/g, (_match, key) => variables[key]);
}

function openReportEmail(item) {
    const selectedPhotoIds = [...document.querySelectorAll("[data-pdf-photo-id]:checked")].map((input) => Number(input.dataset.pdfPhotoId));
    const client = clients.find((entry) => String(entry.id) === String(item.client_id));
    const savedEmails = [...new Set([...(client?.report_emails || []), ...(client?.contact_report_emails || []), client?.email].filter(Boolean))];
    modal("Envoyer le rapport", `<form id="report-email-form"><div class="field"><label>Compte expéditeur</label><select name="connection_id">${emailMailStatus.connections.filter((entry)=>entry.status==="ACTIVE"&&entry.id).map((entry)=>`<option value="${entry.id}">${escapeHtml(entry.email)} · ${escapeHtml(entry.provider)}</option>`).join("")}</select></div><div class="field"><label>Destinataires enregistrés</label><div class="checkbox-options">${savedEmails.length ? savedEmails.map((email) => `<label><input type="checkbox" name="saved_recipient" value="${escapeHtml(email)}" checked> ${escapeHtml(email)}</label>`).join("") : '<span class="muted">Aucune adresse enregistrée.</span>'}</div></div><div class="field"><label>Adresses libres supplémentaires</label><textarea name="free_recipients" rows="3" placeholder="Une adresse par ligne"></textarea></div><div class="field"><label>Objet</label><input name="subject" value="${escapeHtml(`Rapport ${item.titre}`)}"></div><div class="field"><label>Message</label><textarea name="message" rows="5">${escapeHtml(defaultReportEmailMessage(item))}</textarea></div><button class="primary wide" type="submit">Envoyer avec le PDF</button></form>`);
    document.getElementById("report-email-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = formFromSubmitEvent(event);
        const button = form.querySelector('button[type="submit"]');
        const freeRecipients = parseEmailList(form.elements.free_recipients.value);
        const recipients = [...form.querySelectorAll('[name="saved_recipient"]:checked')].map((input) => input.value).concat(freeRecipients);
        await withBusy(button, async () => {
            try {
                await api(`/interventions/${item.id}/email`, { method: "POST", body: JSON.stringify({ connection_id: Number(form.elements.connection_id.value), recipients, free_recipients: freeRecipients, photo_ids: selectedPhotoIds, subject: form.elements.subject.value, message: form.elements.message.value }) });
                closeModal();
                toast("Rapport envoyé par e-mail.");
            } catch (error) { toast(error.message, true); }
        });
    });
}
function bindPdfDownload() {
    document.querySelectorAll("[data-download-pdf]").forEach((button) => button.addEventListener("click", () => withBusy(button, async () => {
        try {
            const selectedPhotoIds = button.hasAttribute("data-use-photo-selection")
                ? [...document.querySelectorAll("[data-pdf-photo-id]:checked")].map((input) => input.dataset.pdfPhotoId)
                : null;
            const query = selectedPhotoIds === null ? "" : `?photo_ids=${encodeURIComponent(selectedPhotoIds.join(","))}`;
            const response = await fetch(`/api/interventions/${button.dataset.downloadPdf}/pdf${query}`, { credentials: "include" });
            if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || "Impossible de générer le PDF.");
            }
            const objectUrl = URL.createObjectURL(await response.blob());
            const link = document.createElement("a");
            link.href = objectUrl;
            const disposition = response.headers.get("content-disposition") || "";
            const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
            link.download = filename || `rapport-${button.dataset.downloadPdf}.pdf`;
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            toast("Rapport PDF téléchargé.");
        } catch (error) { toast(error.message, true); }
    })));
}
function toast(message, bad = false) { document.querySelector(".toast")?.remove(); const node = document.createElement("div"); node.className = `toast ${bad ? "bad" : ""}`; node.setAttribute("role", bad ? "alert" : "status"); node.innerHTML = `${icon(bad ? "alert" : "check")}<span>${escapeHtml(message)}</span>`; document.body.append(node); setTimeout(() => node.remove(), 3500); }
