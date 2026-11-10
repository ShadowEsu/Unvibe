import assert from "node:assert/strict";
import { describe, it } from "node:test";
import nextConfig from "../../next.config.mjs";

describe("guessed help URLs", () => {
  it("send /support and /contact to the help hub, permanently (308)", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    for (const source of ["/support", "/contact"]) {
      const matches = redirects.filter((redirect) => redirect.source === source);
      assert.equal(matches.length, 1, `${source} has exactly one redirect`);
      assert.equal(matches[0]!.destination, "/help");
      assert.equal("permanent" in matches[0]! && matches[0]!.permanent, true, `${source} is a 308`);
    }
  });
});
