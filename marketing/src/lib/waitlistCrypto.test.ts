import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptWaitlistJson, encryptWaitlistJson } from "./waitlistCrypto";

describe("waitlist storage encryption", () => {
  it("round-trips private signup data without exposing it in ciphertext", () => {
    const entries = [{ firstName: "Ada", email: "ada@example.com" }];
    const encrypted = encryptWaitlistJson(entries, "founder-secret");

    assert.equal(encrypted.includes("ada@example.com"), false);
    assert.deepEqual(decryptWaitlistJson(encrypted, "founder-secret"), entries);
  });

  it("rejects decryption with the wrong secret", () => {
    const encrypted = encryptWaitlistJson([{ email: "ada@example.com" }], "right-secret");
    assert.throws(() => decryptWaitlistJson(encrypted, "wrong-secret"));
  });
});
