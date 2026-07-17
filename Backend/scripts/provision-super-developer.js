import "dotenv/config";
import bcrypt from "bcryptjs";
import pool from "../config/database.js";
import { generateSecret, generateURI } from "otplib";
import { encryptSecret } from "../services/secret-box.js";

const email = String(process.env.SUPER_DEVELOPER_EMAIL || "").trim().toLowerCase();
const password = String(process.env.SUPER_DEVELOPER_PASSWORD || "");
const name = String(process.env.SUPER_DEVELOPER_NAME || "Super développeur").trim();

function strongEnough(value) {
    return value.length >= 20
        && /[a-z]/.test(value)
        && /[A-Z]/.test(value)
        && /\d/.test(value)
        && /[^A-Za-z0-9]/.test(value);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("SUPER_DEVELOPER_EMAIL doit contenir une adresse valide.");
}
if (!strongEnough(password)) {
    throw new Error("SUPER_DEVELOPER_PASSWORD doit contenir au moins 20 caractères, avec majuscule, minuscule, chiffre et symbole.");
}

try {
    const company = await pool.query("SELECT id FROM entreprises ORDER BY id ASC LIMIT 1");
    if (!company.rowCount) throw new Error("Aucune entreprise n'existe encore.");
    const hash = await bcrypt.hash(password, 12);
    const totpSecret = generateSecret({ length: 20 });
    const encryptedTotpSecret = encryptSecret(totpSecret);
    await pool.query(
        `INSERT INTO utilisateurs (entreprise_id, nom, email, password, role, actif, doit_changer_mot_de_passe, totp_secret_chiffre, totp_active)
         VALUES ($1, $2, $3, $4, 'SUPER_DEVELOPPEUR', TRUE, TRUE, $5, TRUE)
         ON CONFLICT (email) DO UPDATE
         SET nom = EXCLUDED.nom, password = EXCLUDED.password,
             role = 'SUPER_DEVELOPPEUR', actif = TRUE,
             doit_changer_mot_de_passe = TRUE, totp_secret_chiffre=EXCLUDED.totp_secret_chiffre,
             totp_active=TRUE, updated_at = NOW()`,
        [company.rows[0].id, name, email, hash, encryptedTotpSecret]
    );
    console.log("Compte super-développeur provisionné. Supprimez maintenant les variables temporaires.");
    console.log("URI TOTP à scanner une seule fois :", generateURI({ issuer: "Intervium", label: email, secret: totpSecret }));
} finally {
    await pool.end();
}
