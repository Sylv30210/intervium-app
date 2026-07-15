import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

const requiredVariables = connectionString
    ? []
    : ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
    throw new Error(
        `Configuration PostgreSQL incomplète : ${missingVariables.join(", ")}`
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
    max: Number.parseInt(process.env.DB_POOL_MAX ?? "10", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ...(ssl === undefined ? {} : { ssl }),
});

pool.on("error", (error) => {
    console.error("Erreur inattendue du pool PostgreSQL", error);
});

export default pool;
