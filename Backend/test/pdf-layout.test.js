import test from "node:test";
import assert from "node:assert/strict";
import { allocatePhotosToSections, interventionPdfFilename, pdfFieldLabelVisible, pdfHalfWidthPlacement, pdfPhotoGridLayout, reportValue, signatureFrameLayout } from "../services/pdf.js";

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

test("un bloc photo en demi-largeur place deux photos par ligne dans le PDF", () => {
    const half = pdfPhotoGridLayout({ type: "multi_photo", width: "half" }, 595, 48);
    const full = pdfPhotoGridLayout({ type: "multi_photo", width: "full" }, 595, 48);

    assert.equal(half.columns, 2);
    assert.equal(half.imageWidth, 242.5);
    assert.equal(full.columns, 1);
    assert.equal(full.imageWidth, 499);
});

test("le cadre de signature suit la largeur réellement affichée", () => {
    assert.deepEqual(signatureFrameLayout(600, 180), { imageWidth: 167, imageHeight: 50, frameWidth: 187 });
    assert.deepEqual(signatureFrameLayout(80, 40), { imageWidth: 80, imageHeight: 40, frameWidth: 100 });
});

test("le fichier PDF reprend le numéro métier du rapport", () => {
    assert.equal(interventionPdfFilename({ id: 42, numero_rapport: "2026-0007" }), "rapport-2026-0007.pdf");
    assert.equal(interventionPdfFilename({ id: 42 }), "rapport-42.pdf");
});

test("les choix de cases à cocher sont rendus ligne par ligne dans le PDF", () => {
    assert.equal(reportValue({ type: "checkbox" }, ["Conforme", "Validé"]), "Conforme\nValidé");
    assert.equal(reportValue({ type: "checkbox", showCheckmark: true }, ["Conforme", "Validé"]), "√ Conforme\n√ Validé");
});
