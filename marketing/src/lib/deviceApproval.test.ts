import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACCOUNT_POLICY_VERSION,
  clearDeviceCode,
  opensForSignIn,
  pendingDeviceCode,
  saveAgreement,
  saveDeviceCode,
  storedAgreement,
} from "./deviceApproval";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe("device code on /activate", () => {
  it("marks a code that arrived in a link and takes it out of the address bar", () => {
    const storage = memoryStorage();
    const pending = pendingDeviceCode("?user_code=abcd1234&utm_source=app", storage);
    assert.deepEqual(pending, { code: "ABCD1234", fromLink: true, cleanSearch: "?utm_source=app" });
    assert.deepEqual(pendingDeviceCode("?device=wxyz9876", memoryStorage()), { code: "WXYZ9876", fromLink: true, cleanSearch: "" });
  });

  it("still treats it as a link code after the Google sign-in redirect", () => {
    const storage = memoryStorage();
    const first = pendingDeviceCode("?device_code=ABCD1234", storage);
    saveDeviceCode(first.code, first.fromLink, storage);
    // Supabase sends the person back to /activate?code=<oauth code>, without the device code.
    assert.deepEqual(pendingDeviceCode("?code=oauth-exchange-code-1234567890", storage), { code: "ABCD1234", fromLink: true, cleanSearch: null });
  });

  it("does not warn about a code the person typed themselves", () => {
    const storage = memoryStorage();
    assert.deepEqual(pendingDeviceCode("", storage), { code: "", fromLink: false, cleanSearch: null });
    saveDeviceCode(" abcd1234 ", false, storage);
    assert.deepEqual(pendingDeviceCode("", storage), { code: "ABCD1234", fromLink: false, cleanSearch: null });
  });

  it("forgets the code and its origin once approved", () => {
    const storage = memoryStorage();
    pendingDeviceCode("?user_code=ABCD1234", storage);
    clearDeviceCode(storage);
    assert.deepEqual(pendingDeviceCode("", storage), { code: "", fromLink: false, cleanSearch: null });
  });

  it("works with storage blocked", () => {
    const blocked = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    assert.deepEqual(pendingDeviceCode("?user_code=ABCD1234", blocked), { code: "ABCD1234", fromLink: true, cleanSearch: "" });
    assert.deepEqual(pendingDeviceCode("", blocked), { code: "", fromLink: false, cleanSearch: null });
  });
});

describe("what /activate opens with", () => {
  it("shows the sign-in steps when the app sent a device code", () => {
    assert.equal(opensForSignIn({ user_code: "ABCD1234" }), true);
    assert.equal(opensForSignIn({ device: "ABCD1234", utm_source: "app" }), true);
    assert.equal(opensForSignIn({ device_code: ["ABCD1234"] }), true);
  });

  it("shows the sign-in steps on the way back from Google or the email link", () => {
    assert.equal(opensForSignIn({ code: "oauth-exchange-code-1234567890" }), true);
    assert.equal(opensForSignIn({ error: "access_denied", error_description: "denied" }), true);
  });

  it("shows the download first to a visitor without a code", () => {
    assert.equal(opensForSignIn({}), false);
    assert.equal(opensForSignIn({ utm_source: "x", notrack: "1" }), false);
    assert.equal(opensForSignIn({ user_code: "  ", code: "" }), false);
    assert.equal(opensForSignIn({ user_code: [] }), false);
  });
});

describe("the /activate agreement across the sign-in round trip", () => {
  it("starts unticked and comes back as the person left it", () => {
    const storage = memoryStorage();
    assert.deepEqual(storedAgreement(storage), { terms: false, age18: false });
    saveAgreement({ terms: true, age18: true }, storage);
    assert.deepEqual(storedAgreement(storage), { terms: true, age18: true });
    saveAgreement({ terms: false, age18: false }, storage);
    assert.deepEqual(storedAgreement(storage), { terms: false, age18: false });
  });

  it("asks again for an older policy version, a non-true value or a broken entry", () => {
    const storage = memoryStorage();
    storage.setItem("unvibe_activate_agreement", JSON.stringify({ v: "2026-01-01", terms: true, age18: true }));
    assert.deepEqual(storedAgreement(storage), { terms: false, age18: false });
    storage.setItem("unvibe_activate_agreement", JSON.stringify({ v: ACCOUNT_POLICY_VERSION, terms: "true", age18: 1 }));
    assert.deepEqual(storedAgreement(storage), { terms: false, age18: false });
    storage.setItem("unvibe_activate_agreement", "{not json");
    assert.deepEqual(storedAgreement(storage), { terms: false, age18: false });
    assert.deepEqual(storedAgreement(null), { terms: false, age18: false });
  });
});
