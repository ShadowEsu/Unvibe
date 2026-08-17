import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { betaInstallScript } from "./betaInstallScript";
import { parseBetaInstallEvent, recordBetaInstallEvent } from "./betaInstallStats";

const dataFile = path.join(process.cwd(), ".data", "beta-install.json");

describe("betaInstallScript", () => {
  it("installs Unvibe.app and clears Apple quarantine", () => {
    const script = betaInstallScript();
    assert.match(script, /Unvibe-0\.1\.11-beta-arm64-unsigned\.dmg/);
    assert.match(script, /xattr -cr "\$work\/Unvibe\.dmg"/);
    assert.match(script, /xattr -cr "\$DEST"/);
    assert.match(script, /ditto "\$mountPoint\/Unvibe\.app" "\$DEST"/);
    assert.match(script, /open "\$DEST"/);
    assert.match(script, /unvibe\.site\/api\/install\/event/);
    assert.match(script, /"event":"installed"/);
  });
});

describe("betaInstallStats", () => {
  it("parses copy and install events only", () => {
    assert.equal(parseBetaInstallEvent("copied"), "copied");
    assert.equal(parseBetaInstallEvent("installed"), "installed");
    assert.equal(parseBetaInstallEvent("fetched"), "fetched");
    assert.equal(parseBetaInstallEvent("hack"), null);
  });

  it("counts copied and installed events on disk", async () => {
    const previousBlob = process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    await fs.rm(dataFile, { force: true }).catch(() => undefined);
    try {
      const afterCopy = await recordBetaInstallEvent("copied");
      const afterInstall = await recordBetaInstallEvent("installed");
      assert.equal(afterCopy.copied, 1);
      assert.equal(afterInstall.copied, 1);
      assert.equal(afterInstall.installed, 1);
    } finally {
      if (previousBlob === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = previousBlob;
      await fs.rm(dataFile, { force: true }).catch(() => undefined);
    }
  });
});
