import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { escapeHtml, formatMoney, statusLabel } from "../../Frontend/utils/format.js";
import { icon } from "../../Frontend/components/icons.js";
import { parseEmailList } from "../../Frontend/clients/forms.js";
import { calculateDocumentTotals } from "../../Frontend/documents/totals.js";
import { companyLogoSourceUrl, photoSourceUrl, reportSignatureSourceUrl, signatureSourceUrl, userSignatureSourceUrl } from "../../Frontend/utils/media.js";
import { COLLECTION_PAGE_LIMIT, collectionPageUrl } from "../../Frontend/utils/collections.js";
import { adminCopyRecipients, normalizeEmailList } from "../services/email-admin-copy.js";

test("les valeurs injectées dans l'interface sont échappées", () => {
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("les modules clients et documents restent indépendants de l’application", () => {
    assert.deepEqual(parseEmailList("a@example.test; b@example.test\nc@example.test"), ["a@example.test", "b@example.test", "c@example.test"]);
    assert.deepEqual(calculateDocumentTotals([{ quantite: 2, prix_unitaire: 50, taux_tva: 20 }]), { ht: 100, tva: 20 });
});

test("la copie automatique admin des e-mails de rapport reste masquée et sans doublon", () => {
    assert.deepEqual(normalizeEmailList([" Admin@Example.test ", "bad", "admin@example.test"]), ["admin@example.test"]);
    assert.deepEqual(
        adminCopyRecipients(["admin@example.test", "client@example.test"], ["client@example.test"]),
        ["admin@example.test"]
    );
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
    assert.equal(userSignatureSourceUrl(9), "/api/uploads/user-signature/9/source");
});

test("les listes gardent une pagination stable et transmettent la recherche au serveur", () => {
    assert.equal(COLLECTION_PAGE_LIMIT, 20);
    assert.equal(
        collectionPageUrl("interventions", { page: 2, limit: COLLECTION_PAGE_LIMIT, query: " Provence " }),
        "/interventions?page=2&limit=20&q=Provence"
    );
});

test("le sélecteur de photos de rapport laisse le choix entre caméra et photothèque", async () => {
    const app = await readFile(new URL("../../Frontend/app.js", import.meta.url), "utf8");
    assert.match(app, /id: "photo-file"[\s\S]*multiple: true/);
    assert.doesNotMatch(app, /id: "photo-file"[\s\S]{0,300}capture: "environment"/);
});

test("la création d'un rapport direct n'est plus proposée dans l'interface", async () => {
    const app = await readFile(new URL("../../Frontend/app.js", import.meta.url), "utf8");
    assert.doesNotMatch(app, /Créer un rapport direct|data-quick-action=["']direct-report|choose-direct/);
    assert.match(app, /Rapport direct/);
});

test("la saisie du rapport reste ouverte et complète après enregistrement ou signature", async () => {
    const app = await readFile(new URL("../../Frontend/app.js", import.meta.url), "utf8");
    const uploads = await readFile(new URL("../routes/uploads.js", import.meta.url), "utf8");
    assert.match(app, /toast\("Rapport enregistr/);
    assert.doesNotMatch(app, /closeModal\(\);\s*await finishMutation\("interventions", "Rapport enregistr/);
    assert.match(app, /signerName/);
    assert.match(app, /uploads\/signature-field/);
    assert.match(app, /technician_signature/);
    assert.match(app, /Nom du technicien signataire/);
    assert.match(app, /uploads\/user-signature\/me/);
    assert.doesNotMatch(app, /JSON\.stringify\(fullPayload\)/);
    assert.match(uploads, /signerName/);
    assert.match(uploads, /\$\{sectionKey\}_name/);
    assert.match(uploads, /RETURNING id, report_version, donnees_rapport/);
});

test("la suppression définitive de compte exige une zone dangereuse et une confirmation", async () => {
    const app = await readFile(new URL("../../Frontend/app.js", import.meta.url), "utf8");
    const auth = await readFile(new URL("../routes/auth.js", import.meta.url), "utf8");
    assert.match(app, /Zone dangereuse/);
    assert.match(app, /Tapez exactement SUPPRIMER/);
    assert.match(app, /api\(\"\/auth\/account\"/);
    assert.match(auth, /router\.delete\(\"\/account\"/);
    assert.match(auth, /confirmation !== "SUPPRIMER"/);
    assert.match(auth, /res\.clearCookie\(COOKIE_NAME/);
});

test("les rapports exposent le choix autre, le nom du signataire et le message e-mail par défaut", async () => {
    const app = await readFile(new URL("../../Frontend/app.js", import.meta.url), "utf8");
    assert.match(app, /data-report-other-for="\$\{escapeHtml\(section\.key\)\}"/);
    assert.match(app, /placeholder="Nom du signataire"/);
    assert.match(app, /default_email_message/);
    assert.match(app, /defaultReportEmailMessage\(item\)/);
});

test("les réglages visuels PDF exposent logo global et styles de titres", async () => {
    const app = await readFile(new URL("../../Frontend/app.js", import.meta.url), "utf8");
    const auth = await readFile(new URL("../routes/auth.js", import.meta.url), "utf8");
    const modeles = await readFile(new URL("../routes/modeles.js", import.meta.url), "utf8");

    assert.match(app, /name="logo_scale"/);
    assert.match(app, /name="report_number_start_sequence"/);
    assert.match(app, /Dernier numéro papier utilisé/);
    assert.match(app, /fieldTitleStyle/);
    assert.match(auth, /logo_scale/);
    assert.match(auth, /report_number_start_sequence/);
    assert.match(modeles, /fieldTitleStyle/);
});
