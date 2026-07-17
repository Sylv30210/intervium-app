import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const roots = [path.resolve("Backend"), path.resolve("Frontend")];
const ignored = new Set(["node_modules"]);
const files = [];

function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (ignored.has(entry.name)) continue;
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(target);
        else if (entry.isFile() && entry.name.endsWith(".js")) files.push(target);
    }
}

roots.forEach(visit);
for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`${files.length} fichiers JavaScript vérifiés.`);
