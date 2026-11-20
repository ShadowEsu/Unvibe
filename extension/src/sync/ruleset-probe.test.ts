import assert from "node:assert/strict";
import { it } from "node:test";

// Throwaway: proves a red check blocks merging into main. This PR is closed unmerged.
it("ruleset probe fails on purpose", () => {
  assert.equal(1, 2);
});
