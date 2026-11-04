import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BetaDownloadsPage from "@/app/beta/page";

Object.assign(globalThis, { React });

describe("/beta feedback ask", () => {
  const page = renderToStaticMarkup(createElement(BetaDownloadsPage));
  const ask = /tell us what clicked and what didn&#x27;t/g;

  it("is asked once, at the end of the page, not in the download card", () => {
    assert.equal(page.match(ask)?.length, 1);
    const at = page.search(ask);
    assert.ok(at > page.indexOf('id="help"'), "after the download and the fixes");
    const install = page.slice(page.indexOf('id="install"'), page.indexOf("</section>", page.indexOf('id="install"')));
    assert.doesNotMatch(install, /Tell us how the install went/);
  });
});
