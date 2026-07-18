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

    assert.match(frontend, /Passer le tutoriel/);
    assert.match(frontend, /Relancer le tutoriel/);
    assert.match(frontend, /Étape \$\{index \+ 1\} sur \$\{steps\.length\}/);
    assert.match(frontend, /if \(!currentUser\.onboarding_completed\)/);
    assert.match(frontend, /completed: false/);
    assert.match(frontend, /completed: true/);
});
