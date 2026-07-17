import test from "node:test";
import assert from "node:assert/strict";
import { safeReportValue, validateTemplateData } from "../routes/interventions.js";

const template = { sections: [
    { key: "temperature", label: "Température", type: "number", required: true, min: 0, max: 100 },
    { key: "result", label: "Résultat", type: "select", options: ["Conforme", "Non conforme"] },
    { key: "rows", label: "Mesures", type: "table", minRows: 1, maxRows: 2, columns: [
        { key: "value", label: "Valeur", type: "decimal", required: true, min: 0 },
    ] },
] };

test("un rapport typé valide est accepté", () => {
    assert.equal(validateTemplateData(template, { temperature: 20, result: "Conforme", rows: [{ value: 2.5 }] }), null);
});

test("une signature de modèle obligatoire doit être enregistrée", () => {
    const signatureTemplate = { sections: [{ key: "validation_technicien", label: "Signature du technicien", type: "signature", required: true }] };
    assert.match(validateTemplateData(signatureTemplate, {}), /Signature du technicien/);
    assert.equal(validateTemplateData(signatureTemplate, { validation_technicien: "https://example.test/signature.png" }), null);
    assert.equal(validateTemplateData(signatureTemplate, {}, { requireSignatures: false }), null);
});

test("les bornes, choix et colonnes typées sont contrôlés", () => {
    assert.match(validateTemplateData(template, { temperature: 120, result: "Conforme", rows: [{ value: 2 }] }), /inférieur ou égal/);
    assert.match(validateTemplateData(template, { temperature: 20, result: "Autre", rows: [{ value: 2 }] }), /Valeur invalide/);
    assert.match(validateTemplateData(template, { temperature: 20, result: "Conforme", rows: [{ value: "abc" }] }), /numérique invalide/);
});

test("les charges de rapport trop profondes sont neutralisées", () => {
    let value = "x";
    for (let index = 0; index < 20; index += 1) value = { nested: value };
    assert.doesNotThrow(() => safeReportValue(value));
});
