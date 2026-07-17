import express from "express";
import pool from "../config/database.js";
import { STORAGE_DRIVER } from "../config/cloud.js";
import { requireRole, verifyToken } from "../middleware/auth.js";

const router = express.Router();
router.use(verifyToken, requireRole(["ADMIN"]));

router.get("/status", async (_req, res) => {
    const [database, counts] = await Promise.all([
        pool.query("SELECT pg_database_size(current_database())::bigint AS bytes"),
        pool.query(`SELECT
            (SELECT COUNT(*) FROM entreprises)::INTEGER AS companies,
            (SELECT COUNT(*) FROM utilisateurs WHERE actif=TRUE)::INTEGER AS active_users,
            (SELECT COUNT(*) FROM interventions)::INTEGER AS reports`),
    ]);
    let cloudinary = null;
    if (STORAGE_DRIVER === "cloudinary" && process.env.CLOUDINARY_URL) {
        try {
            const { v2 } = await import("cloudinary");
            const usage = await v2.api.usage();
            cloudinary = { credits_used: usage.credits?.usage ?? null, credits_limit: usage.credits?.limit ?? null };
        } catch {
            cloudinary = { unavailable: true };
        }
    }
    return res.json({
        database_bytes: Number(database.rows[0].bytes),
        ...counts.rows[0], storage_driver: STORAGE_DRIVER, cloudinary,
        uptime_seconds: Math.round(process.uptime()), version: process.env.npm_package_version || "2.2.0",
    });
});

export default router;
