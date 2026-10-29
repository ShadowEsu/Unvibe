import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { breadcrumbJsonLd, jsonLdScript } from "./jsonLd";

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

describe("breadcrumbJsonLd", () => {
  it("numbers the crumbs from 1 and gives each an absolute URL", () => {
    const list = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Explain code", path: "/explain" },
      { name: "Python", path: "/explain/python" },
    ]);
    assert.deepEqual(
      list.itemListElement.map(({ position, name, item }) => [position, name, item]),
      [
        [1, "Home", "https://unvibe.site"],
        [2, "Explain code", "https://unvibe.site/explain"],
        [3, "Python", "https://unvibe.site/explain/python"],
      ],
    );
  });
});
