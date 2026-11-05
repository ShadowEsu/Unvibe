import { describe, it } from "node:test";
import assert from "node:assert/strict";
import robots from "../app/robots";

// A crawler that matches a named group ignores the `*` group, so a named group that forgot the private
// paths would open them to exactly the bots it names.
describe("robots.txt", () => {
  const groups = [robots().rules].flat();
  const star = groups.find((group) => group.userAgent === "*");

  it("every group keeps the private paths closed", () => {
    assert.ok(star, "a * group exists");
    for (const group of groups) {
      assert.deepEqual([group.disallow].flat().sort(), [star.disallow].flat().sort(), `group ${String(group.userAgent)}`);
      assert.equal(group.allow, "/");
    }
  });
});
