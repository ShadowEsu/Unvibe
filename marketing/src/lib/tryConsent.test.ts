import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TRY_CONSENT_VERSION, storedTryConsent } from "./tryConsent";

const record = (value: unknown) => JSON.stringify(value);

describe("Try it boxes come back ticked only from this version's own answer (Security P1)", () => {
  it("restores each box the visitor ticked at the current version", () => {
    assert.deepEqual(storedTryConsent(record({ v: TRY_CONSENT_VERSION, aiSend: true, age18: true, at: "x" })), { aiSend: true, age18: true });
    assert.deepEqual(storedTryConsent(record({ v: TRY_CONSENT_VERSION, aiSend: true, age18: false })), { aiSend: true, age18: false });
  });

  it("starts unticked for another version, a non-true flag, nothing stored or a broken entry", () => {
    const unticked = { aiSend: false, age18: false };
    for (const raw of [
      record({ v: "2026-01-01", aiSend: true, age18: true }),
      record({ aiSend: true, age18: true }),
      record({ v: TRY_CONSENT_VERSION, aiSend: "true", age18: 1 }),
      record(null),
      record([TRY_CONSENT_VERSION]),
      "{not json",
      null,
    ]) {
      assert.deepEqual(storedTryConsent(raw), unticked, String(raw));
    }
  });
});
