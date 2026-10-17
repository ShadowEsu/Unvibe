import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectVisitorDevice } from "./shortcuts";

describe("detectVisitorDevice", () => {
  it("sends phones and tablets to the send-to-computer path", () => {
    assert.equal(detectVisitorDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148"), "phone");
    assert.equal(detectVisitorDevice("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari/537.36"), "phone");
    // iPadOS reports a Mac user agent; only touch support tells them apart.
    assert.equal(detectVisitorDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", 5), "phone");
  });

  it("keeps desktop download buttons on Mac and Windows", () => {
    assert.equal(detectVisitorDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0", 0), "mac");
    assert.equal(detectVisitorDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0", 0), "windows");
  });
});
