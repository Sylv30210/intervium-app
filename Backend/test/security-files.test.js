import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("la migration super-développeur ne contient plus de compte ni de hash", async () => {
    const migration = await readFile(new URL("../database/migrations/015_super_developer.sql", import.meta.url), "utf8");
    assert.doesNotMatch(migration, /@/);
    assert.doesNotMatch(migration, /\$2[aby]\$/);
    assert.doesNotMatch(migration, /INSERT INTO utilisateurs/i);
});

test("le provisionnement exige un secret temporaire robuste", async () => {
    const script = await readFile(new URL("../scripts/provision-super-developer.js", import.meta.url), "utf8");
    assert.match(script, /SUPER_DEVELOPER_EMAIL/);
    assert.match(script, /SUPER_DEVELOPER_PASSWORD/);
    assert.doesNotMatch(script, /lecoeuvresylvain1@gmail\.com/);
});
