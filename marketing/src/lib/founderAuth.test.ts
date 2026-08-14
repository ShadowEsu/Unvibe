import assert from "node:assert/strict";
import test from "node:test";
import { verifyFounderRequest } from "./founderAuth";

function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return run().finally(() => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

test("founder control accepts a dedicated passcode without OAuth", async () => {
  await withEnv({ FOUNDER_CONTROL_TOKEN: "founder-passcode", WAITLIST_ADMIN_TOKEN: undefined }, async () => {
    const allowed = await verifyFounderRequest(new Request("https://unvibe.site/api/build-status", {
      headers: { "x-founder-control": "founder-passcode" },
    }));
    const rejected = await verifyFounderRequest(new Request("https://unvibe.site/api/build-status", {
      headers: { "x-founder-control": "wrong-passcode" },
    }));
    assert.equal(allowed, true);
    assert.equal(rejected, false);
  });
});

test("founder control securely falls back to the existing waitlist admin token", async () => {
  await withEnv({ FOUNDER_CONTROL_TOKEN: undefined, WAITLIST_ADMIN_TOKEN: "waitlist-passcode" }, async () => {
    const allowed = await verifyFounderRequest(new Request("https://unvibe.site/api/build-status", {
      headers: { authorization: "Bearer waitlist-passcode" },
    }));
    assert.equal(allowed, true);
  });
});
