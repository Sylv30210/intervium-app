import express from "express";
import multer from "multer";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import { logActivity } from "../services/activity.js";
import {
    readStoredImage,
    removeStoredUpload,
    uploadCompressedPhoto,
    uploadEditedPhotoBase64,
    uploadCompanyLogo,
    uploadSignatureBase64,
} from "../services/storage.js";

const router = express.Router();
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

class UnsupportedImageTypeError extends Error {
    constructor() {
        super("Format refusé. Utilisez une image PNG, JPEG ou WebP.");
        this.name = "UnsupportedImageTypeError";
    }
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
    },
    fileFilter: (_req, file, callback) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
            return callback(new UnsupportedImageTypeError());
        }
        return callback(null, true);
    },
});

function receivePhoto(req, res, next) {
    upload.single("photo")(req, res, (error) => {
        if (!error) return next();

        if (error instanceof multer.MulterError) {
            const message =
                error.code === "LIMIT_FILE_SIZE"
                    ? "La photo dépasse la limite de 5 Mo."
                    : "Fichier photo invalide.";
            return res.status(400).json({ error: message });
        }

        if (error instanceof UnsupportedImageTypeError) {
            return res.status(415).json({ error: error.message });
        }
        return next(error);
    });
}

function receiveLogo(req, res, next) {
    upload.single("logo")(req, res, (error) => {
        if (!error) return next();
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Le logo dépasse la limite de 5 Mo." : "Fichier logo invalide." });
        }
        if (error instanceof UnsupportedImageTypeError) {
            return res.status(415).json({ error: error.message });
        }
        return next(error);
    });
}

function parseInterventionId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function absoluteUploadUrl(req, relativePath) {
    if (/^https:\/\//i.test(relativePath)) return relativePath;
    return new URL(relativePath, `${req.protocol}://${req.get("host")}`).href;
}

function safeStorageError(error) {
    return {
        name: error?.name,
        message: error?.message,
        http_code: error?.http_code,
        code: error?.code,
    };
}

async function sendStoredImage(res, publicUrl) {
    const image = await readStoredImage(publicUrl);
    res.set({
        "Content-Type": image.contentType,
        "Content-Length": image.buffer.length,
        "Cache-Control": "private, no-store",
    });
    return res.send(image.buffer);
}

const readableInterventionMediaCondition = `(
    $3 IN ('ADMIN', 'SUPER_DEVELOPPEUR')
    OR ($3 = 'TECHNICIEN' AND i.technicien_id = $4)
    OR ($3 = 'CLIENT' AND c.utilisateur_id = $4)
)`;

router.get("/company-logo/source", verifyToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT logo_url FROM entreprises WHERE id = $1", [req.user.entreprise_id]);
        const logoUrl = result.rows[0]?.logo_url;
        if (!logoUrl) return res.status(404).json({ error: "Logo introuvable." });
        return await sendStoredImage(res, logoUrl);
    } catch (error) {
        console.error("Échec du chargement du logo", safeStorageError(error));
        return res.status(502).json({ error: "Impossible de charger le logo." });
    }
});

router.post("/company-logo", verifyToken, requireRole(["ADMIN"]), receiveLogo, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Aucun logo fourni dans le champ 'logo'." });
    let storedUrl;
    let databaseUpdated = false;
    try {
        const previousResult = await pool.query("SELECT logo_url FROM entreprises WHERE id = $1", [req.user.entreprise_id]);
        if (!previousResult.rowCount) return res.status(404).json({ error: "Entreprise introuvable." });
        storedUrl = await uploadCompanyLogo(req.file.buffer);
        const logoUrl = absoluteUploadUrl(req, storedUrl);
        const result = await pool.query(
            `UPDATE entreprises SET logo_url = $1, updated_at = NOW()
             WHERE id = $2 RETURNING id, nom, logo_url, report_settings`,
            [logoUrl, req.user.entreprise_id]
        );
        if (!result.rowCount) {
            await removeStoredUpload(storedUrl).catch((cleanupError) => {
                console.error("Échec du nettoyage du nouveau logo", safeStorageError(cleanupError));
            });
            return res.status(404).json({ error: "Entreprise introuvable." });
        }
        databaseUpdated = true;
        await removeStoredUpload(previousResult.rows[0].logo_url).catch((cleanupError) => {
            // Le nouveau logo reste valide même si l'ancien média n'a pas pu être purgé.
            console.error("Ancien logo Cloudinary non supprimé", safeStorageError(cleanupError));
        });
        await logActivity({ user: req.user, action: "UPDATE", resourceType: "entreprise", resourceId: req.user.entreprise_id, summary: "Logo de l’entreprise remplacé." });
        return res.json({ entreprise: result.rows[0] });
    } catch (error) {
        if (storedUrl && !databaseUpdated) {
            await removeStoredUpload(storedUrl).catch(() => {});
        }
        if (error instanceof TypeError) return res.status(400).json({ error: error.message });
        console.error("Échec technique de l'upload du logo", safeStorageError(error));
        if (error?.http_code || error?.name === "TimeoutError") {
            return res.status(502).json({
                error: "Le service de stockage distant est temporairement indisponible.",
            });
        }
        return res.status(500).json({ error: "Impossible d'enregistrer le logo." });
    }
});

router.delete("/company-logo", verifyToken, requireRole(["ADMIN"]), async (req, res) => {
    try {
        const previousResult = await pool.query("SELECT logo_url FROM entreprises WHERE id = $1", [req.user.entreprise_id]);
        if (!previousResult.rowCount) return res.status(404).json({ error: "Entreprise introuvable." });
        const result = await pool.query(
            `UPDATE entreprises SET logo_url = NULL, updated_at = NOW()
             WHERE id = $1 RETURNING id, nom, report_settings`,
            [req.user.entreprise_id]
        );
        if (!result.rowCount) return res.status(404).json({ error: "Entreprise introuvable." });
        await removeStoredUpload(previousResult.rows[0].logo_url).catch((cleanupError) => {
            console.error("Logo Cloudinary non supprimé", safeStorageError(cleanupError));
        });
        await logActivity({ user: req.user, action: "UPDATE", resourceType: "entreprise", resourceId: req.user.entreprise_id, summary: "Logo de l’entreprise supprimé." });
        return res.json({ entreprise: { ...result.rows[0], logo_url: null } });
    } catch (error) {
        console.error("Échec de la suppression du logo", error);
        return res.status(500).json({ error: "Impossible de supprimer le logo." });
    }
});

async function canModifyIntervention(interventionId, user) {
    const result = await pool.query(
        `SELECT i.technicien_id, i.signature_url,
                COALESCE(m.sections, i.modele_rapport_snapshot->'sections') AS report_sections,
                (SELECT COUNT(*)::INTEGER FROM photos p
                 WHERE p.intervention_id = i.id AND p.entreprise_id = i.entreprise_id) AS photo_count
         FROM interventions i
         LEFT JOIN modeles_rapport m
           ON m.id = i.modele_rapport_id AND m.entreprise_id = i.entreprise_id
         WHERE i.id = $1 AND i.entreprise_id = $2`,
        [interventionId, user.entreprise_id]
    );
    const intervention = result.rows[0];

    if (!intervention || user.role === "CLIENT") return null;
    if (user.role === "ADMIN") return intervention;

    return Number(intervention.technicien_id) === Number(user.id) ? intervention : null;
}

router.post("/photo/:intervention_id", verifyToken, receivePhoto, async (req, res) => {
    const interventionId = parseInterventionId(req.params.intervention_id);

    if (!interventionId) {
        return res.status(400).json({ error: "Identifiant d'intervention invalide." });
    }
    if (!req.file) {
        return res.status(400).json({ error: "Aucune photo fournie dans le champ 'photo'." });
    }

    let relativeUrl;
    try {
        const intervention = await canModifyIntervention(interventionId, req.user);
        if (!intervention) {
            return res.status(404).json({ error: "Intervention introuvable." });
        }
        const photoSections = Array.isArray(intervention.report_sections)
            ? intervention.report_sections.filter((section) => ["photo", "multi_photo", "event_photos"].includes(section.type))
            : [];
        const photoLimit = photoSections.reduce((total, section) => total + Math.max(1, Number(section.maxPhotos) || (section.type === "photo" ? 1 : 5)), 0);
        if (photoSections.length && Number(intervention.photo_count) >= photoLimit) {
            return res.status(409).json({ error: `La limite de ${photoLimit} photo(s) définie par le modèle est atteinte.` });
        }

        relativeUrl = await uploadCompressedPhoto(req.file.buffer);
        const url = absoluteUploadUrl(req, relativeUrl);
        const result = await pool.query(
            `INSERT INTO photos (entreprise_id, intervention_id, url)
             VALUES ($1, $2, $3)
             RETURNING id, entreprise_id, intervention_id, url, created_at`,
            [req.user.entreprise_id, interventionId, url]
        );

        return res.status(201).json({ photo: result.rows[0] });
    } catch (error) {
        if (relativeUrl) await removeStoredUpload(relativeUrl);
        if (error instanceof TypeError) {
            return res.status(400).json({ error: error.message });
        }

        console.error("Échec de l'upload photo", error);
        return res.status(500).json({ error: "Impossible d'enregistrer la photo." });
    }
});

router.get("/photo/:id/source", verifyToken, async (req, res) => {
    const photoId = parseInterventionId(req.params.id);
    if (!photoId) return res.status(400).json({ error: "Photo invalide." });
    try {
        const result = await pool.query(
            `SELECT p.url FROM photos p
             JOIN interventions i ON i.id = p.intervention_id AND i.entreprise_id = p.entreprise_id
             JOIN clients c ON c.id = i.client_id AND c.entreprise_id = i.entreprise_id
             WHERE p.id = $1 AND p.entreprise_id = $2
               AND ${readableInterventionMediaCondition}`,
            [photoId, req.user.entreprise_id, req.user.role, req.user.id]
        );
        if (!result.rowCount) return res.status(404).json({ error: "Photo introuvable." });
        return await sendStoredImage(res, result.rows[0].url);
    } catch (error) {
        console.error("Échec du chargement de la photo", safeStorageError(error));
        return res.status(502).json({ error: "Impossible de charger la photo." });
    }
});

router.patch("/photo/:id/rotation", verifyToken, async (req, res) => {
    const photoId = parseInterventionId(req.params.id);
    const rotation = Number(req.body.rotation);
    if (!photoId || ![0, 90, 180, 270].includes(rotation)) {
        return res.status(400).json({ error: "Rotation invalide." });
    }
    try {
        const result = await pool.query(
            `UPDATE photos p SET rotation = $1
             FROM interventions i
             WHERE p.id = $2 AND p.entreprise_id = $3
               AND i.id = p.intervention_id AND i.entreprise_id = p.entreprise_id
               AND ($4 = 'ADMIN' OR ($4 = 'TECHNICIEN' AND i.technicien_id = $5))
             RETURNING p.id, p.url, p.rotation`,
            [rotation, photoId, req.user.entreprise_id, req.user.role, req.user.id]
        );
        if (!result.rowCount) return res.status(404).json({ error: "Photo introuvable." });
        return res.json({ photo: result.rows[0] });
    } catch (error) {
        console.error("Échec de la rotation de la photo", error);
        return res.status(500).json({ error: "Impossible de faire pivoter la photo." });
    }
});

router.patch("/photo/:id/image", verifyToken, async (req, res) => {
    const photoId = parseInterventionId(req.params.id);
    if (!photoId) return res.status(400).json({ error: "Photo invalide." });
    let storedUrl;
    try {
        const current = await pool.query(
            `SELECT p.id, p.url FROM photos p JOIN interventions i ON i.id = p.intervention_id AND i.entreprise_id = p.entreprise_id
             WHERE p.id = $1 AND p.entreprise_id = $2 AND ($3 = 'ADMIN' OR ($3 = 'TECHNICIEN' AND i.technicien_id = $4))`,
            [photoId, req.user.entreprise_id, req.user.role, req.user.id]
        );
        if (!current.rowCount) return res.status(404).json({ error: "Photo introuvable." });
        storedUrl = await uploadEditedPhotoBase64(req.body.imageData);
        const url = absoluteUploadUrl(req, storedUrl);
        const result = await pool.query(
            "UPDATE photos SET url = $1, rotation = 0 WHERE id = $2 AND entreprise_id = $3 RETURNING id, url, rotation",
            [url, photoId, req.user.entreprise_id]
        );
        await removeStoredUpload(current.rows[0].url).catch(() => {});
        return res.json({ photo: result.rows[0] });
    } catch (error) {
        if (storedUrl) await removeStoredUpload(storedUrl).catch(() => {});
        if (error instanceof TypeError || error instanceof RangeError) return res.status(400).json({ error: error.message });
        console.error("Échec de l’annotation de la photo", error);
        return res.status(500).json({ error: "Impossible d’enregistrer l’image annotée." });
    }
});

router.post("/signature/:intervention_id", verifyToken, async (req, res) => {
    const interventionId = parseInterventionId(req.params.intervention_id);
    const signatureData = req.body?.signatureData ?? req.body?.signature_data;

    if (!interventionId) {
        return res.status(400).json({ error: "Identifiant d'intervention invalide." });
    }
    if (!signatureData) {
        return res.status(400).json({ error: "Aucune signature fournie." });
    }

    let relativeUrl;
    try {
        const intervention = await canModifyIntervention(interventionId, req.user);
        if (!intervention) {
            return res.status(404).json({ error: "Intervention introuvable." });
        }

        relativeUrl = await uploadSignatureBase64(signatureData);
        const signatureUrl = absoluteUploadUrl(req, relativeUrl);
        const result = await pool.query(
            `UPDATE interventions
             SET signature_url = $1, updated_at = NOW()
             WHERE id = $2 AND entreprise_id = $3
             RETURNING id, signature_url`,
            [signatureUrl, interventionId, req.user.entreprise_id]
        );

        await removeStoredUpload(intervention.signature_url);
        return res.json({
            intervention_id: result.rows[0].id,
            signature_url: result.rows[0].signature_url,
        });
    } catch (error) {
        if (relativeUrl) await removeStoredUpload(relativeUrl);
        if (error instanceof TypeError || error instanceof RangeError) {
            return res.status(400).json({ error: error.message });
        }

        console.error("Échec de l'upload signature", error);
        return res.status(500).json({ error: "Impossible d'enregistrer la signature." });
    }
});

router.get("/signature/:intervention_id/source", verifyToken, async (req, res) => {
    const interventionId = parseInterventionId(req.params.intervention_id);
    if (!interventionId) return res.status(400).json({ error: "Signature invalide." });
    try {
        const result = await pool.query(
            `SELECT i.signature_url AS url
             FROM interventions i
             JOIN clients c ON c.id = i.client_id AND c.entreprise_id = i.entreprise_id
             WHERE i.id = $1 AND i.entreprise_id = $2
               AND ${readableInterventionMediaCondition}`,
            [interventionId, req.user.entreprise_id, req.user.role, req.user.id]
        );
        const signatureUrl = result.rows[0]?.url;
        if (!signatureUrl) return res.status(404).json({ error: "Signature introuvable." });
        return await sendStoredImage(res, signatureUrl);
    } catch (error) {
        console.error("Échec du chargement de la signature", safeStorageError(error));
        return res.status(502).json({ error: "Impossible de charger la signature." });
    }
});

function signatureFieldKey(value) {
    const key = typeof value === "string" ? value.trim() : "";
    return /^[a-zA-Z0-9_-]{1,60}$/.test(key) ? key : null;
}

router.get("/signature-field/:intervention_id/:section_key/source", verifyToken, async (req, res) => {
    const interventionId = parseInterventionId(req.params.intervention_id);
    const sectionKey = signatureFieldKey(req.params.section_key);
    if (!interventionId || !sectionKey) return res.status(400).json({ error: "Signature de rapport invalide." });
    try {
        const result = await pool.query(
            `SELECT i.donnees_rapport->>$5 AS url
             FROM interventions i
             JOIN clients c ON c.id = i.client_id AND c.entreprise_id = i.entreprise_id
             WHERE i.id = $1 AND i.entreprise_id = $2
               AND ${readableInterventionMediaCondition}`,
            [interventionId, req.user.entreprise_id, req.user.role, req.user.id, sectionKey]
        );
        const signatureUrl = result.rows[0]?.url;
        if (!signatureUrl) return res.status(404).json({ error: "Signature de rapport introuvable." });
        return await sendStoredImage(res, signatureUrl);
    } catch (error) {
        console.error("Échec du chargement d’une signature de rapport", safeStorageError(error));
        return res.status(502).json({ error: "Impossible de charger cette signature." });
    }
});

router.post("/signature-field/:intervention_id/:section_key", verifyToken, async (req, res) => {
    const interventionId = parseInterventionId(req.params.intervention_id);
    const sectionKey = signatureFieldKey(req.params.section_key);
    const signatureData = req.body?.signatureData ?? req.body?.signature_data;
    const signerName = typeof req.body?.signerName === "string"
        ? req.body.signerName.trim().slice(0, 150)
        : "";
    if (!interventionId || !sectionKey) return res.status(400).json({ error: "Signature de rapport invalide." });
    if (!signatureData) return res.status(400).json({ error: "Aucune signature fournie." });
    let relativeUrl;
    try {
        const intervention = await canModifyIntervention(interventionId, req.user);
        if (!intervention) return res.status(404).json({ error: "Intervention introuvable." });
        const section = Array.isArray(intervention.report_sections)
            ? intervention.report_sections.find((entry) => entry.key === sectionKey && ["signature", "electronic_signature"].includes(entry.type))
            : null;
        if (!section) return res.status(404).json({ error: "Ce champ de signature n’existe pas dans le modèle." });
        const current = await pool.query("SELECT donnees_rapport->>$1 AS url FROM interventions WHERE id=$2 AND entreprise_id=$3", [sectionKey, interventionId, req.user.entreprise_id]);
        relativeUrl = await uploadSignatureBase64(signatureData);
        const signatureUrl = absoluteUploadUrl(req, relativeUrl);
        const result = await pool.query(
            `UPDATE interventions
             SET donnees_rapport=jsonb_set(
                    jsonb_set(COALESCE(donnees_rapport, '{}'::jsonb), ARRAY[$1]::text[], to_jsonb($2::text), true),
                    ARRAY[$3]::text[], to_jsonb($4::text), true
                 ),
                 report_version=report_version+1,
                 updated_at=NOW()
             WHERE id=$5 AND entreprise_id=$6
             RETURNING id, report_version, donnees_rapport`,
            [sectionKey, signatureUrl, `${sectionKey}_name`, signerName, interventionId, req.user.entreprise_id]
        );
        if (!result.rowCount) throw new Error("Intervention introuvable.");
        await removeStoredUpload(current.rows[0]?.url).catch(() => {});
        return res.json({
            intervention_id: interventionId,
            section_key: sectionKey,
            signature_url: signatureUrl,
            signer_name: signerName,
            report_version: result.rows[0].report_version,
            donnees_rapport: result.rows[0].donnees_rapport,
        });
    } catch (error) {
        if (relativeUrl) await removeStoredUpload(relativeUrl).catch(() => {});
        if (error instanceof TypeError || error instanceof RangeError) return res.status(400).json({ error: error.message });
        console.error("Échec de l’upload d’une signature de rapport", error);
        return res.status(500).json({ error: "Impossible d’enregistrer cette signature." });
    }
});

router.delete("/signature-field/:intervention_id/:section_key", verifyToken, async (req, res) => {
    const interventionId = parseInterventionId(req.params.intervention_id);
    const sectionKey = signatureFieldKey(req.params.section_key);
    if (!interventionId || !sectionKey) return res.status(400).json({ error: "Signature de rapport invalide." });
    try {
        const intervention = await canModifyIntervention(interventionId, req.user);
        if (!intervention) return res.status(404).json({ error: "Intervention introuvable." });
        const current = await pool.query("SELECT donnees_rapport->>$1 AS url FROM interventions WHERE id=$2 AND entreprise_id=$3", [sectionKey, interventionId, req.user.entreprise_id]);
        if (!current.rows[0]?.url) return res.status(404).json({ error: "Aucune signature enregistrée pour ce champ." });
        const result = await pool.query(`UPDATE interventions SET donnees_rapport=COALESCE(donnees_rapport, '{}'::jsonb)-$1-$2, report_version=report_version+1, updated_at=NOW() WHERE id=$3 AND entreprise_id=$4 RETURNING report_version, donnees_rapport`, [sectionKey, `${sectionKey}_name`, interventionId, req.user.entreprise_id]);
        const fileDeleted = await removeStoredUpload(current.rows[0].url);
        return res.json({ intervention_id: interventionId, section_key: sectionKey, file_deleted: fileDeleted, report_version: result.rows[0].report_version, donnees_rapport: result.rows[0].donnees_rapport });
    } catch (error) {
        console.error("Échec de la suppression d’une signature de rapport", error);
        return res.status(500).json({ error: "Impossible de supprimer cette signature." });
    }
});

router.delete("/photo/:id", verifyToken, async (req, res) => {
    const photoId = parseInterventionId(req.params.id);
    if (!photoId) return res.status(400).json({ error: "Identifiant photo invalide." });

    try {
        const photoResult = await pool.query(
            `SELECT p.id, p.url, p.intervention_id
             FROM photos p
             WHERE p.id = $1 AND p.entreprise_id = $2`,
            [photoId, req.user.entreprise_id]
        );
        const photo = photoResult.rows[0];
        if (!photo || !(await canModifyIntervention(photo.intervention_id, req.user))) {
            return res.status(404).json({ error: "Photo introuvable." });
        }

        const deleted = await pool.query(
            `DELETE FROM photos
             WHERE id = $1 AND entreprise_id = $2
             RETURNING id`,
            [photoId, req.user.entreprise_id]
        );
        if (deleted.rowCount === 0) return res.status(404).json({ error: "Photo introuvable." });

        const fileDeleted = await removeStoredUpload(photo.url);
        return res.json({ id: photo.id, file_deleted: fileDeleted });
    } catch (error) {
        console.error("Échec de la suppression photo", error);
        return res.status(500).json({ error: "Impossible de supprimer la photo." });
    }
});

router.delete("/signature/:intervention_id", verifyToken, async (req, res) => {
    const interventionId = parseInterventionId(req.params.intervention_id);
    if (!interventionId) {
        return res.status(400).json({ error: "Identifiant d'intervention invalide." });
    }

    try {
        const intervention = await canModifyIntervention(interventionId, req.user);
        if (!intervention) return res.status(404).json({ error: "Intervention introuvable." });
        if (!intervention.signature_url) {
            return res.status(404).json({ error: "Aucune signature enregistrée." });
        }

        const updated = await pool.query(
            `UPDATE interventions
             SET signature_url = NULL, updated_at = NOW()
             WHERE id = $1 AND entreprise_id = $2
             RETURNING id`,
            [interventionId, req.user.entreprise_id]
        );
        if (updated.rowCount === 0) return res.status(404).json({ error: "Intervention introuvable." });

        const fileDeleted = await removeStoredUpload(intervention.signature_url);
        return res.json({ intervention_id: interventionId, signature_url: null, file_deleted: fileDeleted });
    } catch (error) {
        console.error("Échec de la suppression signature", error);
        return res.status(500).json({ error: "Impossible de supprimer la signature." });
    }
});

export default router;
