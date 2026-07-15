import express from "express";
import multer from "multer";
import pool from "../config/database.js";
import { requireRole, verifyToken } from "../middleware/auth.js";
import {
    removeStoredUpload,
    uploadCompressedPhoto,
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
