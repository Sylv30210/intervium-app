import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, formatMoney, statusLabel } from "../../Frontend/utils/format.js";
import { icon } from "../../Frontend/components/icons.js";

test("les valeurs injectées dans l'interface sont échappées", () => {
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("les utilitaires de présentation restent stables", () => {
    assert.equal(statusLabel("TERMINEE"), "Terminée");
    assert.match(formatMoney(12.5), /12,50/);
    assert.match(icon("search"), /^<svg/);
});
