import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LicensesPage from "@/app/licenses/page";
import { THIRD_PARTY_NOTICES } from "./thirdPartyNotices";

Object.assign(globalThis, { React });

const require = createRequire(import.meta.url);
const sitePackage = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as { dependencies: Record<string, string> };

describe("open-source notices (/licenses)", () => {
  it("match the pinned version and the licence file each installed package ships", () => {
    for (const notice of THIRD_PARTY_NOTICES) {
      let root: string;
      if (notice.vendored) {
        root = path.resolve("src/vendor", notice.vendored);
        const vendor = readFileSync(path.join(root, "VENDOR.md"), "utf8");
        assert.ok(vendor.includes(`${notice.url} at commit ${notice.version}`), `${notice.name}: VENDOR.md records a different source or commit`);
      } else {
        assert.equal(sitePackage.dependencies[notice.name], notice.version, `${notice.name}: bump the notice with the pin`);
        root = path.dirname(require.resolve(`${notice.name}/package.json`));
      }
      assert.equal(notice.license, readFileSync(path.join(root, "LICENSE"), "utf8").trim(), `${notice.name}: licence text changed`);
    }
  });

  it("the page shows every word of each licence, in order, and no policy-summary note", () => {
    const words = (value: string) => value.replace(/\s+/g, " ").trim();
    const text = words(renderToStaticMarkup(createElement(LicensesPage)).replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"'));
    for (const notice of THIRD_PARTY_NOTICES) assert.ok(text.includes(words(notice.license)), notice.name);
    assert.match(text, /Copyright \(c\) 2026 Kelvin Zhang/);
    assert.doesNotMatch(text, /summarizes/);
    assert.match(text, /Questions\? Email support@unvibe\.site/);
  });
});
