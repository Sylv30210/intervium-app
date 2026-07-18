import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("la migration super-développeur ne contient plus de compte ni de hash", async () => {
    const migration = await readFile(new URL("../database/migrations/015_super_developer.sql", import.meta.url), "utf8");
    assert.doesNotMatch(migration, /@/);
    assert.doesNotMatch(migration, /\$2[aby]\$/);
    assert.doesNotMatch(migration, /INSERT INTO utilisateurs/i);
});

test("la régularisation de 015 n'accepte que la transition de checksum assainie", async () => {
    const migration = await readFile(new URL("../database/migrations/021_reconcile_sanitized_migration_checksum.sql", import.meta.url), "utf8");
    assert.match(migration, /WHERE filename = '015_super_developer\.sql'/);
    assert.match(migration, /checksum = '9a8c5e96e2b87184d0fca332cec9e451fe6c795afedec04255292341d847c26b'/);
    assert.match(migration, /SET checksum = '82b2a44d3d2680ad5ef88d9b7a5c0a985f44ab8aad4049cff841d6a389804860'/);
    assert.doesNotMatch(migration, /UPDATE utilisateurs|INSERT INTO utilisateurs/i);
});

test("le provisionnement exige un secret temporaire robuste", async () => {
    const script = await readFile(new URL("../scripts/provision-super-developer.js", import.meta.url), "utf8");
    assert.match(script, /SUPER_DEVELOPER_EMAIL/);
    assert.match(script, /SUPER_DEVELOPER_PASSWORD/);
    assert.doesNotMatch(script, /lecoeuvresylvain1@gmail\.com/);
});
