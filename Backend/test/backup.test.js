import test from "node:test";
import assert from "node:assert/strict";
import { backupFingerprint, backupKey } from "../scripts/backup-utils.js";

test("la clé de sauvegarde exige exactement 32 octets", () => {
    const previous = process.env.BACKUP_ENCRYPTION_KEY;
    try {
        process.env.BACKUP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
        const key = backupKey();
        assert.equal(key.length, 32);
        assert.match(backupFingerprint(key), /^[a-f0-9]{12}$/);
        process.env.BACKUP_ENCRYPTION_KEY = "trop-courte";
        assert.throws(() => backupKey(), /32 octets/);
    } finally {
        if (previous === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
        else process.env.BACKUP_ENCRYPTION_KEY = previous;
    }
});
