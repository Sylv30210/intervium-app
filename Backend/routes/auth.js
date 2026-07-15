import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";
import { COOKIE_NAME, optionalAuth, requireRole, verifyToken } from "../middleware/auth.js";

const router = express.Router();
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const ROLES = new Set(["ADMIN", "TECHNICIEN", "CLIENT"]);
const REPORT_HEADER_STYLES = new Set(["minimal", "band", "none"]);

function companyPayload(row) {
    return {
        id: row.entreprise_id ?? row.id,
        nom: row.entreprise_nom ?? row.nom,
        logo_url: row.entreprise_logo_url ?? row.logo_url ?? null,
        report_settings: row.entreprise_report_settings ?? row.report_settings ?? {},
    };
}

function limitedText(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sessionCookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: SESSION_DURATION_MS,
        path: "/",
    };
}

function publicUser(user) {
    return {
        id: user.id,
        entreprise_id: user.entreprise_id,
        nom: user.nom,
        email: user.email,
        role: user.role,
    };
}

router.post("/register", optionalAuth, async (req, res) => {
    const nom = typeof req.body.nom === "string" ? req.body.nom.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const nomEntreprise =
        typeof req.body.nom_entreprise === "string" ? req.body.nom_entreprise.trim() : "";

    if (!nom || !email || !password) {
        return res.status(400).json({ error: "Nom, email et mot de passe sont requis." });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    }

    const createsEntreprise = Boolean(nomEntreprise);

    if (!createsEntreprise && (!req.user || req.user.role !== "ADMIN")) {
        return res.status(403).json({
            error: "Seul un ADMIN connecté peut ajouter un utilisateur à son entreprise.",
        });
    }

    let role = "ADMIN";
    if (!createsEntreprise) {
        role = typeof req.body.role === "string" ? req.body.role.toUpperCase() : "TECHNICIEN";
        if (!ROLES.has(role)) {
            return res.status(400).json({ error: "Rôle invalide." });
        }
    }

    let client;

    try {
        client = await pool.connect();
        const hashedPassword = await bcrypt.hash(password, 12);
        await client.query("BEGIN");

        let entrepriseId;
        if (createsEntreprise) {
            const entrepriseResult = await client.query(
                "INSERT INTO entreprises (nom) VALUES ($1) RETURNING id",
                [nomEntreprise]
            );
            entrepriseId = entrepriseResult.rows[0].id;
        } else {
            entrepriseId = req.user.entreprise_id;
        }

        const userResult = await client.query(
            `INSERT INTO utilisateurs (entreprise_id, nom, email, password, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, entreprise_id, nom, email, role`,
            [entrepriseId, nom, email, hashedPassword, role]
        );

        await client.query("COMMIT");
        return res.status(201).json({
            message: createsEntreprise
                ? "Entreprise et compte administrateur créés."
                : "Utilisateur créé.",
            user: publicUser(userResult.rows[0]),
        });
    } catch (error) {
        if (client) await client.query("ROLLBACK");

        if (error.code === "23505") {
            return res.status(409).json({ error: "Cet email est déjà utilisé." });
        }

        console.error("Échec de l'inscription", error);
        return res.status(500).json({ error: "Impossible de créer le compte." });
    } finally {
        client?.release();
    }
});

router.post("/login", async (req, res) => {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!email || !password) {
        return res.status(400).json({ error: "Email et mot de passe sont requis." });
    }

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET n'est pas configuré.");
        return res.status(500).json({ error: "Erreur de configuration serveur." });
    }

    try {
        const result = await pool.query(
            `SELECT id, entreprise_id, nom, email, password, role
             FROM utilisateurs
             WHERE email = $1 AND actif = TRUE
             LIMIT 1`,
            [email]
        );
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Identifiants incorrects." });
        }

        const token = jwt.sign(
            {
                id: user.id,
                entreprise_id: user.entreprise_id,
                nom: user.nom,
                role: user.role,
            },
            process.env.JWT_SECRET,
            { algorithm: "HS256", expiresIn: "24h" }
        );

        res.cookie(COOKIE_NAME, token, sessionCookieOptions());
        return res.json({ user: publicUser(user) });
    } catch (error) {
        console.error("Échec de la connexion", error);
        return res.status(500).json({ error: "Impossible de se connecter." });
    }
});

router.get("/me", verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.entreprise_id, u.nom, u.email, u.role,
                    e.nom AS entreprise_nom, e.logo_url AS entreprise_logo_url,
                    e.report_settings AS entreprise_report_settings
             FROM utilisateurs u
             JOIN entreprises e
               ON e.id = u.entreprise_id
             WHERE u.id = $1 AND u.entreprise_id = $2 AND u.actif = TRUE`,
            [req.user.id, req.user.entreprise_id]
        );
        const user = result.rows[0];

        if (!user) {
            const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions();
            res.clearCookie(COOKIE_NAME, clearOptions);
            return res.status(401).json({ error: "Session utilisateur introuvable." });
        }

        return res.json({
            user: publicUser(user),
            entreprise: companyPayload(user),
        });
    } catch (error) {
        console.error("Échec de la lecture du profil", error);
        return res.status(500).json({ error: "Impossible de charger le profil." });
    }
});

router.put("/company", verifyToken, requireRole(["ADMIN"]), async (req, res) => {
    try {
        const currentResult = await pool.query(
            "SELECT id, nom, logo_url, report_settings FROM entreprises WHERE id = $1",
            [req.user.entreprise_id]
        );
        if (!currentResult.rowCount) return res.status(404).json({ error: "Entreprise introuvable." });

        const current = currentResult.rows[0];
        const source = req.body?.report_settings && typeof req.body.report_settings === "object"
            ? req.body.report_settings
            : req.body || {};
        const previous = current.report_settings || {};
        const accentColor = source.accent_color === undefined
            ? previous.accent_color || "#1d4ed8"
            : limitedText(source.accent_color, 7).toLowerCase();
        if (!/^#[0-9a-f]{6}$/.test(accentColor)) {
            return res.status(400).json({ error: "La couleur d'accent doit être au format #RRGGBB." });
        }
        const headerStyle = source.header_style === undefined
            ? previous.header_style || "minimal"
            : source.header_style;
        if (!REPORT_HEADER_STYLES.has(headerStyle)) {
            return res.status(400).json({ error: "Style d'en-tête invalide." });
        }

        const settings = {
            display_name: source.display_name === undefined ? previous.display_name || "" : limitedText(source.display_name, 150),
            address: source.address === undefined ? previous.address || "" : limitedText(source.address, 300),
            phone: source.phone === undefined ? previous.phone || "" : limitedText(source.phone, 40),
            email: source.email === undefined ? previous.email || "" : limitedText(source.email, 254),
            website: source.website === undefined ? previous.website || "" : limitedText(source.website, 200),
            registration: source.registration === undefined ? previous.registration || "" : limitedText(source.registration, 120),
            footer_text: source.footer_text === undefined ? previous.footer_text || "" : limitedText(source.footer_text, 240),
            accent_color: accentColor,
            header_style: headerStyle,
            show_intervium: source.show_intervium === undefined ? Boolean(previous.show_intervium) : source.show_intervium === true,
        };
        const result = await pool.query(
            `UPDATE entreprises
             SET report_settings = $1::jsonb, updated_at = NOW()
             WHERE id = $2
             RETURNING id, nom, logo_url, report_settings`,
            [JSON.stringify(settings), req.user.entreprise_id]
        );
        return res.json({ entreprise: companyPayload(result.rows[0]) });
    } catch (error) {
        console.error("Échec de la personnalisation de l'entreprise", error);
        return res.status(500).json({ error: "Impossible d'enregistrer la personnalisation du PDF." });
    }
});

router.get("/users", verifyToken, requireRole(["ADMIN"]), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, entreprise_id, nom, email, role, actif, created_at, updated_at
             FROM utilisateurs
             WHERE entreprise_id = $1 AND role = 'TECHNICIEN'
             ORDER BY actif DESC, nom ASC, id ASC`,
            [req.user.entreprise_id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error("Échec de la liste des techniciens", error);
        return res.status(500).json({ error: "Impossible de charger les techniciens." });
    }
});

router.post("/users", verifyToken, requireRole(["ADMIN"]), async (req, res) => {
    const nom = typeof req.body.nom === "string" ? req.body.nom.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!nom || !email || !password) {
        return res.status(400).json({ error: "Nom, email et mot de passe sont requis." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Adresse email invalide." });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 8 caractères." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        const result = await pool.query(
            `INSERT INTO utilisateurs
                (entreprise_id, nom, email, password, role, actif)
             VALUES ($1, $2, $3, $4, 'TECHNICIEN', TRUE)
             RETURNING id, entreprise_id, nom, email, role, actif, created_at, updated_at`,
            [req.user.entreprise_id, nom, email, hashedPassword]
        );
        return res.status(201).json({ user: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "Cette adresse email est déjà utilisée." });
        }
        console.error("Échec de la création du technicien", error);
        return res.status(500).json({ error: "Impossible de créer le technicien." });
    }
});

router.patch("/users/:id/status", verifyToken, requireRole(["ADMIN"]), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof req.body.actif !== "boolean") {
        return res.status(400).json({ error: "Identifiant ou statut invalide." });
    }

    try {
        const result = await pool.query(
            `UPDATE utilisateurs
             SET actif = $1, updated_at = NOW()
             WHERE id = $2 AND entreprise_id = $3 AND role = 'TECHNICIEN'
             RETURNING id, entreprise_id, nom, email, role, actif, created_at, updated_at`,
            [req.body.actif, id, req.user.entreprise_id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Technicien introuvable." });
        }
        return res.json({ user: result.rows[0] });
    } catch (error) {
        console.error("Échec du changement de statut du technicien", error);
        return res.status(500).json({ error: "Impossible de modifier le technicien." });
    }
});

router.delete("/users/:id", verifyToken, requireRole(["ADMIN"]), async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({ error: "Identifiant technicien invalide." });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const technician = await client.query(
            `SELECT id, nom, email
             FROM utilisateurs
             WHERE id = $1 AND entreprise_id = $2 AND role = 'TECHNICIEN'
             FOR UPDATE`,
            [id, req.user.entreprise_id]
        );
        if (technician.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Technicien introuvable." });
        }

        const interventions = await client.query(
            `UPDATE interventions
             SET technicien_id = NULL, updated_at = NOW()
             WHERE technicien_id = $1 AND entreprise_id = $2`,
            [id, req.user.entreprise_id]
        );

        // Ces ressources sont normalement créées par un ADMIN. La réattribution
        // protège néanmoins les anciennes données avant la suppression définitive.
        const templates = await client.query(
            `UPDATE modeles_rapport
             SET createur_id = $1, updated_at = NOW()
             WHERE createur_id = $2 AND entreprise_id = $3`,
            [req.user.id, id, req.user.entreprise_id]
        );
        const documents = await client.query(
            `UPDATE documents_commerciaux
             SET createur_id = $1, updated_at = NOW()
             WHERE createur_id = $2 AND entreprise_id = $3`,
            [req.user.id, id, req.user.entreprise_id]
        );

        const deleted = await client.query(
            `DELETE FROM utilisateurs
             WHERE id = $1 AND entreprise_id = $2 AND role = 'TECHNICIEN'
             RETURNING id, nom, email`,
            [id, req.user.entreprise_id]
        );
        if (deleted.rowCount !== 1) {
            throw new Error("La suppression du technicien n'a pas été confirmée.");
        }

        await client.query("COMMIT");
        return res.json({
            deleted: true,
            user: deleted.rows[0],
            detached_interventions: interventions.rowCount,
            reassigned_templates: templates.rowCount,
            reassigned_documents: documents.rowCount,
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Échec de la suppression définitive du technicien", error);
        return res.status(500).json({
            error: "Impossible de supprimer définitivement le technicien.",
        });
    } finally {
        client.release();
    }
});

router.post("/logout", (_req, res) => {
    const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions();
    res.clearCookie(COOKIE_NAME, clearOptions);
    return res.status(204).send();
});

export default router;
