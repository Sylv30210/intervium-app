import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { connectGoogleAccount, disconnectGoogle, googleAuthorizationUrl, googleConfigurationStatus, googleConnection, verifyGoogleState } from "../services/google.js";

const router = express.Router();

router.get("/status", verifyToken, async (req, res) => {
    try {
        const configuration = googleConfigurationStatus();
        return res.json({ enabled: configuration.enabled, connection: await googleConnection(req.user), configuration });
    } catch (error) {
        console.error("Échec du statut Google", error);
        return res.status(500).json({ error: "Impossible de vérifier la connexion Google." });
    }
});

router.get("/authorize", verifyToken, (req, res) => {
    try {
        return res.json({ url: googleAuthorizationUrl(req.user) });
    } catch {
        return res.status(503).json({ error: "La connexion Google n’est pas configurée." });
    }
});

router.get("/callback", async (req, res) => {
    const appUrl = process.env.APP_URL || new URL(process.env.GOOGLE_REDIRECT_URI || "http://localhost").origin;
    try {
        if (req.query.error) return res.redirect(`${appUrl}/?google=denied`);
        const payload = verifyGoogleState(String(req.query.state || ""));
        await connectGoogleAccount({ code: String(req.query.code || ""), userId: Number(payload.userId), entrepriseId: Number(payload.entrepriseId) });
        return res.redirect(`${appUrl}/?google=connected`);
    } catch (error) {
        console.error("Échec du callback Google", { message: error.message });
        return res.redirect(`${appUrl}/?google=error`);
    }
});

router.delete("/connection", verifyToken, async (req, res) => {
    try {
        await disconnectGoogle(req.user);
        return res.status(204).send();
    } catch (error) {
        console.error("Échec de la déconnexion Google", error);
        return res.status(500).json({ error: "Impossible de déconnecter Google." });
    }
});

export default router;
