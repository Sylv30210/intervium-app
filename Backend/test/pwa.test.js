import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("le service worker ne met jamais les données privées en cache", async () => {
    const source = await readFile(new URL("../../Frontend/sw.js", import.meta.url), "utf8");
    assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/);
    assert.match(source, /networkOnly\(request\)/);
    assert.match(source, /"\/app\.css"/);
    assert.match(source, /"\/utils\/theme\.js"/);
});
