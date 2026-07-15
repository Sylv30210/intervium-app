import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { UPLOADS_DIRECTORY } from "../config/cloud.js";

const BLUE = "#1d4ed8";
const DARK = "#172554";
const GRAY = "#64748b";
const LIGHT = "#e2e8f0";

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
        doc.image(logoBuffer, 48, 25, { fit: [120, 54], align: "left", valign: "center" });
        companyX = 184;
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

function labelStatus(status) {
    return ({
        PLANIFIEE: "Planifiée",
        EN_COURS: "En cours",
        TERMINEE: "Terminée",
        ANNULEE: "Annulée",
    })[status] ?? status;
}

function formatDate(value) {
    if (!value) return "Non planifiée";
    let isoDate;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return "Date invalide";
        isoDate = value.toISOString().slice(0, 10);
    } else {
        isoDate = String(value).trim().slice(0, 10);
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
    if (!match) return "Date invalide";
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
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

function detailLine(doc, label, value) {
    ensureSpace(doc, 22);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GRAY).text(label.toUpperCase(), 48, y, { width: 135 });
    doc.font("Helvetica").fontSize(10).fillColor(DARK).text(value || "-", 183, y, { width: 360 });
    doc.y = Math.max(doc.y, y + 19);
}

function reportField(doc, label, value) {
    ensureSpace(doc, 42);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GRAY)
        .text(String(label || "CHAMP").toUpperCase(), 48, doc.y, { width: doc.page.width - 96 });
    doc.moveDown(0.2).font("Helvetica").fontSize(10.5).fillColor(DARK)
        .text(value || "-", { lineGap: 3 });
    doc.moveDown(0.45);
}

function reportValue(section, rawValue) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return section.defaultValue || "-";
    }
    if (typeof rawValue === "boolean") return rawValue ? "Oui" : "Non";
    if (Array.isArray(rawValue)) return rawValue.join(", ") || "-";
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

function reportTable(doc, section, rows) {
    const columns = Array.isArray(section.columns) && section.columns.length
        ? section.columns
        : section.type === "price_table"
          ? ["Désignation", "Quantité", "Prix HT", "TVA %"]
          : ["Colonne 1", "Colonne 2"];
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) {
        reportField(doc, section.label, "Aucune ligne renseignée");
        return;
    }
    const compactTableHeight = 46 + safeRows.length * 34 + (section.type === "price_table" ? 24 : 0);
    ensureSpace(doc, Math.min(280, compactTableHeight));
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GRAY)
        .text(String(section.label || "TABLEAU").toUpperCase(), 48, doc.y, { width: doc.page.width - 96 });
    doc.moveDown(0.3);
    const totalWidth = doc.page.width - 96;
    const columnWidth = totalWidth / columns.length;
    const drawRow = (values, header = false) => {
        const texts = values.map((value) => String(value ?? ""));
        const height = Math.max(24, ...texts.map((text) => doc.heightOfString(text, { width: columnWidth - 10 }))) + 8;
        ensureSpace(doc, height);
        const y = doc.y;
        if (header) doc.rect(48, y, totalWidth, height).fill(LIGHT);
        doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(DARK);
        texts.forEach((text, index) => {
            const x = 48 + index * columnWidth;
            doc.rect(x, y, columnWidth, height).strokeColor(LIGHT).stroke();
            doc.text(text || "-", x + 5, y + 5, { width: columnWidth - 10 });
        });
        doc.x = 48;
        doc.y = y + height;
    };
    drawRow(columns, true);
    safeRows.forEach((row) => drawRow(columns.map((_, index) => row?.[`c${index}`] ?? "")));
    if (section.type === "price_table") {
        const total = safeRows.reduce((sum, row) => sum + Number(row?.c1 || 0) * Number(row?.c2 || 0), 0);
        doc.moveDown(0.35).font("Helvetica-Bold").fontSize(9).fillColor(DARK)
            .text(`Total HT : ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(total)}`, { align: "right" });
    }
    doc.x = 48;
    doc.moveDown(0.45);
}

export async function generateInterventionPdf({ intervention, equipments, photos }) {
    const photoBuffers = (
        await Promise.all(photos.map((photo) => localImage(photo.url, true)))
    ).filter(Boolean);
    const signatureBuffer = await localImage(intervention.signature_url);
    const logoBuffer = await localImage(intervention.entreprise_logo_url);
    const branding = reportBranding(intervention);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: {
            Title: `Rapport - ${intervention.titre}`,
            Author: branding.displayName,
        } });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("error", reject);
        doc.on("end", () => resolve(Buffer.concat(chunks)));

        drawReportHeader(doc, branding, logoBuffer, intervention.id);

        doc.font("Helvetica-Bold").fontSize(20).fillColor(DARK)
            .text(intervention.titre, 48, doc.y, { width: doc.page.width - 96 });
        doc.moveDown(0.35).font("Helvetica").fontSize(10).fillColor(GRAY)
            .text(`Rapport généré le ${new Intl.DateTimeFormat("fr-FR").format(new Date())}`);

        sectionTitle(doc, "Détails de l'intervention");
        detailLine(doc, "Client", intervention.client_nom);
        detailLine(doc, "Adresse", intervention.client_adresse);
        detailLine(doc, "Date", `${formatDate(intervention.date_intervention)}${intervention.heure ? ` à ${String(intervention.heure).slice(0, 5)}` : ""}`);
        detailLine(doc, "Technicien", intervention.technicien_nom || "Non assigné");
        detailLine(doc, "Statut", labelStatus(intervention.statut));

        sectionTitle(doc, "Description");
        doc.font("Helvetica").fontSize(10.5).fillColor(DARK)
            .text(intervention.description || "Aucune description renseignée.", { lineGap: 3 });

        sectionTitle(doc, "Équipements du client");
        if (equipments.length === 0) {
            doc.font("Helvetica").fontSize(10).fillColor(GRAY).text("Aucun équipement renseigné.");
        } else {
            for (const equipment of equipments) {
                ensureSpace(doc, 30);
                const summary = [equipment.type, equipment.modele, equipment.numero_serie && `N° ${equipment.numero_serie}`]
                    .filter(Boolean).join(" - ");
                doc.font("Helvetica").fontSize(10).fillColor(DARK).text(`• ${summary || "Équipement sans détail"}`);
            }
        }

        sectionTitle(doc, "Compte-rendu du technicien");
        doc.font("Helvetica").fontSize(10.5).fillColor(DARK)
            .text(intervention.compte_rendu || "Compte-rendu non renseigné.", { lineGap: 3 });

        const templateSections = Array.isArray(intervention.modele_rapport_sections)
            ? intervention.modele_rapport_sections
            : [];
        const templateData = intervention.donnees_rapport && typeof intervention.donnees_rapport === "object"
            ? intervention.donnees_rapport
            : {};
        const photoTypes = new Set(["photo", "multi_photo", "event_photos"]);
        const signatureTypes = new Set(["signature", "electronic_signature"]);
        const photoSection = templateSections.find((section) => photoTypes.has(section.type));
        const signatureSection = templateSections.find((section) => signatureTypes.has(section.type));
        if (templateSections.length > 0) {
            sectionTitle(doc, intervention.modele_rapport_nom || "Informations du rapport");
            for (const field of templateSections) {
                if (field.type === "page_break") {
                    doc.addPage();
                    continue;
                }
                if (field.type === "title") {
                    sectionTitle(doc, field.label || "Section");
                    continue;
                }
                if (photoTypes.has(field.type) || signatureTypes.has(field.type)) continue;
                if (field.type === "equipment") {
                    const equipment = equipments[0];
                    const value = equipment
                        ? [equipment.type, equipment.modele, equipment.numero_serie && `N° ${equipment.numero_serie}`].filter(Boolean).join(" - ")
                        : "Aucun équipement renseigné";
                    reportField(doc, field.label, value);
                    continue;
                }
                const rawValue = templateData[field.key];
                if (["table", "price_table"].includes(field.type)) {
                    reportTable(doc, field, rawValue);
                    continue;
                }
                reportField(doc, field.label || field.key, reportValue(field, rawValue));
            }
        }

        if (photoBuffers.length > 0) {
            const photoHeight = signatureBuffer ? 135 : 205;
            const photoAdvance = photoHeight + 10;
            ensureSpace(doc, photoAdvance + 48);
            sectionTitle(doc, photoSection?.label || "Photos du terrain");
            for (const image of photoBuffers) {
                ensureSpace(doc, photoAdvance);
                const y = doc.y;
                doc.image(image, 48, y, { fit: [499, photoHeight], align: "center", valign: "center" });
                doc.y = y + photoAdvance;
            }
        }

        if (signatureBuffer || signatureSection) {
            const signatureBlockHeight = signatureBuffer ? 95 : 38;
            ensureSpace(doc, signatureBlockHeight + 38);
            sectionTitle(doc, signatureSection?.label || "Validation du client");
            if (signatureBuffer) {
                const y = doc.y;
                doc.rect(48, y, 245, 75).strokeColor(LIGHT).stroke();
                doc.image(signatureBuffer, 58, y + 8, { fit: [225, 50], align: "center", valign: "center" });
                doc.font("Helvetica").fontSize(8).fillColor(GRAY).text("Signature client", 58, y + 61);
                doc.y = y + signatureBlockHeight;
            } else {
                doc.font("Helvetica").fontSize(10).fillColor(GRAY).text("Aucune signature enregistrée.");
            }
        }

        const range = doc.bufferedPageRange();
        for (let index = range.start; index < range.start + range.count; index += 1) {
            doc.switchToPage(index);
            const originalBottomMargin = doc.page.margins.bottom;
            doc.page.margins.bottom = 0;
            const footerParts = [branding.footerText || branding.displayName];
            if (branding.showIntervium) footerParts.push("Généré avec Intervium");
            doc.font("Helvetica").fontSize(8).fillColor(GRAY)
                .text(footerParts.join(" - "), 48, doc.page.height - 35, { width: 360, lineBreak: false, ellipsis: true });
            doc.text(`Page ${index + 1} / ${range.count}`, doc.page.width - 148, doc.page.height - 35, { width: 100, align: "right", lineBreak: false });
            doc.page.margins.bottom = originalBottomMargin;
        }

        doc.end();
    });
}
