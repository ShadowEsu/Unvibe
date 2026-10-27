import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TEXT = /\.(?:tsx?|jsx?|mjs|css|html?|txt|md|json|xml|svg|webmanifest)$/;

/**
 * Screenshots that showed the owner's name or inbox (Security S-H2, 2026-10-27). A text scan can't
 * see inside an image, so these exact files are refused wherever they reappear under public/.
 */
const RETIRED_IMAGES = new Set([
  "996ad16b546b7d1e56b48d658ed930c2de48a13d8b6f00857bcaece8afa89f34", // unvibe/real/settings-privacy.webp (0.1.43)
  "8a667435f2c7841d934349318602e7d8530a958dc848774dd08a1f4562a387a5", // press/app/18-settings-privacy-data.jpg (0.1.43)
  "8cfbc86beca9a5ab3c27a777c8b5991ce3e023495bee8af1b8e0133c99283727", // product/privacy-data.jpg
  "0683d11a9ec9b29ec94e727181bda6daed725d361df518b828f68678ebfa4a8b", // product/v3/privacy-data.jpg (0.1.43)
  "6c20d477fdbdf2c063e79b68f5b13fe6b8dd9c3eb4869fec529832fbdd5af01d", // web screenshots/progress-light.webp
  "bdb7d0145df63b12f8093458e6c085a4d529467d02a8f8bbfd5b502222539fcc", // web screenshots/study-light.webp
  "08e1a456d51358073ba41ecca466ada2e0108d889fd3215b0d4d512845ea0d2e", // web screenshots/projects-light.webp
  "6cf7c38f9c0f1c8126fc18a4945d9f70fb6e085ae7f2811287ed04e3873ecd31", // web screenshots/notebook-light.webp
]);

function allFiles(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { recursive: true })
    .map((entry) => join(dir, String(entry)))
    .filter((path) => statSync(join(process.cwd(), path)).isFile());
}

function files(dir: string): string[] {
  return allFiles(dir).filter((path) => TEXT.test(path) && !path.endsWith(".test.ts"));
}

describe("public contact", () => {
  it("names no personal inbox in site source, public files, scripts or user email", () => {
    const offenders = [...files("src"), ...files("public"), ...files("scripts")]
      .filter((path) => /preston@/i.test(readFileSync(join(process.cwd(), path), "utf8")));
    assert.deepEqual(offenders, []);
  });

  it("ships none of the retired screenshots that showed the owner's name or inbox", () => {
    const offenders = allFiles("public").filter((path) =>
      RETIRED_IMAGES.has(createHash("sha256").update(readFileSync(join(process.cwd(), path))).digest("hex")),
    );
    assert.deepEqual(offenders, []);
  });
});
