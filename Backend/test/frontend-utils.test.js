import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { escapeHtml, formatMoney, statusLabel } from "../../Frontend/utils/format.js";
import { icon } from "../../Frontend/components/icons.js";
import { parseEmailList } from "../../Frontend/clients/forms.js";
import { calculateDocumentTotals } from "../../Frontend/documents/totals.js";
import { companyLogoSourceUrl, photoSourceUrl, reportSignatureSourceUrl, signatureSourceUrl } from "../../Frontend/utils/media.js";

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

test("les aperçus de médias utilisent les sources authentifiées", () => {
    assert.equal(companyLogoSourceUrl(), "/api/uploads/company-logo/source");
    assert.equal(photoSourceUrl(42), "/api/uploads/photo/42/source");
    assert.equal(signatureSourceUrl(17), "/api/uploads/signature/17/source");
    assert.equal(
        reportSignatureSourceUrl(17, "validation client"),
        "/api/uploads/signature-field/17/validation%20client/source"
    );
});

test("la création d'un rapport direct n'est plus proposée dans l'interface", async () => {
    const app = await readFile(new URL("../../Frontend/app.js", import.meta.url), "utf8");
    assert.doesNotMatch(app, /Créer un rapport direct|data-quick-action=["']direct-report|choose-direct/);
    assert.match(app, /Rapport direct/);
});
