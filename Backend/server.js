import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";

import auth from "./routes/auth.js";
import interventions from "./routes/interventions.js";
import clients from "./routes/clients.js";
import equipements from "./routes/equipements.js";
import uploads from "./routes/uploads.js";
import modeles from "./routes/modeles.js";
import documents from "./routes/documents.js";
import { UPLOADS_DIRECTORY } from "./config/cloud.js";
import { ensureUploadDirectories } from "./services/storage.js";
import pool from "./config/database.js";
import { runMigrations } from "./database/migrate.js";

const app = express();
const port = Number.parseInt(process.env.PORT ?? "5000", 10);
const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(backendDirectory, "../Frontend");
const production = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

if (!production) {
    allowedOrigins.push(`http://localhost:${port}`, `http://127.0.0.1:${port}`);
}

app.disable("x-powered-by");
app.set("trust proxy", production ? 1 : false);
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
                connectSrc: ["'self'", ...allowedOrigins],
                fontSrc: ["'self'", "data:"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: production ? [] : null,
            },
        },
        crossOriginResourcePolicy: { policy: "same-origin" },
    })
);
if (allowedOrigins.length > 0) {
    app.use(
        cors({
            origin(origin, callback) {
                if (!origin || allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                return callback(new Error("Origine non autorisée par CORS."));
            },
            credentials: true,
        })
    );
}
app.use(express.json({ limit: "4mb" }));
app.use("/uploads", express.static(UPLOADS_DIRECTORY, { fallthrough: false }));

app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
});

app.use("/api/auth", auth);
app.use("/api/interventions", interventions);
app.use("/api/clients", clients);
app.use("/api/equipements", equipements);
app.use("/api/uploads", uploads);
app.use("/api/modeles", modeles);
app.use("/api/documents", documents);

app.use(express.static(frontendDirectory));
app.get("/", (_req, res) => res.sendFile(path.join(frontendDirectory, "index.html")));

app.use((error, _req, res, _next) => {
    console.error("Erreur serveur non gérée", error);
    res.status(500).json({ error: "Erreur interne du serveur." });
});

try {
    console.log("Vérification des migrations PostgreSQL...");
    await runMigrations();
    await ensureUploadDirectories();
} catch (error) {
    console.error("Erreur lors de la migration ou de l'initialisation :", error);
    await pool.end().catch(() => {});
    process.exit(1);
}

const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Intervium écoute sur le port ${port}`);
});

async function shutdown(signal) {
    console.log(`${signal} reçu, arrêt propre du serveur...`);
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });

    setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
