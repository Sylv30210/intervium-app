import test from "node:test";
import assert from "node:assert/strict";
import { landscapeRotation } from "../services/storage.js";

test("une photo verticale est automatiquement tournée en paysage", () => {
    assert.equal(landscapeRotation(900, 1200), 90);
    assert.equal(landscapeRotation(1200, 900), 0);
    assert.equal(landscapeRotation(1000, 1000), 0);
});
