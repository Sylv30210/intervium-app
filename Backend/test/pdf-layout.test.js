import test from "node:test";
import assert from "node:assert/strict";
import { allocatePhotosToSections, pdfFieldLabelVisible, pdfHalfWidthPlacement } from "../services/pdf.js";

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

test("un titre de signature décoché reste masqué dans le PDF", () => {
    assert.equal(pdfFieldLabelVisible({ type: "signature", showLabel: false }), false);
    assert.equal(pdfFieldLabelVisible({ type: "signature", showLabel: true }), true);
    assert.equal(pdfFieldLabelVisible({ type: "signature" }), true);
});

test("les photos sont réparties dans l'ordre des blocs du modèle", () => {
    const first = { key: "avant", type: "photo", maxPhotos: 1 };
    const second = { key: "apres", type: "multi_photo", maxPhotos: 2 };
    const allocations = allocatePhotosToSections(
        [first, { key: "commentaire", type: "text" }, second],
        ["photo-1", "photo-2", "photo-3", "photo-4"],
    );

    assert.deepEqual(allocations, [
        { section: first, photos: ["photo-1"] },
        { section: second, photos: ["photo-2", "photo-3"] },
    ]);
});

test("un rapport sans bloc photo conserve sa galerie historique", () => {
    assert.deepEqual(allocatePhotosToSections([{ key: "texte", type: "text" }], ["photo-1"]), []);
});
