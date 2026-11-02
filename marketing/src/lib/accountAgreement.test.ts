import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ACCOUNT_POLICY_VERSION,
  ACTIVATE_AGREEMENT_KEY,
  agreementPayload,
  REDEEM_AGREEMENT_KEY,
  saveAgreement,
  storedAgreement,
} from "./accountAgreement";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe("the account agreement's policy version", () => {
  it("is the API's ACCOUNT_POLICY_VERSION (web/src/lib/accountConsent.ts)", () => {
    const source = readFileSync(path.resolve("../web/src/lib/accountConsent.ts"), "utf8");
    const api = /export const ACCOUNT_POLICY_VERSION = '([^']+)';/.exec(source)?.[1];
    assert.ok(api, "the API still exports ACCOUNT_POLICY_VERSION as a string literal");
    assert.equal(ACCOUNT_POLICY_VERSION, api);
  });
});

describe("both boxes ticked", () => {
  it("gives the agreement the API checks only when both are ticked", () => {
    assert.deepEqual(agreementPayload({ terms: true, age18: true }), { terms: true, age18: true, policyVersion: ACCOUNT_POLICY_VERSION });
    assert.equal(agreementPayload({ terms: true, age18: false }), null);
    assert.equal(agreementPayload({ terms: false, age18: true }), null);
    assert.equal(agreementPayload({ terms: false, age18: false }), null);
  });

  it("never reads a truthy value that isn't true as a tick", () => {
    for (const fake of ["true", 1, "on"]) {
      assert.equal(agreementPayload({ terms: fake, age18: true } as unknown as { terms: boolean; age18: boolean }), null);
      assert.equal(agreementPayload({ terms: true, age18: fake } as unknown as { terms: boolean; age18: boolean }), null);
    }
  });
});

for (const [page, key] of [["/activate", ACTIVATE_AGREEMENT_KEY], ["/redeem", REDEEM_AGREEMENT_KEY]] as const) {
  describe(`the ${page} agreement across the sign-in round trip`, () => {
    it("starts unticked and comes back as the person left it", () => {
      const storage = memoryStorage();
      assert.deepEqual(storedAgreement(key, storage), { terms: false, age18: false });
      saveAgreement(key, { terms: true, age18: false }, storage);
      assert.deepEqual(storedAgreement(key, storage), { terms: true, age18: false });
      saveAgreement(key, { terms: true, age18: true }, storage);
      assert.deepEqual(storedAgreement(key, storage), { terms: true, age18: true });
      saveAgreement(key, { terms: false, age18: false }, storage);
      assert.deepEqual(storedAgreement(key, storage), { terms: false, age18: false });
      assert.equal(storage.items.size, 0, "both unticked forgets them");
    });

    it("asks again for an older policy version, a non-true value or a broken entry", () => {
      const storage = memoryStorage();
      storage.setItem(key, JSON.stringify({ v: "2026-01-01", terms: true, age18: true }));
      assert.deepEqual(storedAgreement(key, storage), { terms: false, age18: false });
      storage.setItem(key, JSON.stringify({ v: ACCOUNT_POLICY_VERSION, terms: "true", age18: 1 }));
      assert.deepEqual(storedAgreement(key, storage), { terms: false, age18: false });
      storage.setItem(key, "{not json");
      assert.deepEqual(storedAgreement(key, storage), { terms: false, age18: false });
      assert.deepEqual(storedAgreement(key, null), { terms: false, age18: false });
    });
  });
}

describe("each page keeps its own ticks", () => {
  it("boxes ticked on /activate never come back ticked on /redeem, or the other way round", () => {
    const storage = memoryStorage();
    saveAgreement(ACTIVATE_AGREEMENT_KEY, { terms: true, age18: true }, storage);
    assert.deepEqual(storedAgreement(REDEEM_AGREEMENT_KEY, storage), { terms: false, age18: false });
    saveAgreement(ACTIVATE_AGREEMENT_KEY, { terms: false, age18: false }, storage);
    saveAgreement(REDEEM_AGREEMENT_KEY, { terms: true, age18: true }, storage);
    assert.deepEqual(storedAgreement(ACTIVATE_AGREEMENT_KEY, storage), { terms: false, age18: false });
  });

  it("works with storage blocked", () => {
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    assert.doesNotThrow(() => saveAgreement(REDEEM_AGREEMENT_KEY, { terms: true, age18: true }, blocked));
    assert.deepEqual(storedAgreement(REDEEM_AGREEMENT_KEY, blocked), { terms: false, age18: false });
  });
});
