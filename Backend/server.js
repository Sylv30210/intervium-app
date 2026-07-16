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
import activity from "./routes/activity.js";
import notifications from "./routes/notifications.js";
import search from "./routes/search.js";
import { UPLOADS_DIRECTORY } from "./config/cloud.js";
import { ensureUploadDirectories } from "./services/storage.js";
import pool from "./config/database.js";
import { runMigrations } from "./database/migrate.js";
import { verifyToken } from "./middleware/auth.js";
import { verifyRequestOrigin } from "./middleware/security.js";

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
app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store, private");
    res.set("Pragma", "no-cache");
    next();
});
app.use("/api", verifyRequestOrigin);
app.use(express.json({ limit: "4mb" }));

async function authorizeLocalMedia(req, res, next) {
    const match = req.path.match(/^\/(photos|signatures|logos)\/([a-zA-Z0-9._-]+)$/);
    if (!match) return res.status(404).json({ error: "Média introuvable." });
    const [, category, filename] = match;
    const suffix = `%/uploads/${category}/${filename}`;
    try {
        let query;
        let values;
        if (category === "logos") {
            query = "SELECT 1 FROM entreprises WHERE id = $1 AND logo_url LIKE $2";
            values = [req.user.entreprise_id, suffix];
        } else {
            const mediaColumn = category === "photos" ? "p.url" : "i.signature_url";
            const mediaJoin = category === "photos"
                ? "JOIN photos p ON p.intervention_id = i.id AND p.entreprise_id = i.entreprise_id"
                : "";
            query = `SELECT 1 FROM interventions i ${mediaJoin}
                     JOIN clients c ON c.id = i.client_id AND c.entreprise_id = i.entreprise_id
                     WHERE i.entreprise_id = $1 AND ${mediaColumn} LIKE $2
                       AND ($3 = 'ADMIN' OR ($3 = 'TECHNICIEN' AND i.technicien_id = $4)
                            OR ($3 = 'CLIENT' AND c.utilisateur_id = $4))`;
            values = [req.user.entreprise_id, suffix, req.user.role, req.user.id];
        }
        const result = await pool.query(query, values);
        if (!result.rowCount) return res.status(404).json({ error: "Média introuvable." });
        return next();
    } catch (error) {
        console.error("Échec du contrôle d’accès au média", { name: error?.name, code: error?.code });
        return res.status(500).json({ error: "Impossible de vérifier l’accès au média." });
    }
}
app.use(
    "/uploads",
    (_req, res, next) => {
        res.set("Cache-Control", "no-store, private");
        next();
    },
    verifyToken,
    authorizeLocalMedia,
    express.static(UPLOADS_DIRECTORY, { fallthrough: false, dotfiles: "deny", index: false })
);

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
app.use("/api/activity", activity);
app.use("/api/notifications", notifications);
app.use("/api/search", search);

app.get("/sw.js", (_req, res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Service-Worker-Allowed", "/");
    res.sendFile(path.join(frontendDirectory, "sw.js"));
});
app.use(
    express.static(frontendDirectory, {
        setHeaders(res, filePath) {
            if (filePath.endsWith("index.html") || filePath.endsWith("manifest.webmanifest")) {
                res.setHeader("Cache-Control", "no-cache");
            }
        },
    })
);
app.get("/", (_req, res) => res.sendFile(path.join(frontendDirectory, "index.html")));

app.use((error, _req, res, _next) => {
    if (error?.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Corps JSON invalide." });
    }
    if (error?.type === "entity.too.large") {
        return res.status(413).json({ error: "Requête trop volumineuse." });
    }
    if (error?.message === "Origine non autorisée par CORS.") {
        return res.status(403).json({ error: "Origine non autorisée." });
    }
    console.error("Erreur serveur non gérée", error);
    return res.status(500).json({ error: "Erreur interne du serveur." });
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
