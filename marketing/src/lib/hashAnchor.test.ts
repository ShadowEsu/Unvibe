import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { anchorFromHash } from "./hashAnchor";

describe("anchorFromHash", () => {
  it("returns the id a /releases link points at, decoded", () => {
    assert.equal(anchorFromHash("#v0-1-40"), "v0-1-40");
    assert.equal(anchorFromHash("#caf%C3%A9"), "café");
  });

  it("returns null for an empty or malformed hash instead of throwing (Security U136-1)", () => {
    assert.equal(anchorFromHash(""), null);
    assert.equal(anchorFromHash("#"), null);
    assert.equal(anchorFromHash("#%E0"), null);
    assert.equal(anchorFromHash("#%"), null);
  });
});
