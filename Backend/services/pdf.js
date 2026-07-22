import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { UPLOADS_DIRECTORY } from "../config/cloud.js";

const BLUE = "#1d4ed8";
const DARK = "#172554";
const GRAY = "#64748b";
const LIGHT = "#e2e8f0";
const PDF_HALF_WIDTH_TYPES = new Set(["text", "textarea", "date", "number", "checkbox", "select", "creator", "gps", "address", "client", "equipment", "signature", "electronic_signature", "technician_signature"]);

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
        logoScale: Math.min(140, Math.max(60, Math.round(Number(source.logo_scale) || 100))) / 100,
        accentColor: /^#[0-9a-fA-F]{6}$/.test(source.accent_color || "") ? source.accent_color : BLUE,
        headerStyle: ["minimal", "band", "none"].includes(source.header_style) ? source.header_style : "minimal",
        showIntervium: source.show_intervium === true,
    };
}

export function contactLines(branding) {
    return [
        ...String(branding.address || "").split(/\r?\n/),
        branding.registration,
        branding.phone,
        branding.email,
        branding.website,
    ].map((entry) => String(entry || "").trim()).filter(Boolean);
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
            const logoWidth = Math.round(110 * branding.logoScale);
            const logoHeight = Math.round(50 * branding.logoScale);
            doc.roundedRect(40, 22, logoWidth + 16, 64, 5).fill("white");
            doc.image(logoBuffer, 48, 29, { fit: [logoWidth, logoHeight], align: "center", valign: "center" });
            companyX = 64 + logoWidth;
        }
        doc.font("Helvetica-Bold").fontSize(17).fillColor("white")
            .text(branding.displayName, companyX, 30, { width: 245, lineBreak: false, ellipsis: true });
        const contacts = contactLines(branding).join("\n");
        if (contacts) doc.font("Helvetica").fontSize(8).fillColor("#ffffffdd").text(contacts, companyX, 55, { width: 300, height: 44, lineGap: 1 });
        doc.font("Helvetica-Bold").fontSize(11).fillColor("white")
            .text(reportLabel, doc.page.width - 178, 40, { width: 130, align: "right" });
        doc.y = 132;
        doc.x = 48;
        return;
    }

    let companyX = 48;
    if (logoBuffer) {
        const logoWidth = Math.round(150 * branding.logoScale);
        const logoHeight = Math.round(70 * branding.logoScale);
        doc.image(logoBuffer, 48, 18, { fit: [logoWidth, logoHeight], align: "left", valign: "center" });
        companyX = 64 + logoWidth;
    }
    doc.font("Helvetica-Bold").fontSize(17).fillColor(DARK)
        .text(branding.displayName, companyX, 27, { width: 240, lineBreak: false, ellipsis: true });
    const contacts = contactLines(branding).join("\n");
    if (contacts) doc.font("Helvetica").fontSize(8).fillColor(GRAY).text(contacts, companyX, 52, { width: 300, height: 42, lineGap: 1 });
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

export function pdfFieldTitleStyle(pdfConfig = {}) {
    const source = pdfConfig.fieldTitleStyle && typeof pdfConfig.fieldTitleStyle === "object" ? pdfConfig.fieldTitleStyle : {};
    return {
        color: /^#[0-9a-fA-F]{6}$/.test(source.color || "") ? source.color : GRAY,
        size: Math.min(14, Math.max(7, Number(source.size) || 9)),
        font: ["Helvetica", "Times", "Courier"].includes(source.font) ? source.font : "Helvetica",
        bold: source.bold !== false,
        underline: source.underline === true,
        backgroundColor: /^#[0-9a-fA-F]{6}$/.test(source.backgroundColor || "") ? source.backgroundColor : "",
    };
}

function fieldTitleFont(style) {
    if (style.font === "Times") return style.bold ? "Times-Bold" : "Times-Roman";
    if (style.font === "Courier") return style.bold ? "Courier-Bold" : "Courier";
    return style.bold ? "Helvetica-Bold" : "Helvetica";
}

export function pdfFieldTitleBox(textHeight, titleStyle = pdfFieldTitleStyle()) {
    const size = Math.min(14, Math.max(7, Number(titleStyle.size) || 9));
    const paddingY = Math.max(3, Math.round(size * 0.35));
    const height = Math.ceil(Math.max(textHeight + paddingY * 2, size + 7));
    const textOffsetY = Math.max(2, Math.round((height - textHeight) / 2));
    const gapAfter = Math.max(8, Math.round(size * 0.8));
    return { paddingY, height, textOffsetY, gapAfter };
}

function reportField(doc, label, value, showLabel = true, x = 48, width = doc.page.width - 96, titleStyle = pdfFieldTitleStyle()) {
    ensureSpace(doc, showLabel ? 42 : 28);
    if (showLabel) fieldLabel(doc, label, x, width, titleStyle);
    doc.font("Helvetica").fontSize(10.5).fillColor(DARK)
        .text(value || "-", x, doc.y, { width, lineGap: 3 });
    doc.moveDown(0.45);
    doc.x = 48;
}

function fieldLabel(doc, label, x = 48, width = doc.page.width - 96, titleStyle = pdfFieldTitleStyle()) {
    const title = String(label || "CHAMP").toUpperCase();
    const boxY = doc.y;
    doc.font(fieldTitleFont(titleStyle)).fontSize(titleStyle.size);
    const textHeight = doc.heightOfString(title, { width });
    const { height, textOffsetY, gapAfter } = pdfFieldTitleBox(textHeight, titleStyle);
    if (titleStyle.backgroundColor) {
        doc.save();
        doc.roundedRect(x - 2, boxY, width + 4, height, 2).fill(titleStyle.backgroundColor);
        doc.restore();
    }
    doc.font(fieldTitleFont(titleStyle)).fontSize(titleStyle.size).fillColor(titleStyle.color)
        .text(title, x, boxY + textOffsetY, { width, underline: titleStyle.underline });
    doc.y = boxY + height + gapAfter;
}

export function checkboxValueUsesCheckmark(section, rawValue) {
    return section?.showCheckmark === true &&
        Array.isArray(rawValue) &&
        (section.listMode === "checkboxes" || section.type === "checkbox");
}

function reportCheckboxField(doc, label, values, showLabel = true, x = 48, width = doc.page.width - 96, titleStyle = pdfFieldTitleStyle()) {
    const entries = Array.isArray(values) ? values.map((entry) => String(entry)).filter(Boolean) : [];
    ensureSpace(doc, (showLabel ? 20 : 0) + Math.max(1, entries.length) * 16 + 12);
    if (showLabel) fieldLabel(doc, label, x, width, titleStyle);
    if (!entries.length) {
        doc.font("Helvetica").fontSize(10.5).fillColor(DARK).text("-", x, doc.y, { width, lineGap: 3 });
        doc.moveDown(0.45);
        doc.x = 48;
        return;
    }
    for (const entry of entries) {
        const y = doc.y;
        doc.font("Symbol").fontSize(10.5).fillColor(DARK).text("Ö", x, y, { width: 14, lineBreak: false });
        doc.font("Helvetica").fontSize(10.5).fillColor(DARK).text(entry, x + 14, y, { width: width - 14, lineGap: 3 });
        doc.y = Math.max(doc.y, y + 14);
    }
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
            return values.map((entry) => `${section.showCheckmark ? "√ " : ""}${entry}`).join("\n");
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

function technicianSignatureName(intervention, templateData, field) {
    if (!intervention?.technicien_id) return "Technicien non assigné";
    return signatureName(templateData, field) || intervention.technicien_nom || "Technicien";
}

function drawSignatureBlock(doc, asset, label, signerName = "", x = 48, width = doc.page.width - 96) {
    let top = doc.y;
    if (signerName) {
        doc.font("Helvetica").fontSize(10).fillColor(DARK).text(signerName, x + 10, top, { width: Math.max(1, width - 20) });
        top = doc.y + 6;
    }
    const frameWidth = Math.min(asset.layout.frameWidth, Math.max(1, width));
    const imageWidth = Math.min(asset.layout.imageWidth, Math.max(1, frameWidth - 20));
    const imageHeight = Math.round(asset.layout.imageHeight * (imageWidth / Math.max(1, asset.layout.imageWidth)));
    doc.rect(x, top, frameWidth, 75).strokeColor(LIGHT).stroke();
    doc.image(asset.buffer, x + 10, top + 8, {
        width: imageWidth,
        height: imageHeight,
    });
    if (label) doc.font("Helvetica").fontSize(8).fillColor(GRAY).text(label, x + 10, top + 61, { width: Math.max(1, width - 20) });
    doc.y = top + 82;
}

function reportSignatureLabel(doc, label, showLabel = true, x = 48, width = doc.page.width - 96, titleStyle = pdfFieldTitleStyle()) {
    if (!showLabel) return;
    ensureSpace(doc, 24);
    fieldLabel(doc, label || "Signature", x, width, titleStyle);
}

function reportFieldValue(section, rawValue, equipment) {
    if (section.type !== "equipment") return reportValue(section, rawValue);
    return equipment
        ? [equipment.type, equipment.marque, equipment.modele, equipment.numero_serie && `N° ${equipment.numero_serie}`, equipment.annee_installation && `Année ${equipment.annee_installation}`].filter(Boolean).join(" - ")
        : "Aucun matériel renseigné";
}

function reportTable(doc, section, rows, titleStyle = pdfFieldTitleStyle()) {
    const columns = Array.isArray(section.columns) && section.columns.length
        ? section.columns.map((column, index) => typeof column === "string" ? { key: `c${index}`, label: column, type: "text", visiblePdf: true, align: "left", width: 3 } : column).filter((column) => column.visiblePdf !== false)
        : section.type === "price_table"
          ? ["Désignation", "Quantité", "Prix HT", "TVA %"].map((label, index) => ({ key: `c${index}`, label, type: "text", width: 3 }))
          : ["Colonne 1", "Colonne 2"].map((label, index) => ({ key: `c${index}`, label, type: "text", width: 3 }));
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
        reportField(doc, section.label, "Aucune ligne renseignée", section.showLabel !== false, 48, doc.page.width - 96, titleStyle);
        return;
    }
    const compactTableHeight = 46 + safeRows.length * 34 + (section.type === "price_table" ? 24 : 0);
    ensureSpace(doc, Math.min(280, compactTableHeight));
    if (section.showLabel !== false) fieldLabel(doc, section.label || "TABLEAU", 48, doc.page.width - 96, titleStyle);
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
    const fieldTitleStyle = pdfFieldTitleStyle(pdfConfig);
    const margin = Math.min(90, Math.max(24, Number(pdfConfig.margin) || 48));
    const templateSections = Array.isArray(intervention.modele_rapport_sections) ? intervention.modele_rapport_sections : [];
    const templateData = intervention.donnees_rapport && typeof intervention.donnees_rapport === "object" ? intervention.donnees_rapport : {};
    const templateSignatures = new Map((await Promise.all(templateSections
        .filter((section) => ["signature", "electronic_signature", "technician_signature"].includes(section.type))
        .map(async (section) => [
            section.key,
            await signatureAsset(section.type === "technician_signature"
                ? (intervention.technicien_signature_url || templateData[section.key])
                : templateData[section.key])
        ])))
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
        const signatureTypes = new Set(["signature", "electronic_signature", "technician_signature"]);
        const photoAllocations = allocatePhotosToSections(templateSections, photoBuffers);
        const photosBySection = new Map(photoAllocations.map(({ section, photos: sectionPhotos }) => [section, sectionPhotos]));
        const hasTemplateSignature = templateSections.some((section) => signatureTypes.has(section.type));
        const signatureRenderHeight = (field) => {
            const signerName = field.type === "technician_signature"
                ? technicianSignatureName(intervention, templateData, field)
                : signatureName(templateData, field);
            const fieldSignature = templateSignatures.get(field.key);
            return fieldSignature ? 95 + (signerName ? 18 : 0) : 38;
        };
        const renderSignatureField = (field, x = 48, width = doc.page.width - 96) => {
            const fieldSignature = templateSignatures.get(field.key);
            const signerName = field.type === "technician_signature"
                ? technicianSignatureName(intervention, templateData, field)
                : signatureName(templateData, field);
            reportSignatureLabel(doc, field.label || "Signature", pdfFieldLabelVisible(field), x, width, fieldTitleStyle);
            if (fieldSignature) {
                drawSignatureBlock(doc, fieldSignature, "", signerName, x, width);
            } else if (field.type === "technician_signature" && !intervention.technicien_id) {
                doc.font("Helvetica").fontSize(10).fillColor(GRAY).text("Technicien non assigné.", x, doc.y, { width });
            } else {
                doc.font("Helvetica").fontSize(10).fillColor(GRAY).text("Aucune signature enregistrée.", x, doc.y, { width });
            }
        };
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
                const nextField = templateSections[fieldIndex + 1];
                const placement = pdfHalfWidthPlacement(field, nextField);
                if (signatureTypes.has(field.type)) {
                    if (pdfConfig.showSignature === false) continue;
                    if (placement.pairsWithNext && signatureTypes.has(nextField?.type)) {
                        const gap = 14;
                        const halfWidth = (doc.page.width - 96 - gap) / 2;
                        ensureSpace(doc, Math.max(signatureRenderHeight(field), signatureRenderHeight(nextField)) + 38);
                        const startY = doc.y;
                        renderSignatureField(field, 48, halfWidth);
                        const firstBottom = doc.y;
                        doc.y = startY;
                        renderSignatureField(nextField, 48 + halfWidth + gap, halfWidth);
                        doc.y = Math.max(firstBottom, doc.y);
                        fieldIndex += 1;
                        continue;
                    }
                    ensureSpace(doc, signatureRenderHeight(field) + 38);
                    renderSignatureField(field, 48, placement.usesHalfWidth ? (doc.page.width - 96 - 14) / 2 : doc.page.width - 96);
                    continue;
                }
                if (photoTypes.has(field.type)) {
                    renderPhotoBlock(field, photosBySection.get(field) || []);
                    continue;
                }
                const rawValue = templateData[field.key];
                if (["table", "price_table"].includes(field.type)) {
                    reportTable(doc, field, rawValue, fieldTitleStyle);
                    continue;
                }
                if (placement.pairsWithNext) {
                    ensureSpace(doc, 54);
                    const startY = doc.y;
                    const gap = 14;
                    const halfWidth = (doc.page.width - 96 - gap) / 2;
                    if (checkboxValueUsesCheckmark(field, rawValue)) reportCheckboxField(doc, field.label || field.key, rawValue, pdfFieldLabelVisible(field), 48, halfWidth, fieldTitleStyle);
                    else reportField(doc, field.label || field.key, reportFieldValue(field, rawValue, equipments[0]), pdfFieldLabelVisible(field), 48, halfWidth, fieldTitleStyle);
                    const firstBottom = doc.y;
                    doc.y = startY;
                    if (checkboxValueUsesCheckmark(nextField, templateData[nextField.key])) reportCheckboxField(doc, nextField.label || nextField.key, templateData[nextField.key], pdfFieldLabelVisible(nextField), 48 + halfWidth + gap, halfWidth, fieldTitleStyle);
                    else reportField(doc, nextField.label || nextField.key, reportFieldValue(nextField, templateData[nextField.key], equipments[0]), pdfFieldLabelVisible(nextField), 48 + halfWidth + gap, halfWidth, fieldTitleStyle);
                    doc.y = Math.max(firstBottom, doc.y);
                    fieldIndex += 1;
                    continue;
                }
                if (placement.usesHalfWidth) {
                    const gap = 14;
                    const halfWidth = (doc.page.width - 96 - gap) / 2;
                    if (checkboxValueUsesCheckmark(field, rawValue)) reportCheckboxField(doc, field.label || field.key, rawValue, pdfFieldLabelVisible(field), 48, halfWidth, fieldTitleStyle);
                    else reportField(doc, field.label || field.key, reportFieldValue(field, rawValue, equipments[0]), pdfFieldLabelVisible(field), 48, halfWidth, fieldTitleStyle);
                    continue;
                }
                if (checkboxValueUsesCheckmark(field, rawValue)) reportCheckboxField(doc, field.label || field.key, rawValue, pdfFieldLabelVisible(field), 48, doc.page.width - 96, fieldTitleStyle);
                else reportField(doc, field.label || field.key, reportFieldValue(field, rawValue, equipments[0]), pdfFieldLabelVisible(field), 48, doc.page.width - 96, fieldTitleStyle);
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
