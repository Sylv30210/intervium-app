import "dotenv/config";
import bcrypt from "bcryptjs";
import { verify as verifyTotp } from "otplib";
import pool from "../config/database.js";
import { decryptSecret } from "../services/secret-box.js";

const email = String(process.env.SUPER_DEVELOPER_EMAIL || "").trim().toLowerCase();
const password = String(process.env.SUPER_DEVELOPER_PASSWORD || "");
const totpCode = String(process.env.SUPER_DEVELOPER_TOTP_CODE || "").replace(/\s/g, "");

if (!email || !password || !/^\d{6}$/.test(totpCode)) {
    throw new Error("Définissez SUPER_DEVELOPER_EMAIL, SUPER_DEVELOPER_PASSWORD et un code TOTP à 6 chiffres.");
}

try {
    const result = await pool.query(
        `SELECT password, actif, role, totp_active, totp_secret_chiffre
         FROM utilisateurs WHERE email = $1 LIMIT 1`,
        [email]
    );
    const user = result.rows[0];
    if (!user) throw new Error("Compte introuvable.");

    console.log("Compte trouvé :", user.actif && user.role === "SUPER_DEVELOPPEUR" ? "OK" : "INVALIDE");
    console.log("Mot de passe :", await bcrypt.compare(password, user.password) ? "OK" : "INVALIDE");
    console.log("MFA enregistrée :", user.totp_active && user.totp_secret_chiffre ? "OK" : "INVALIDE");

    let secret;
    try {
        secret = decryptSecret(user.totp_secret_chiffre);
        console.log("Déchiffrement MFA : OK");
    } catch {
        console.log("Déchiffrement MFA : ÉCHEC (clé TOTP différente de celle du provisionnement)");
        process.exitCode = 2;
    }

    if (secret) {
        const verification = await verifyTotp({ secret, token: totpCode, epochTolerance: 30 });
        console.log("Code MFA actuel :", verification.valid ? "OK" : "INVALIDE");
        if (!verification.valid) process.exitCode = 3;
    }
} finally {
    await pool.end();
}
