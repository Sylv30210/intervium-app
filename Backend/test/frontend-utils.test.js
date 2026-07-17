import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, formatMoney, statusLabel } from "../../Frontend/utils/format.js";
import { icon } from "../../Frontend/components/icons.js";
import { parseEmailList } from "../../Frontend/clients/forms.js";
import { calculateDocumentTotals } from "../../Frontend/documents/totals.js";

test("les valeurs injectées dans l'interface sont échappées", () => {
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("les modules clients et documents restent indépendants de l’application", () => {
    assert.deepEqual(parseEmailList("a@example.test; b@example.test\nc@example.test"), ["a@example.test", "b@example.test", "c@example.test"]);
    assert.deepEqual(calculateDocumentTotals([{ quantite: 2, prix_unitaire: 50, taux_tva: 20 }]), { ht: 100, tva: 20 });
});

test("les utilitaires de présentation restent stables", () => {
    assert.equal(statusLabel("TERMINEE"), "Terminée");
    assert.match(formatMoney(12.5), /12,50/);
    assert.match(icon("search"), /^<svg/);
});
