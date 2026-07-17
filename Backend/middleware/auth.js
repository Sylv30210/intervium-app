import jwt from "jsonwebtoken";
import pool from "../config/database.js";

const COOKIE_NAME = "intervium_sid";
const ALLOWED_ROLES = new Set(["ADMIN", "TECHNICIEN", "CLIENT", "SUPER_DEVELOPPEUR"]);
const CURRENT_TERMS_VERSION = "2026-07-17";

function readCookie(req, name) {
    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) return null;

    for (const cookie of cookieHeader.split(";")) {
        const separatorIndex = cookie.indexOf("=");
        if (separatorIndex === -1) continue;

        const key = cookie.slice(0, separatorIndex).trim();
        if (key !== name) continue;

        try {
            return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
        } catch {
            return null;
        }
    }

    return null;
}

function decodeSession(req) {
    const token = readCookie(req, COOKIE_NAME);

    if (!token) {
        const error = new Error("Session manquante.");
        error.status = 401;
        throw error;
    }

    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET n'est pas configuré.");
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"],
        });
    } catch {
        const error = new Error("Session invalide ou expirée.");
        error.status = 401;
        throw error;
    }

    const id = Number(payload.id);
    const entrepriseId = Number(payload.entreprise_id);
    const impersonatedCompanyId = payload.impersonated_company_id == null
        ? null
        : Number(payload.impersonated_company_id);

    if (
        !Number.isSafeInteger(id) ||
        !Number.isSafeInteger(entrepriseId) ||
        (impersonatedCompanyId !== null && !Number.isSafeInteger(impersonatedCompanyId)) ||
        typeof payload.nom !== "string" ||
        !ALLOWED_ROLES.has(payload.role)
    ) {
        const error = new Error("Contenu de session invalide.");
        error.status = 401;
        throw error;
    }

    return {
        id,
        entreprise_id: entrepriseId,
        impersonated_company_id: impersonatedCompanyId,
        support_expires_at: typeof payload.support_expires_at === "number" ? payload.support_expires_at : null,
        support_write_until: typeof payload.support_write_until === "number" ? payload.support_write_until : null,
        role: payload.role,
        nom: payload.nom,
    };
}

export async function verifyToken(req, res, next) {
    try {
        const sessionUser = decodeSession(req);
        const result = await pool.query(
            `SELECT id, entreprise_id, role, nom, conditions_version
             FROM utilisateurs
             WHERE id = $1 AND actif = TRUE
               AND entreprise_id = $2`,
            [sessionUser.id, sessionUser.entreprise_id]
        );
        const activeUser = result.rows[0];
        if (!activeUser) {
            return res.status(401).json({ error: "Compte désactivé ou session invalide." });
        }

        const now = Math.floor(Date.now() / 1000);
        const supportActive = activeUser.role === "SUPER_DEVELOPPEUR"
            && sessionUser.impersonated_company_id !== null
            && sessionUser.support_expires_at > now;
        req.user = {
            id: Number(activeUser.id),
            entreprise_id: supportActive ? sessionUser.impersonated_company_id : Number(activeUser.entreprise_id),
            home_entreprise_id: Number(activeUser.entreprise_id),
            impersonated_company_id: supportActive ? sessionUser.impersonated_company_id : null,
            support_expires_at: supportActive ? sessionUser.support_expires_at : null,
            support_write: supportActive && sessionUser.support_write_until > now,
            role: activeUser.role,
            nom: activeUser.nom,
            consent_required: activeUser.conditions_version !== CURRENT_TERMS_VERSION,
        };
        if (req.user.consent_required
            && !["/api/auth/me", "/api/auth/consent", "/api/auth/logout", "/api/auth/password"].includes(req.originalUrl.split("?")[0])) {
            return res.status(428).json({ error: "Les conditions d'utilisation doivent être acceptées avant de continuer.", code: "CONSENT_REQUIRED" });
        }
        if (req.user.role === "SUPER_DEVELOPPEUR" && req.method === "DELETE"
            && !["/api/auth/support-session", "/api/google/connection"].includes(req.originalUrl.split("?")[0])) {
            return res.status(403).json({ error: "La suppression définitive est désactivée pour le super-développeur." });
        }
        if (req.user.role === "SUPER_DEVELOPPEUR" && req.user.impersonated_company_id
            && req.method !== "GET"
            && (/^\/api\/auth\/password(?:\/|$)/.test(req.originalUrl)
                || /^\/api\/auth\/users(?:\/|$)/.test(req.originalUrl))) {
            return res.status(403).json({ error: "Les mots de passe, rôles et permissions ne peuvent pas être modifiés pendant une assistance." });
        }
        return next();
    } catch (error) {
        const status = error.status ?? 500;
        const message = status === 500 ? "Erreur de configuration serveur." : error.message;
        res.status(status).json({ error: message });
    }
}

// Permet à /register de distinguer une création publique d'entreprise d'un
// ajout réalisé par un ADMIN déjà connecté.
export function optionalAuth(req, res, next) {
    if (!readCookie(req, COOKIE_NAME)) return next();
    return verifyToken(req, res, next);
}

export function requireRole(rolesArray) {
    if (!Array.isArray(rolesArray) || rolesArray.length === 0) {
        throw new TypeError("requireRole attend un tableau de rôles non vide.");
    }

    const allowedRoles = new Set(rolesArray);

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentification requise." });
        }

        if (req.user.role === "SUPER_DEVELOPPEUR" && req.method === "DELETE") {
            return res.status(403).json({ error: "La suppression définitive est désactivée pour le super-développeur." });
        }
        if (req.user.role === "SUPER_DEVELOPPEUR"
            && req.user.impersonated_company_id
            && (/^\/password(?:\/|$)/.test(req.path) || /^\/users(?:\/|$)/.test(req.path))) {
            return res.status(403).json({ error: "Les mots de passe, rôles et permissions ne peuvent pas être modifiés pendant une assistance." });
        }
        if (req.user.role === "SUPER_DEVELOPPEUR"
            && req.user.impersonated_company_id
            && !["GET", "HEAD", "OPTIONS"].includes(req.method)
            && !req.user.support_write) {
            return res.status(403).json({ error: "Session d'assistance en lecture seule. Une élévation temporaire est requise." });
        }
        if (!allowedRoles.has(req.user.role) && !(req.user.role === "SUPER_DEVELOPPEUR" && allowedRoles.has("ADMIN"))) {
            return res.status(403).json({ error: "Droits insuffisants." });
        }

        return next();
    };
}

export { COOKIE_NAME };
export default verifyToken;
