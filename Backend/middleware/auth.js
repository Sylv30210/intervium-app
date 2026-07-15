import jwt from "jsonwebtoken";
import pool from "../config/database.js";

const COOKIE_NAME = "intervium_sid";
const ALLOWED_ROLES = new Set(["ADMIN", "TECHNICIEN", "CLIENT"]);

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

    if (
        !Number.isSafeInteger(id) ||
        !Number.isSafeInteger(entrepriseId) ||
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
        role: payload.role,
        nom: payload.nom,
    };
}

export async function verifyToken(req, res, next) {
    try {
        const sessionUser = decodeSession(req);
        const result = await pool.query(
            `SELECT id, entreprise_id, role, nom
             FROM utilisateurs
             WHERE id = $1 AND entreprise_id = $2 AND actif = TRUE`,
            [sessionUser.id, sessionUser.entreprise_id]
        );
        const activeUser = result.rows[0];
        if (!activeUser) {
            return res.status(401).json({ error: "Compte désactivé ou session invalide." });
        }

        req.user = {
            id: Number(activeUser.id),
            entreprise_id: Number(activeUser.entreprise_id),
            role: activeUser.role,
            nom: activeUser.nom,
        };
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

        if (!allowedRoles.has(req.user.role)) {
            return res.status(403).json({ error: "Droits insuffisants." });
        }

        return next();
    };
}

export { COOKIE_NAME };
export default verifyToken;
