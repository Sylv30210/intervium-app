import express from "express";
import pool from "../config/database.js";
import { verifyToken } from "../middleware/auth.js";
import { publicSmtpProviders } from "../config/smtp-providers.js";
import { emailEncryptionStatus } from "../services/email-crypto.js";
import { listConnections, ownedConnection, publicConnection, saveSmtpConnection, testSmtpConnection } from "../services/email-connections.js";
import { connectMicrosoftAccount, microsoftAuthorizationUrl, microsoftConfigurationStatus, microsoftAccessToken, revokeMicrosoft, verifyMicrosoftState } from "../services/microsoft.js";
import { accessTokenFor, disconnectGoogle, googleAuthorizationUrl, googleConfigurationStatus, googleConnection } from "../services/google.js";

const router = express.Router();
function appUrl() { return String(process.env.APP_URL || "http://localhost:5000").replace(/\/$/, ""); }
function errorStatus(error) {
    if (["SMTP_CONFIGURATION_INVALID","SMTP_CREDENTIALS_REQUIRED","SMTP_HOST_INVALID","SMTP_PLAINTEXT_FORBIDDEN"].includes(error.message)) return 400;
    if (error.message === "SMTP_HOST_PRIVATE") return 403;
    return 500;
}

router.get("/", verifyToken, async (req, res) => {
    try {
        const connections = await listConnections(req.user);
        const legacyGoogle = await googleConnection(req.user);
        if (legacyGoogle && !connections.some((item) => item.provider === "google")) connections.unshift({ provider: "google", email: legacyGoogle.email_google, connection_type: "OAUTH", status: "ACTIVE", last_test_at: null, created_at: legacyGoogle.connected_at, updated_at: legacyGoogle.updated_at });
        return res.json({ connections, providers: publicSmtpProviders(), configuration: { google: googleConfigurationStatus(), microsoft: microsoftConfigurationStatus(), encryption: emailEncryptionStatus() } });
    } catch { return res.status(500).json({ error: "Impossible de charger les comptes e-mail." }); }
});

router.get("/google/authorize", verifyToken, (req,res) => { try { res.json({ url: googleAuthorizationUrl(req.user) }); } catch { res.status(503).json({ error: "La connexion Google n’est pas configurée." }); } });
router.get("/microsoft/authorize", verifyToken, (req,res) => { try { res.json({ url: microsoftAuthorizationUrl(req.user) }); } catch { res.status(503).json({ error: "La connexion Microsoft n’est pas configurée." }); } });
router.get("/microsoft/callback", async (req,res) => {
    if (req.query.error) return res.redirect(`${appUrl()}/?email=microsoft-denied`);
    try { const state=verifyMicrosoftState(String(req.query.state||"")); await connectMicrosoftAccount({ code:String(req.query.code||""),userId:Number(state.userId),entrepriseId:Number(state.entrepriseId) }); return res.redirect(`${appUrl()}/?email=microsoft-connected`); }
    catch (error) { console.error("Échec callback Microsoft", { code: String(error?.message||"").slice(0,80) }); return res.redirect(`${appUrl()}/?email=microsoft-error`); }
});

router.post("/smtp", verifyToken, async (req,res) => { try { const connection=await saveSmtpConnection(req.user,req.body); return res.status(201).json({ connection }); } catch(error) { return res.status(errorStatus(error)).json({ error: error.message === "SMTP_PLAINTEXT_FORBIDDEN" ? "Une connexion chiffrée TLS ou STARTTLS est obligatoire en production." : "Configuration SMTP invalide ou serveur non autorisé." }); } });
router.put("/:id", verifyToken, async (req,res) => { try { const connection=await saveSmtpConnection(req.user,req.body,Number(req.params.id)); if(!connection)return res.status(404).json({error:"Connexion introuvable."}); return res.json({connection}); } catch(error) { return res.status(errorStatus(error)).json({error:"Configuration SMTP invalide ou serveur non autorisé."}); } });
router.post("/:id/test", verifyToken, async (req,res) => {
    let connection;
    try {
        connection=await ownedConnection(req.user,Number(req.params.id)); if(!connection)return res.status(404).json({error:"Connexion introuvable."});
        if(connection.type_connexion === "SMTP") { const result=await testSmtpConnection(req.user,connection.id); return result.ok?res.json(result):res.status(422).json({error:result.message,code:result.code}); }
        if(connection.fournisseur === "microsoft") await microsoftAccessToken(connection); else if(connection.fournisseur === "google") await accessTokenFor(req.user);
        await pool.query("UPDATE connexions_email SET statut='ACTIVE', dernier_test_reussi_at=NOW(), derniere_erreur=NULL, updated_at=NOW() WHERE id=$1 AND utilisateur_id=$2 AND entreprise_id=$3", [connection.id,req.user.id,req.user.entreprise_id]);
        return res.json({ok:true});
    } catch { if(connection) await pool.query("UPDATE connexions_email SET statut='ERROR', derniere_erreur=$1, updated_at=NOW() WHERE id=$2", ["Jeton expiré et impossible à renouveler.",connection.id]).catch(()=>{}); return res.status(422).json({error:"Jeton expiré et impossible à renouveler.",code:"TOKEN_REFRESH_FAILED"}); }
});
router.delete("/:id", verifyToken, async (req,res) => { try { const connection=await ownedConnection(req.user,Number(req.params.id)); if(!connection)return res.status(404).json({error:"Connexion introuvable."}); if(connection.fournisseur==="microsoft")await revokeMicrosoft(connection); else if(connection.fournisseur==="google")await disconnectGoogle(req.user); else await pool.query("DELETE FROM connexions_email WHERE id=$1 AND utilisateur_id=$2 AND entreprise_id=$3",[connection.id,req.user.id,req.user.entreprise_id]); return res.status(204).send(); } catch { return res.status(500).json({error:"Impossible de supprimer la connexion e-mail."}); } });

export default router;
