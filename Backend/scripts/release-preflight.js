import { readFile } from "node:fs/promises";

const [rootPackage, backendPackage, migration, server, render] = await Promise.all([
    readFile("package.json", "utf8").then(JSON.parse),
    readFile("Backend/package.json", "utf8").then(JSON.parse),
    readFile("Backend/database/migrations/015_super_developer.sql", "utf8"),
    readFile("Backend/server.js", "utf8"),
    readFile("render.yaml", "utf8"),
]);

const checks = [
    [rootPackage.version === backendPackage.version, "versions racine/backend identiques"],
    [!/@|\$2[aby]\$|INSERT INTO utilisateurs/i.test(migration), "aucun compte ou hash dans la migration 015"],
    [!server.includes("unsafe-inline"), "CSP sans unsafe-inline"],
    [/name: intervium[\s\S]*?autoDeployTrigger: off/.test(render), "déploiement production manuel"],
    [render.includes("name: intervium-staging") && render.includes("autoDeployTrigger: checksPass"), "staging après contrôles réussis"],
];

const requiredSecrets = ["DATABASE_URL", "JWT_SECRET", "TOTP_ENCRYPTION_KEY"];
if (process.env.RELEASE_ENV_CHECK === "true") {
    for (const name of requiredSecrets) checks.push([Boolean(process.env[name]), `secret ${name} configuré`]);
}

let failed = false;
for (const [valid, label] of checks) {
    console.log(`${valid ? "OK" : "ÉCHEC"} — ${label}`);
    if (!valid) failed = true;
}
if (failed) process.exitCode = 1;
