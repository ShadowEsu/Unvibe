import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BetaDownloadsPage from "@/app/beta/page";
import { BETA_INSTALL_ASSET, BETA_INSTALL_TAG, BETA_WINDOWS_ASSET, BETA_WINDOWS_SETUP_ASSET } from "./betaInstallScript";
import { DOWNLOAD_SIZES, MAC_INTEL_META, MAC_META, MAC_SHA256_URL, WINDOWS_META, WINDOWS_SHA256_URL } from "./downloadMeta";

Object.assign(globalThis, { React });

const VERSION = BETA_INSTALL_TAG.replace(/^v/, "");

/** The "about N MB" figure in a meta line, checked to round up: never under the real size, never a whole MB over. */
function assertAboutMb(line: string, bytes: number) {
  const mb = Number(/about (\d+) MB\.$/.exec(line)?.[1]);
  assert.ok(mb * 1_000_000 >= bytes && (mb - 1) * 1_000_000 < bytes, `${line} for ${bytes} bytes`);
}

describe("download meta lines", () => {
  it("name the files of the one release the site links", () => {
    assert.equal(DOWNLOAD_SIZES.tag, BETA_INSTALL_TAG, "update the sizes when the tag moves");
    assert.equal(BETA_INSTALL_ASSET, `Unvibe-${VERSION}-mac-arm64.dmg`);
    // The Windows link is the portable .exe, so the meta line says "Portable app"; install.ps1 runs the setup.
    assert.equal(BETA_WINDOWS_ASSET, `Unvibe-${VERSION}-win-x64-portable.exe`);
    assert.equal(BETA_WINDOWS_SETUP_ASSET, `Unvibe-${VERSION}-win-x64-setup.exe`);
  });

  it("give a size that rounds up", () => {
    assertAboutMb(WINDOWS_META, DOWNLOAD_SIZES.windowsPortableExeBytes);
    assertAboutMb(MAC_META, DOWNLOAD_SIZES.macArm64DmgBytes);
    assertAboutMb(MAC_INTEL_META, DOWNLOAD_SIZES.macX64DmgBytes);
  });

  it("/beta gives Windows its meta line, the two steps after the click and the SHA-256 for each file", () => {
    const page = renderToStaticMarkup(createElement(BetaDownloadsPage)).replace(/\s+/g, " ");
    assert.ok(page.includes(`On Windows: ${WINDOWS_META} If your browser warns, choose <b>Keep</b>. If Windows says it protected your PC, choose <b>More info</b>, then <b>Run anyway</b>.`));
    assert.ok(page.includes(`href="${MAC_SHA256_URL}"`));
    assert.ok(page.includes(`href="${WINDOWS_SHA256_URL}"`));
  });
});
