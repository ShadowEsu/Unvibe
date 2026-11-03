import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BetaDownloadsPage from "@/app/beta/page";
import { BETA_INSTALL_ASSET, BETA_INSTALL_TAG, BETA_WINDOWS_ASSET } from "./betaInstallScript";
import { DOWNLOAD_SIZES, MAC_INTEL_META, MAC_META, MAC_SHA256_URL, WINDOWS_META, WINDOWS_SHA256_URL } from "./downloadMeta";

Object.assign(globalThis, { React });

describe("download meta lines", () => {
  it("describe the release the site links", () => {
    assert.equal(DOWNLOAD_SIZES.tag, BETA_INSTALL_TAG, "update the sizes when the tag moves");
    assert.equal(BETA_INSTALL_ASSET, "Unvibe-0.1.48-mac-arm64.dmg");
    // The Windows link is the portable .exe, so the meta line says "Portable app".
    assert.equal(BETA_WINDOWS_ASSET, "Unvibe-0.1.48-win-x64-portable.exe");
  });

  it("say version and size in words", () => {
    assert.equal(WINDOWS_META, "Windows 10 or 11, x64. Portable app, version 0.1.48, about 88 MB.");
    assert.equal(MAC_META, "Apple silicon. Version 0.1.48, about 109 MB.");
    assert.equal(MAC_INTEL_META, "Intel Mac. Version 0.1.48, about 116 MB.");
  });

  it("/beta gives Windows its meta line, the two steps after the click and the SHA-256 for each file", () => {
    const page = renderToStaticMarkup(createElement(BetaDownloadsPage)).replace(/\s+/g, " ");
    assert.ok(page.includes(`On Windows: ${WINDOWS_META} If your browser warns, choose <b>Keep</b>. If Windows says it protected your PC, choose <b>More info</b>, then <b>Run anyway</b>.`));
    assert.ok(page.includes(`href="${MAC_SHA256_URL}"`));
    assert.ok(page.includes(`href="${WINDOWS_SHA256_URL}"`));
    assert.equal(WINDOWS_SHA256_URL, "https://github.com/ShadowEsu/Unvibe/releases/download/v0.1.48/SHA256SUMS-windows.txt");
  });
});
