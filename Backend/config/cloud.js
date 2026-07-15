// Le stockage cloud est désactivé en développement local.
// Ce module centralise désormais les chemins utilisés par le stockage disque.
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDirectory = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
);

export const STORAGE_DRIVER = String(
    process.env.STORAGE_DRIVER || (process.env.CLOUDINARY_URL ? "cloudinary" : "local")
).toLowerCase();

if (!["local", "cloudinary"].includes(STORAGE_DRIVER)) {
    throw new Error("STORAGE_DRIVER doit valoir 'local' ou 'cloudinary'.");
}

export const UPLOADS_DIRECTORY = process.env.UPLOADS_DIRECTORY
    ? path.resolve(process.env.UPLOADS_DIRECTORY)
    : path.join(backendDirectory, "uploads");
export const PHOTOS_DIRECTORY = path.join(UPLOADS_DIRECTORY, "photos");
export const SIGNATURES_DIRECTORY = path.join(UPLOADS_DIRECTORY, "signatures");
export const LOGOS_DIRECTORY = path.join(UPLOADS_DIRECTORY, "logos");
export const UPLOADS_PUBLIC_PATH = "/uploads";
