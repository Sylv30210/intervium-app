import "dotenv/config";
import crypto from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const migrationsDirectory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "migrations"
);
const connectionString =
    process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString && !process.env.DB_HOST) {
    throw new Error(
        "DATABASE_URL, MIGRATION_DATABASE_URL ou les variables DB_* sont requises."
    );
}

const ssl =
    process.env.DB_SSL === undefined
        ? undefined
        : process.env.DB_SSL === "true"
          ? {
                rejectUnauthorized:
                    process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
            }
          : false;

const pool = new Pool({
    ...(connectionString
        ? { connectionString }
        : {
              host: process.env.DB_HOST,
              port: Number.parseInt(process.env.DB_PORT ?? "5432", 10),
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              database: process.env.DB_NAME,
          }),
    max: 1,
    connectionTimeoutMillis: 15_000,
    ...(ssl === undefined ? {} : { ssl }),
});

const client = await pool.connect();

try {
    // Verrou propre à Intervium : une seule instance migre à la fois.
    await client.query("SELECT pg_advisory_lock($1)", [845_031_572]);
    await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const filenames = (await readdir(migrationsDirectory))
        .filter((filename) => /^\d{3}_.+\.sql$/.test(filename))
        .sort((left, right) => left.localeCompare(right));

    const { rows: migrationRows } = await client.query(
        "SELECT filename, checksum FROM schema_migrations"
    );
    const applied = new Map(
        migrationRows.map((row) => [row.filename, row.checksum])
    );

    // Une base locale créée auparavant via schema.sql reçoit 001 comme baseline.
    if (!applied.has("001_initial_schema.sql")) {
        const { rows } = await client.query(
            "SELECT to_regclass('public.entreprises') AS entreprises"
        );
        if (rows[0].entreprises) {
            const sql = await readFile(
                path.join(migrationsDirectory, "001_initial_schema.sql"),
                "utf8"
            );
            const checksum = crypto.createHash("sha256").update(sql).digest("hex");
            await client.query(
                `INSERT INTO schema_migrations (filename, checksum)
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                ["001_initial_schema.sql", checksum]
            );
            applied.set("001_initial_schema.sql", checksum);
            console.log("Migration 001 enregistrée comme baseline existante.");
        }
    }

    for (const filename of filenames) {
        const sql = await readFile(path.join(migrationsDirectory, filename), "utf8");
        const checksum = crypto.createHash("sha256").update(sql).digest("hex");

        if (applied.has(filename)) {
            if (applied.get(filename) !== checksum) {
                console.warn(`Migration déjà appliquée mais modifiée : ${filename}`);
            }
            continue;
        }

        await client.query("BEGIN");
        try {
            await client.query(sql);
            await client.query(
                "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
                [filename, checksum]
            );
            await client.query("COMMIT");
            console.log(`Migration appliquée : ${filename}`);
        } catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
    }

    console.log("Base de données à jour.");
} finally {
    await client.query("SELECT pg_advisory_unlock($1)", [845_031_572]).catch(() => {});
    client.release();
    await pool.end();
}
