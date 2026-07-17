import test from "node:test";
import assert from "node:assert/strict";
import { pdfHalfWidthPlacement } from "../services/pdf.js";

test("un champ demi-largeur reste en demi-colonne même lorsqu’il est seul", () => {
    assert.deepEqual(pdfHalfWidthPlacement({ type: "address", width: "half" }, null), {
        usesHalfWidth: true,
        pairsWithNext: false,
    });
});

test("adresse et matériel peuvent partager la même ligne du PDF", () => {
    assert.deepEqual(
        pdfHalfWidthPlacement({ type: "address", width: "half" }, { type: "equipment", width: "half" }),
        { usesHalfWidth: true, pairsWithNext: true },
    );
});

test("les tableaux restent en pleine largeur pour préserver leur lisibilité", () => {
    assert.deepEqual(pdfHalfWidthPlacement({ type: "table", width: "half" }, { type: "text", width: "half" }), {
        usesHalfWidth: false,
        pairsWithNext: false,
    });
});
