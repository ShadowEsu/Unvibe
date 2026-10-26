import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jsonLdScript } from "./jsonLd";

describe("JSON-LD script bodies", () => {
  const value = {
    "@type": "Question",
    name: "</script><script>alert(1)</script>",
    acceptedAnswer: { text: "a < b and <!-- c -->" },
  };

  it("contain no < at all, so a value can't close the script tag", () => {
    assert.equal(jsonLdScript(value).includes("<"), false);
  });

  it("parse back to the same object", () => {
    assert.deepEqual(JSON.parse(jsonLdScript(value)), value);
  });
});
