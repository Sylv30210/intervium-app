import { createCipheriv, randomBytes } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { BACKUP_MAGIC, IV_LENGTH, backupFingerprint, backupKey, safeDatabaseUrl } from "./backup-utils.js";

const outputDirectory = path.resolve(process.env.BACKUP_OUTPUT_DIR || "backups");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputPath = path.join(outputDirectory, `intervium-${timestamp}.dump.enc`);
const key = backupKey();
const iv = randomBytes(IV_LENGTH);
const cipher = createCipheriv("aes-256-gcm", key, iv);
await mkdir(outputDirectory, { recursive: true });
const dump = spawn(process.env.PG_DUMP_BIN || "pg_dump", ["--format=custom", "--no-owner", "--no-acl"], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, PGDATABASE: safeDatabaseUrl() },
});
let stderr = "";
dump.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-4000); });
const output = createWriteStream(outputPath, { flags: "wx", mode: 0o600 });
output.write(BACKUP_MAGIC);
output.write(iv);
dump.stdout.pipe(cipher).pipe(output, { end: false });
cipher.on("end", () => output.end(cipher.getAuthTag()));
const [exitCode] = await Promise.all([
    new Promise((resolve, reject) => { dump.once("error", reject); dump.once("close", resolve); }),
    new Promise((resolve, reject) => { output.once("finish", resolve); output.once("error", reject); }),
]);
if (exitCode !== 0) {
    await rm(outputPath, { force: true });
    throw new Error(`pg_dump a échoué (code ${exitCode}). ${stderr.trim()}`);
}
console.log(`Sauvegarde chiffrée créée : ${outputPath}`);
console.log(`Empreinte de clé : ${backupFingerprint(key)} (ne révèle pas la clé)`);
