import crypto from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import {
    PHOTOS_DIRECTORY,
    SIGNATURES_DIRECTORY,
    LOGOS_DIRECTORY,
    STORAGE_DRIVER,
    UPLOADS_DIRECTORY,
    UPLOADS_PUBLIC_PATH,
} from "../config/cloud.js";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const MAX_STORED_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_STORED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

if (STORAGE_DRIVER === "cloudinary") {
    if (!process.env.CLOUDINARY_URL) {
        throw new Error(
            "CLOUDINARY_URL est requis lorsque STORAGE_DRIVER=cloudinary."
        );
    }
    cloudinary.config({ secure: true });
}

function uniqueId() {
    return `${Date.now()}-${crypto.randomBytes(16).toString("hex")}`;
}

export async function ensureUploadDirectories() {
    if (STORAGE_DRIVER !== "local") return;
    await Promise.all([
        mkdir(UPLOADS_DIRECTORY, { recursive: true }),
        mkdir(PHOTOS_DIRECTORY, { recursive: true }),
        mkdir(SIGNATURES_DIRECTORY, { recursive: true }),
        mkdir(LOGOS_DIRECTORY, { recursive: true }),
    ]);
}

function uploadToCloudinary(buffer, folder, format) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: "image",
                folder: `intervium/${folder}`,
                public_id: uniqueId(),
                format,
                overwrite: false,
            },
            (error, result) => {
                if (error) return reject(error);
                if (!result?.secure_url) {
                    return reject(new Error("Cloudinary n'a retourné aucune URL."));
                }
                return resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
}

async function persistImage(buffer, folder, extension) {
    if (STORAGE_DRIVER === "cloudinary") {
        return uploadToCloudinary(buffer, folder, extension);
    }

    await ensureUploadDirectories();
    const directories = {
        photos: PHOTOS_DIRECTORY,
        signatures: SIGNATURES_DIRECTORY,
        logos: LOGOS_DIRECTORY,
    };
    const directory = directories[folder];
    if (!directory) throw new Error("Dossier de stockage inconnu.");

    const filename = `${uniqueId()}.${extension}`;
    await writeFile(path.join(directory, filename), buffer, { flag: "wx" });
    return `${UPLOADS_PUBLIC_PATH}/${folder}/${filename}`;
}

function cloudinaryPublicId(publicUrl) {
    try {
        const url = new URL(publicUrl);
        if (url.hostname !== "res.cloudinary.com") return null;
        const match = url.pathname.match(
            /^\/[^/]+\/image\/upload\/(?:v\d+\/)?(.+)$/
        );
        if (!match) return null;
        return decodeURIComponent(match[1]).replace(/\.[a-zA-Z0-9]+$/, "");
    } catch {
        return null;
    }
}

export async function removeStoredUpload(publicUrl) {
    if (!publicUrl) return false;

    if (STORAGE_DRIVER === "cloudinary") {
        const publicId = cloudinaryPublicId(publicUrl);
        if (!publicId) return false;
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: "image",
            invalidate: true,
        });
        return ["ok", "not found"].includes(result?.result);
    }

    try {
        const pathname = new URL(publicUrl, "http://localhost").pathname;
        if (!pathname.startsWith(`${UPLOADS_PUBLIC_PATH}/`)) return false;

        const relativePath = decodeURIComponent(
            pathname.slice(`${UPLOADS_PUBLIC_PATH}/`.length)
        );
        const absolutePath = path.resolve(UPLOADS_DIRECTORY, relativePath);
        const uploadsRoot = `${path.resolve(UPLOADS_DIRECTORY)}${path.sep}`;
        if (!absolutePath.startsWith(uploadsRoot)) return false;

        await unlink(absolutePath);
        return true;
    } catch (error) {
        if (error.code === "ENOENT") return false;
        console.error("Impossible de supprimer un média stocké", error);
        return false;
    }
}

export async function readStoredImage(publicUrl) {
    if (!publicUrl) throw new TypeError("Image stockée introuvable.");

    if (STORAGE_DRIVER === "cloudinary") {
        if (!cloudinaryPublicId(publicUrl)) throw new TypeError("Adresse d’image stockée invalide.");
        const response = await fetch(publicUrl, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error(`Le stockage distant a répondu ${response.status}.`);
        const contentType = String(response.headers.get("content-type") || "").split(";", 1)[0].toLowerCase();
        if (!ALLOWED_STORED_IMAGE_TYPES.has(contentType)) throw new TypeError("Le média stocké n’est pas une image prise en charge.");
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length || buffer.length > MAX_STORED_IMAGE_BYTES) throw new RangeError("L’image stockée dépasse la limite autorisée.");
        return { buffer, contentType };
    }

    const pathname = new URL(publicUrl, "http://localhost").pathname;
    if (!pathname.startsWith(`${UPLOADS_PUBLIC_PATH}/`)) throw new TypeError("Adresse d’image stockée invalide.");
    const relativePath = decodeURIComponent(pathname.slice(`${UPLOADS_PUBLIC_PATH}/`.length));
    const absolutePath = path.resolve(UPLOADS_DIRECTORY, relativePath);
    const uploadsRoot = `${path.resolve(UPLOADS_DIRECTORY)}${path.sep}`;
    if (!absolutePath.startsWith(uploadsRoot)) throw new TypeError("Adresse d’image stockée invalide.");
    const extension = path.extname(absolutePath).toLowerCase();
    const contentType = ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" })[extension];
    if (!contentType) throw new TypeError("Le média stocké n’est pas une image prise en charge.");
    const buffer = await readFile(absolutePath);
    if (!buffer.length || buffer.length > MAX_STORED_IMAGE_BYTES) throw new RangeError("L’image stockée dépasse la limite autorisée.");
    return { buffer, contentType };
}

export async function uploadCompressedPhoto(fileBuffer) {
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        throw new TypeError("Le fichier photo est vide ou invalide.");
    }

    let optimizedBuffer;
    try {
        const normalizedBuffer = await sharp(fileBuffer, { failOn: "error" })
            .rotate()
            .toBuffer();
        const metadata = await sharp(normalizedBuffer).metadata();
        optimizedBuffer = await sharp(normalizedBuffer)
            .rotate(landscapeRotation(metadata.width, metadata.height))
            .resize({ width: 1200, withoutEnlargement: true, fit: "inside" })
            .webp({ quality: 80 })
            .toBuffer();
    } catch {
        throw new TypeError("Le contenu fourni n'est pas une image valide.");
    }

    return persistImage(optimizedBuffer, "photos", "webp");
}

export function landscapeRotation(width, height) {
    return Number(height) > Number(width) ? 90 : 0;
}

export async function uploadEditedPhotoBase64(base64Data) {
    if (typeof base64Data !== "string") throw new TypeError("Image modifiée invalide.");
    const match = base64Data.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) throw new TypeError("L’image modifiée doit être un PNG valide.");
    const decoded = Buffer.from(match[1], "base64");
    if (!decoded.length || decoded.length > 8 * 1024 * 1024) throw new RangeError("L’image modifiée dépasse la limite de 8 Mo.");
    try {
        const buffer = await sharp(decoded, { failOn: "error" }).resize({ width: 1600, withoutEnlargement: true, fit: "inside" }).webp({ quality: 86 }).toBuffer();
        return persistImage(buffer, "photos", "webp");
    } catch (error) {
        if (error instanceof RangeError) throw error;
        throw new TypeError("Le contenu de l’image modifiée est invalide.");
    }
}

export async function uploadCompanyLogo(fileBuffer) {
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        throw new TypeError("Le fichier du logo est vide ou invalide.");
    }

    let pngBuffer;
    try {
        pngBuffer = await sharp(fileBuffer, { failOn: "error" })
            .rotate()
            .resize({
                width: 800,
                height: 300,
                fit: "inside",
                withoutEnlargement: true,
            })
            .png({ compressionLevel: 9 })
            .toBuffer();
    } catch {
        throw new TypeError("Le logo fourni n'est pas une image valide.");
    }

    return persistImage(pngBuffer, "logos", "png");
}

export async function uploadSignatureBase64(base64Data) {
    if (typeof base64Data !== "string") {
        throw new TypeError("La signature doit être une chaîne Base64.");
    }

    const match = base64Data.match(
        /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/
    );
    if (!match) {
        throw new TypeError("La signature doit être une image PNG Base64 valide.");
    }

    const decodedBuffer = Buffer.from(match[1], "base64");
    if (decodedBuffer.length === 0 || decodedBuffer.length > MAX_SIGNATURE_BYTES) {
        throw new RangeError("La signature est vide ou dépasse la limite de 2 Mo.");
    }

    let pngBuffer;
    try {
        const { data, info } = await sharp(decodedBuffer, { failOn: "error" })
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        let hasVisibleInk = false;
        for (let offset = 0; offset < data.length; offset += info.channels) {
            const alpha = data[offset + 3];
            if (
                alpha > 15 &&
                (data[offset] < 245 ||
                    data[offset + 1] < 245 ||
                    data[offset + 2] < 245)
            ) {
                hasVisibleInk = true;
                break;
            }
        }
        if (!hasVisibleInk) throw new RangeError("La signature est vide.");
        pngBuffer = await sharp(decodedBuffer, { failOn: "error" })
            .png()
            .toBuffer();
    } catch (error) {
        if (error instanceof RangeError) throw error;
        throw new TypeError("Le contenu fourni n'est pas une signature PNG valide.");
    }

    return persistImage(pngBuffer, "signatures", "png");
}
