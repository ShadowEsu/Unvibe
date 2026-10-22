import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearDeviceCode, pendingDeviceCode, saveDeviceCode } from "./deviceApproval";

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
