import test from "node:test";
import assert from "node:assert/strict";
import { generate, generateSecret, verify } from "otplib";
import { decryptSecret, encryptSecret } from "../services/secret-box.js";

test("les secrets TOTP sont chiffrés et les codes valides sont acceptés", async () => {
    process.env.TOTP_ENCRYPTION_KEY = "test-only-key-that-is-long-enough-123456";
    const secret = generateSecret();
    const encrypted = encryptSecret(secret);
    assert.notEqual(encrypted, secret);
    assert.equal(decryptSecret(encrypted), secret);
    const token = await generate({ secret });
    assert.equal((await verify({ secret: decryptSecret(encrypted), token })).valid, true);
});
