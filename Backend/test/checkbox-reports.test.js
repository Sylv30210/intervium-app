import test from "node:test";
import assert from "node:assert/strict";
import { validateTemplateData } from "../routes/interventions.js";

test("une liste affichée en cases accepte plusieurs valeurs autorisées", () => {
    const template = { sections: [{
        key: "suite", label: "Suite à donner", type: "select",
        listMode: "checkboxes", multiple: true,
        options: ["Devis", "Commande", "Nouvelle visite"],
    }] };
    assert.equal(validateTemplateData(template, { suite: ["Devis", "Nouvelle visite"] }), null);
});

test("une liste simple refuse plusieurs valeurs", () => {
    const template = { sections: [{
        key: "suite", label: "Suite à donner", type: "select", options: ["Devis", "Commande"],
    }] };
    assert.match(validateTemplateData(template, { suite: ["Devis", "Commande"] }), /Une seule valeur/);
});
