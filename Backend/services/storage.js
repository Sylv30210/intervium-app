import crypto from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
    PHOTOS_DIRECTORY,
    SIGNATURES_DIRECTORY,
    LOGOS_DIRECTORY,
    UPLOADS_DIRECTORY,
    UPLOADS_PUBLIC_PATH,
} from "../config/cloud.js";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

function uniqueFilename(extension) {
    return `${Date.now()}-${crypto.randomBytes(16).toString("hex")}.${extension}`;
}

export async function ensureUploadDirectories() {
    await Promise.all([
        mkdir(UPLOADS_DIRECTORY, { recursive: true }),
        mkdir(PHOTOS_DIRECTORY, { recursive: true }),
        mkdir(SIGNATURES_DIRECTORY, { recursive: true }),
        mkdir(LOGOS_DIRECTORY, { recursive: true }),
    ]);
}

export async function removeLocalUpload(publicUrl) {
    if (!publicUrl) return false;

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
        console.error("Impossible de supprimer un média local", error);
        return false;
    }
}

export async function uploadCompressedPhoto(fileBuffer) {
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        throw new TypeError("Le fichier photo est vide ou invalide.");
    }

    let optimizedBuffer;
    try {
        optimizedBuffer = await sharp(fileBuffer, { failOn: "error" })
            .rotate()
            .resize({ width: 1200, withoutEnlargement: true, fit: "inside" })
            .webp({ quality: 80 })
            .toBuffer();
    } catch {
        throw new TypeError("Le contenu fourni n'est pas une image valide.");
    }

    await ensureUploadDirectories();
    const filename = uniqueFilename("webp");
    await writeFile(path.join(PHOTOS_DIRECTORY, filename), optimizedBuffer, { flag: "wx" });
    return `${UPLOADS_PUBLIC_PATH}/photos/${filename}`;
}

export async function uploadCompanyLogo(fileBuffer) {
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        throw new TypeError("Le fichier du logo est vide ou invalide.");
    }

    let pngBuffer;
    try {
        pngBuffer = await sharp(fileBuffer, { failOn: "error" })
            .rotate()
            .resize({ width: 800, height: 300, fit: "inside", withoutEnlargement: true })
            .png({ compressionLevel: 9 })
            .toBuffer();
    } catch {
        throw new TypeError("Le logo fourni n'est pas une image valide.");
    }

    await ensureUploadDirectories();
    const filename = uniqueFilename("png");
    await writeFile(path.join(LOGOS_DIRECTORY, filename), pngBuffer, { flag: "wx" });
    return `${UPLOADS_PUBLIC_PATH}/logos/${filename}`;
}

export async function uploadSignatureBase64(base64Data) {
    if (typeof base64Data !== "string") {
        throw new TypeError("La signature doit être une chaîne Base64.");
    }

    const match = base64Data.match(/^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/);
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
                (data[offset] < 245 || data[offset + 1] < 245 || data[offset + 2] < 245)
            ) {
                hasVisibleInk = true;
                break;
            }
        }
        if (!hasVisibleInk) throw new RangeError("La signature est vide.");
        pngBuffer = await sharp(decodedBuffer, { failOn: "error" }).png().toBuffer();
    } catch (error) {
        if (error instanceof RangeError) throw error;
        throw new TypeError("Le contenu fourni n'est pas une signature PNG valide.");
    }

    await ensureUploadDirectories();
    const filename = uniqueFilename("png");
    await writeFile(path.join(SIGNATURES_DIRECTORY, filename), pngBuffer, { flag: "wx" });
    return `${UPLOADS_PUBLIC_PATH}/signatures/${filename}`;
}
