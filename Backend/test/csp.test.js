import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("la CSP et le frontend n'autorisent plus de code inline", async () => {
    const [server, index, offline, app] = await Promise.all([
        readFile(new URL("../server.js", import.meta.url), "utf8"),
        readFile(new URL("../../Frontend/index.html", import.meta.url), "utf8"),
        readFile(new URL("../../Frontend/offline.html", import.meta.url), "utf8"),
        readFile(new URL("../../Frontend/app.js", import.meta.url), "utf8"),
    ]);
    assert.doesNotMatch(server, /unsafe-inline/);
    for (const source of [index, offline]) {
        assert.doesNotMatch(source, /<style[\s>]/i);
        assert.doesNotMatch(source, /<script(?![^>]*\bsrc=)/i);
        assert.doesNotMatch(source, /\son\w+=/i);
    }
    assert.doesNotMatch(app, /\sstyle=/i);
});
