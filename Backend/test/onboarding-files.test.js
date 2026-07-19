import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("l’onboarding possède un état de compte distinct du consentement", async () => {
    const migration = await readFile(new URL("../database/migrations/022_user_onboarding.sql", import.meta.url), "utf8");
    const auth = await readFile(new URL("../routes/auth.js", import.meta.url), "utf8");

    assert.match(migration, /onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE/i);
    assert.match(migration, /cookies_choice DROP NOT NULL/i);
    assert.match(auth, /router\.put\("\/onboarding"/);
    assert.match(auth, /onboarding_completed: user\.onboarding_completed === true/);
});

test("le tutoriel peut être terminé, ignoré et relancé depuis les paramètres", async () => {
    const frontend = await readFile(new URL("../../Frontend/app.js", import.meta.url), "utf8");
    const css = await readFile(new URL("../../Frontend/app.css", import.meta.url), "utf8");

    assert.match(frontend, /Passer le tutoriel/);
    assert.match(frontend, /Relancer le tutoriel/);
    assert.match(frontend, /Étape \$\{index \+ 1\} sur \$\{steps\.length\}/);
    assert.match(frontend, /if \(!currentUser\.onboarding_completed\)/);
    assert.match(frontend, /completed: false/);
    assert.match(frontend, /completed: true/);
    assert.match(frontend, /Tableau de bord/);
    assert.match(frontend, /Planifier une intervention/);
    assert.match(frontend, /Modèles de rapport/);
    assert.match(frontend, /Rapports, photos et PDF/);
    assert.match(frontend, /Recherche et notifications/);
    assert.match(frontend, /class="onboarding-list"/);
    assert.match(css, /\.onboarding-list/);
});

test("l’en-tête mobile affiche le compte et l’entreprise connectés", async () => {
    const frontend = await readFile(new URL("../../Frontend/app.js", import.meta.url), "utf8");
    const css = await readFile(new URL("../../Frontend/app.css", import.meta.url), "utf8");

    assert.match(frontend, /const sessionCompany = currentEntreprise\?\.nom \|\| "Votre entreprise"/);
    assert.match(frontend, /const sessionRole = currentUser\.role === "ADMIN"/);
    assert.match(frontend, /class="mobile-session"/);
    assert.match(frontend, /\$\{escapeHtml\(sessionCompany\)\} · \$\{escapeHtml\(sessionRole\)\}/);
    assert.match(css, /\.mobile-session/);
    assert.doesNotMatch(css, /\.mobile-user-name\{display:none\}/);
});
