import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { mobileBarHidden } from "@/components/paper/MobileDownloadBar";

describe("the small-screen download bar", () => {
  it("stays off the pages whose own content is the download", () => {
    for (const path of ["/pricing", "/beta", "/install-help"]) assert.equal(mobileBarHidden(path), true, path);
  });

  it("still shows on the other public pages", () => {
    for (const path of ["/", "/about", "/resources", "/releases", "/explain"]) assert.equal(mobileBarHidden(path), false, path);
  });

  it("leaves room under the footer so it never covers the last line", () => {
    const css = readFileSync(new URL("../app/polish.css", import.meta.url), "utf8");
    assert.match(css, /html:has\(\.mobile-dl\) \.paper-footer \{\s*padding-bottom: calc\(3\.8rem/);
  });
});
