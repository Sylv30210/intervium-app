import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { UPLOADS_DIRECTORY } from "../config/cloud.js";

const BLUE = "#1d4ed8";
const DARK = "#172554";
const GRAY = "#64748b";
const LIGHT = "#e2e8f0";
const PDF_HALF_WIDTH_TYPES = new Set(["text", "textarea", "date", "number", "checkbox", "select", "creator", "gps", "address", "client", "equipment"]);

export function pdfHalfWidthPlacement(field, nextField) {
    const usesHalfWidth = field?.width === "half" && PDF_HALF_WIDTH_TYPES.has(field?.type);
    return {
        usesHalfWidth,
        pairsWithNext: usesHalfWidth && nextField?.width === "half" && PDF_HALF_WIDTH_TYPES.has(nextField?.type),
    };
}

export function pdfFieldLabelVisible(field) {
    return field?.showLabel !== false;
}

export function pdfPhotoGridLayout(field, pageWidth, margin = 48) {
    const gap = 14;
    const availableWidth = Math.max(1, Number(pageWidth) - (margin * 2));
    const columns = field?.width === "half" ? 2 : 1;
    const imageWidth = columns === 2 ? (availableWidth - gap) / 2 : availableWidth;
    const imageHeight = columns === 2 ? 155 : 205;
    return { columns, gap, imageWidth, imageHeight, rowAdvance: imageHeight + 10 };
}

export function signatureFrameLayout(width, height) {
    const sourceWidth = Math.max(1, Number(width) || 1);
    const sourceHeight = Math.max(1, Number(height) || 1);
    const scale = Math.min(1, 225 / sourceWidth, 50 / sourceHeight);
    const imageWidth = Math.max(1, Math.round(sourceWidth * scale));
    const imageHeight = Math.max(1, Math.round(sourceHeight * scale));
    return { imageWidth, imageHeight, frameWidth: imageWidth + 20 };
}

async function signatureAsset(publicUrl) {
    const buffer = await localImage(publicUrl);
    if (!buffer) return null;
    const trimmedBuffer = await sharp(buffer).trim({ threshold: 10 }).png().toBuffer();
    const metadata = await sharp(trimmedBuffer).metadata();
    return { buffer: trimmedBuffer, layout: signatureFrameLayout(metadata.width, metadata.height) };
}

export function interventionPdfFilename(intervention) {
    const rawIdentifier = intervention?.numero_rapport || intervention?.id || "intervention";
    const identifier = String(rawIdentifier)
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "intervention";
    return `rapport-${identifier}.pdf`;
}

function reportBranding(intervention) {
    const source = intervention.entreprise_report_settings && typeof intervention.entreprise_report_settings === "object"
        ? intervention.entreprise_report_settings
        : {};
    return {
        displayName: source.display_name || intervention.entreprise_nom,
        address: source.address || "",
        phone: source.phone || "",
        email: source.email || "",
        website: source.website || "",
        registration: source.registration || "",
        footerText: source.footer_text || "",
        accentColor: /^#[0-9a-fA-F]{6}$/.test(source.accent_color || "") ? source.accent_color : BLUE,
        headerStyle: ["minimal", "band", "none"].includes(source.header_style) ? source.header_style : "minimal",
        showIntervium: source.show_intervium === true,
    };
}

function contactText(branding) {
    return [branding.address, branding.phone, branding.email, branding.website, branding.registration]
        .filter(Boolean).join(" - ");
}

function drawReportHeader(doc, branding, logoBuffer, reportId) {
    const reportLabel = `RAPPORT N° ${reportId}`;
    if (branding.headerStyle === "none") {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(GRAY)
            .text(reportLabel, doc.page.width - 198, 38, { width: 150, align: "right" });
        doc.y = 72;
        doc.x = 48;
        return;
    }

    if (branding.headerStyle === "band") {
        doc.rect(0, 0, doc.page.width, 108).fill(branding.accentColor);
        let companyX = 48;
        if (logoBuffer) {
            doc.roundedRect(40, 22, 126, 64, 5).fill("white");
            doc.image(logoBuffer, 48, 29, { fit: [110, 50], align: "center", valign: "center" });
            companyX = 182;
        }
        doc.font("Helvetica-Bold").fontSize(17).fillColor("white")
            .text(branding.displayName, companyX, 30, { width: 245, lineBreak: false, ellipsis: true });
        const contacts = contactText(branding);
        if (contacts) doc.font("Helvetica").fontSize(8).fillColor("#ffffffdd").text(contacts, companyX, 58, { width: 300, height: 28, ellipsis: true });
        doc.font("Helvetica-Bold").fontSize(11).fillColor("white")
            .text(reportLabel, doc.page.width - 178, 40, { width: 130, align: "right" });
        doc.y = 132;
        doc.x = 48;
        return;
    }

    let companyX = 48;
    if (logoBuffer) {
        doc.image(logoBuffer, 48, 18, { fit: [150, 70], align: "left", valign: "center" });
        companyX = 214;
    }
    doc.font("Helvetica-Bold").fontSize(17).fillColor(DARK)
        .text(branding.displayName, companyX, 27, { width: 240, lineBreak: false, ellipsis: true });
    const contacts = contactText(branding);
    if (contacts) doc.font("Helvetica").fontSize(8).fillColor(GRAY).text(contacts, companyX, 54, { width: 300, height: 28, ellipsis: true });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(branding.accentColor)
        .text(reportLabel, doc.page.width - 188, 32, { width: 140, align: "right" });
    doc.strokeColor(branding.accentColor).lineWidth(2).moveTo(48, 96).lineTo(doc.page.width - 48, 96).stroke();
    doc.y = 119;
    doc.x = 48;
}

async function localImage(url, convertWebp = false) {
    if (!url) return null;

    try {
        const parsedUrl = new URL(url, "http://localhost");
        let buffer;

        if (parsedUrl.hostname === "res.cloudinary.com") {
            const response = await fetch(parsedUrl, {
                signal: AbortSignal.timeout(10_000),
            });
            if (!response.ok) return null;
            const contentLength = Number(response.headers.get("content-length") || 0);
            if (contentLength > 10 * 1024 * 1024) return null;
            buffer = Buffer.from(await response.arrayBuffer());
            if (buffer.length > 10 * 1024 * 1024) return null;
        } else {
            const pathname = parsedUrl.pathname;
            if (!pathname.startsWith("/uploads/")) return null;

            const relativePath = decodeURIComponent(pathname.slice("/uploads/".length));
            const absolutePath = path.resolve(UPLOADS_DIRECTORY, relativePath);
            const uploadsRoot = `${path.resolve(UPLOADS_DIRECTORY)}${path.sep}`;
            if (!absolutePath.startsWith(uploadsRoot)) return null;

            buffer = await readFile(absolutePath);
        }
        return convertWebp ? sharp(buffer).png().toBuffer() : buffer;
    } catch {
        return null;
    }
}

function ensureSpace(doc, height) {
    if (doc.y + height > doc.page.height - 65) doc.addPage();
}

function sectionTitle(doc, title) {
    ensureSpace(doc, 38);
    doc.moveDown(0.7).font("Helvetica-Bold").fontSize(13).fillColor(DARK)
        .text(title, 48, doc.y, { width: doc.page.width - 96 });
    doc.moveDown(0.25).strokeColor(LIGHT).lineWidth(1)
        .moveTo(48, doc.y).lineTo(doc.page.width - 48, doc.y).stroke();
    doc.moveDown(0.55);
}

function reportField(doc, label, value, showLabel = true, x = 48, width = doc.page.width - 96) {
    ensureSpace(doc, showLabel ? 42 : 28);
    if (showLabel) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(GRAY)
            .text(String(label || "CHAMP").toUpperCase(), x, doc.y, { width });
        doc.moveDown(0.2);
    }
    doc.font("Helvetica").fontSize(10.5).fillColor(DARK)
        .text(value || "-", x, doc.y, { width, lineGap: 3 });
    doc.moveDown(0.45);
    doc.x = 48;
}

export function reportValue(section, rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return section.defaultValue || "-";
    }
    if (typeof rawValue === "boolean") return rawValue ? "Oui" : "Non";
    if (Array.isArray(rawValue)) {
        const values = rawValue.map((entry) => String(entry)).filter(Boolean);
        if (!values.length) return "-";
        if (section.listMode === "checkboxes" || section.type === "checkbox") {
            return values.map((entry) => `${section.showCheckmark ? "[x] " : ""}${entry}`).join("\n");
        }
        return values.join(", ");
    }
    if (section.type === "number" && section.unit) return `${rawValue} ${section.unit}`;
    if (section.type === "date") {
        const date = new Date(section.dateMode === "datetime-local" ? rawValue : `${rawValue}T12:00:00`);
        if (!Number.isNaN(date.getTime())) {
            return new Intl.DateTimeFormat("fr-FR", section.dateMode === "datetime-local"
                ? { dateStyle: "short", timeStyle: "short" }
                : { dateStyle: "short" }).format(date);
        }
    }
    return String(rawValue);
}

function signatureName(templateData, field) {
    const name = templateData?.[`${field.key}_name`];
    return typeof name === "string" ? name.trim().slice(0, 150) : "";
}

function drawSignatureBlock(doc, asset, label, signerName = "") {
    let top = doc.y;
    if (signerName) {
        doc.font("Helvetica").fontSize(10).fillColor(DARK).text(signerName, 58, top, { width: 260 });
        top = doc.y + 6;
    }
    doc.rect(48, top, asset.layout.frameWidth, 75).strokeColor(LIGHT).stroke();
    doc.image(asset.buffer, 58, top + 8, {
        width: asset.layout.imageWidth,
        height: asset.layout.imageHeight,
    });
    if (label) doc.font("Helvetica").fontSize(8).fillColor(GRAY).text(label, 58, top + 61);
    doc.y = top + 82;
}

function reportFieldValue(section, rawValue, equipment) {
    if (section.type !== "equipment") return reportValue(section, rawValue);
    return equipment
        ? [equipment.type, equipment.marque, equipment.modele, equipment.numero_serie && `N° ${equipment.numero_serie}`, equipment.annee_installation && `Année ${equipment.annee_installation}`].filter(Boolean).join(" - ")
        : "Aucun matériel renseigné";
}

function reportTable(doc, section, rows) {
    const columns = Array.isArray(section.columns) && section.columns.length
        ? section.columns.map((column, index) => typeof column === "string" ? { key: `c${index}`, label: column, type: "text", visiblePdf: true, align: "left", width: 3 } : column).filter((column) => column.visiblePdf !== false)
        : section.type === "price_table"
          ? ["Désignation", "Quantité", "Prix HT", "TVA %"].map((label, index) => ({ key: `c${index}`, label, type: "text", width: 3 }))
          : ["Colonne 1", "Colonne 2"].map((label, index) => ({ key: `c${index}`, label, type: "text", width: 3 }));
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
        reportField(doc, section.label, "Aucune ligne renseignée", section.showLabel !== false);
        return;
    }
    const compactTableHeight = 46 + safeRows.length * 34 + (section.type === "price_table" ? 24 : 0);
    ensureSpace(doc, Math.min(280, compactTableHeight));
    if (section.showLabel !== false) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(GRAY)
            .text(String(section.label || "TABLEAU").toUpperCase(), 48, doc.y, { width: doc.page.width - 96 });
        doc.moveDown(0.3);
    }
    const totalWidth = doc.page.width - 96;
    const totalUnits = columns.reduce((sum, column) => sum + (Number(column.width) || 3), 0);
    const drawRow = (values, header = false) => {
        const texts = values.map((value) => String(value ?? ""));
        const widths = columns.map((column) => totalWidth * ((Number(column.width) || 3) / totalUnits));
        const height = Math.max(24, ...texts.map((text, index) => doc.heightOfString(text, { width: widths[index] - 10 }))) + 8;
        ensureSpace(doc, height);
        const y = doc.y;
        if (header) doc.rect(48, y, totalWidth, height).fill(LIGHT);
        doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(DARK);
        let cursorX = 48;
        texts.forEach((text, index) => {
            const columnWidth = widths[index];
            doc.rect(cursorX, y, columnWidth, height).strokeColor(LIGHT).stroke();
            doc.text(text || "-", cursorX + 5, y + 5, { width: columnWidth - 10, align: columns[index].align || "left" });
            cursorX += columnWidth;
        });
        doc.x = 48;
        doc.y = y + height;
    };
    drawRow(columns.map((column) => column.label), true);
    safeRows.forEach((row, rowIndex) => drawRow(columns.map((column) => column.type === "row_number" ? rowIndex + 1 : typeof row?.[column.key] === "boolean" ? (row[column.key] ? "Oui" : "Non") : row?.[column.key] ?? "")));
    if (section.type === "price_table") {
        const quantity = columns.find((column) => column.type === "decimal" || column.type === "integer")?.key || "c1";
        const price = columns.find((column) => column.type === "currency")?.key || "c2";
        const total = safeRows.reduce((sum, row) => sum + Number(row?.[quantity] || 0) * Number(row?.[price] || 0), 0);
        doc.moveDown(0.35).font("Helvetica-Bold").fontSize(9).fillColor(DARK)
            .text(`Total HT : ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(total)}`, { align: "right" });
    }
    doc.x = 48;
    doc.moveDown(0.45);
}

export function allocatePhotosToSections(templateSections, photos) {
    const photoTypes = new Set(["photo", "multi_photo", "event_photos"]);
    const sections = templateSections.filter((section) => photoTypes.has(section.type));
    if (!sections.length) return [];
    let cursor = 0;
    return sections.map((section) => {
        const fallback = section.type === "photo" ? 1 : 5;
        const capacity = Math.max(1, Number(section.maxPhotos) || fallback);
        const allocation = { section, photos: photos.slice(cursor, cursor + capacity) };
        cursor += capacity;
        return allocation;
    });
}

export async function generateInterventionPdf({ intervention, equipments, photos }) {
    const photoBuffers = (
        await Promise.all(photos.map(async (photo) => {
            const image = await localImage(photo.url, true);
            return image && Number(photo.rotation) ? sharp(image).rotate(Number(photo.rotation)).png().toBuffer() : image;
        }))
    ).filter(Boolean);
    const signature = await signatureAsset(intervention.signature_url);
    const signatureBuffer = signature?.buffer || null;
    const logoBuffer = await localImage(intervention.entreprise_logo_url);
    const branding = reportBranding(intervention);
    const pdfConfig = intervention.modele_pdf_config && typeof intervention.modele_pdf_config === "object" ? intervention.modele_pdf_config : {};
    const margin = Math.min(90, Math.max(24, Number(pdfConfig.margin) || 48));
    const templateSections = Array.isArray(intervention.modele_rapport_sections) ? intervention.modele_rapport_sections : [];
    const templateData = intervention.donnees_rapport && typeof intervention.donnees_rapport === "object" ? intervention.donnees_rapport : {};
    const templateSignatures = new Map((await Promise.all(templateSections
        .filter((section) => ["signature", "electronic_signature"].includes(section.type))
        .map(async (section) => [section.key, await signatureAsset(templateData[section.key])])))
        .filter(([, asset]) => asset));

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin, bufferPages: true, info: {
            Title: `Rapport - ${intervention.titre}`,
            Author: branding.displayName,
        } });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("error", reject);
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        if (pdfConfig.showHeader !== false) drawReportHeader(doc, branding, logoBuffer, intervention.numero_rapport || intervention.id);

        const photoTypes = new Set(["photo", "multi_photo", "event_photos"]);
        const signatureTypes = new Set(["signature", "electronic_signature"]);
        const photoAllocations = allocatePhotosToSections(templateSections, photoBuffers);
        const photosBySection = new Map(photoAllocations.map(({ section, photos: sectionPhotos }) => [section, sectionPhotos]));
        const hasTemplateSignature = templateSections.some((section) => signatureTypes.has(section.type));
        const renderPhotoBlock = (field, sectionPhotos) => {
            if (pdfConfig.showPhotos === false) return;
            const layout = pdfPhotoGridLayout(field, doc.page.width);
            ensureSpace(doc, layout.rowAdvance + 38);
            if (pdfFieldLabelVisible(field)) sectionTitle(doc, field.label || "Photos du terrain");
            if (!sectionPhotos.length) {
                doc.font("Helvetica").fontSize(10).fillColor(GRAY).text("Aucune photo enregistrée.");
                return;
            }
            for (let index = 0; index < sectionPhotos.length; index += layout.columns) {
                ensureSpace(doc, layout.rowAdvance);
                const y = doc.y;
                sectionPhotos.slice(index, index + layout.columns).forEach((image, column) => {
                    const x = 48 + (column * (layout.imageWidth + layout.gap));
                    doc.image(image, x, y, { fit: [layout.imageWidth, layout.imageHeight], align: "center", valign: "center" });
                });
                doc.y = y + layout.rowAdvance;
            }
        };
        if (templateSections.length > 0) {
            sectionTitle(doc, intervention.modele_rapport_nom || "Informations du rapport");
            for (let fieldIndex = 0; fieldIndex < templateSections.length; fieldIndex += 1) {
                const field = templateSections[fieldIndex];
                if (field.type === "page_break") {
                    doc.addPage();
                    continue;
                }
                if (field.type === "title") {
                    sectionTitle(doc, field.label || "Section");
                    continue;
                }
                if (signatureTypes.has(field.type)) {
                    if (pdfConfig.showSignature === false) continue;
                    const fieldSignature = templateSignatures.get(field.key);
                    const signerName = signatureName(templateData, field);
                    const signatureBlockHeight = fieldSignature ? 95 + (signerName ? 18 : 0) : 38;
                    ensureSpace(doc, signatureBlockHeight + 38);
                    if (pdfFieldLabelVisible(field)) sectionTitle(doc, field.label || "Signature");
                    if (fieldSignature) {
                        drawSignatureBlock(doc, fieldSignature, pdfFieldLabelVisible(field) ? field.label || "Signature" : "", signerName);
                    } else {
                        doc.font("Helvetica").fontSize(10).fillColor(GRAY).text("Aucune signature enregistrée.");
                    }
                    continue;
                }
                if (photoTypes.has(field.type)) {
                    renderPhotoBlock(field, photosBySection.get(field) || []);
                    continue;
                }
                const rawValue = templateData[field.key];
                if (["table", "price_table"].includes(field.type)) {
                    reportTable(doc, field, rawValue);
                    continue;
                }
                const nextField = templateSections[fieldIndex + 1];
                const placement = pdfHalfWidthPlacement(field, nextField);
                if (placement.pairsWithNext) {
                    ensureSpace(doc, 54);
                    const startY = doc.y;
                    const gap = 14;
                    const halfWidth = (doc.page.width - 96 - gap) / 2;
                    reportField(doc, field.label || field.key, reportFieldValue(field, rawValue, equipments[0]), pdfFieldLabelVisible(field), 48, halfWidth);
                    const firstBottom = doc.y;
                    doc.y = startY;
                    reportField(doc, nextField.label || nextField.key, reportFieldValue(nextField, templateData[nextField.key], equipments[0]), pdfFieldLabelVisible(nextField), 48 + halfWidth + gap, halfWidth);
                    doc.y = Math.max(firstBottom, doc.y);
                    fieldIndex += 1;
                    continue;
                }
                if (placement.usesHalfWidth) {
                    const gap = 14;
                    const halfWidth = (doc.page.width - 96 - gap) / 2;
                    reportField(doc, field.label || field.key, reportFieldValue(field, rawValue, equipments[0]), pdfFieldLabelVisible(field), 48, halfWidth);
                    continue;
                }
                reportField(doc, field.label || field.key, reportFieldValue(field, rawValue, equipments[0]), pdfFieldLabelVisible(field));
            }
        }

        if (pdfConfig.showPhotos !== false && photoBuffers.length > 0 && photoAllocations.length === 0) {
            const photoHeight = signatureBuffer ? 135 : 205;
            const photoAdvance = photoHeight + 10;
            ensureSpace(doc, photoAdvance + 48);
            sectionTitle(doc, "Photos du terrain");
            for (const image of photoBuffers) {
                ensureSpace(doc, photoAdvance);
                const y = doc.y;
                doc.image(image, 48, y, { fit: [499, photoHeight], align: "center", valign: "center" });
                doc.y = y + photoAdvance;
            }
        }

        if (pdfConfig.showSignature !== false && signatureBuffer && !hasTemplateSignature) {
            const signatureBlockHeight = signatureBuffer ? 95 : 38;
            ensureSpace(doc, signatureBlockHeight + 38);
            sectionTitle(doc, "Signature client");
            if (signatureBuffer) {
                drawSignatureBlock(doc, signature, "Signature client");
            } else {
                doc.font("Helvetica").fontSize(10).fillColor(GRAY).text("Aucune signature enregistrée.");
            }
        }

        const range = doc.bufferedPageRange();
        for (let index = range.start; index < range.start + range.count; index += 1) {
            doc.switchToPage(index);
            const originalBottomMargin = doc.page.margins.bottom;
            doc.page.margins.bottom = 0;
            const footerParts = [pdfConfig.footerText || branding.footerText || branding.displayName];
            if (branding.showIntervium) footerParts.push("Généré avec Intervium");
            doc.font("Helvetica").fontSize(8).fillColor(GRAY)
                .text(footerParts.join(" - "), 48, doc.page.height - 35, { width: 360, lineBreak: false, ellipsis: true });
            if (pdfConfig.showPageNumbers !== false) doc.text(`Page ${index + 1} / ${range.count}`, doc.page.width - 148, doc.page.height - 35, { width: 100, align: "right", lineBreak: false });
            doc.page.margins.bottom = originalBottomMargin;
        }

        doc.end();
    });
}
