import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HERO_RECORDING, KEY_CHECK_SHOT, SHOT_CAPTION } from "./homeGallery";
import { BRIEFS_SHOT, PRIVACY_SHOT, SHOTS } from "@/site/content";
import { STEPS } from "./howItWorks";
import { INSTALL_COPY } from "@/components/paper/InstallBox";

/** Width and height of a lossy or lossless WebP, read from its header. */
function webpSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  assert.equal(b.toString("ascii", 0, 4), "RIFF", `${file} is not a WebP`);
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  throw new Error(`${file}: unknown WebP chunk ${kind}`);
}

const installShots = Object.values(INSTALL_COPY).flatMap((copy) => copy.stepShots.filter((shot) => shot !== null));
const posters = [{ ...HERO_RECORDING.poster, alt: HERO_RECORDING.alt }];
const shots = [...Object.values(SHOTS), BRIEFS_SHOT, PRIVACY_SHOT, KEY_CHECK_SHOT, ...posters, ...STEPS.filter((s) => s.caption).map((s) => s.image), ...installShots];

test("every real screenshot's width and height match its file (1x, or 2x for sharp screens), so nothing shifts as it loads", () => {
  for (const shot of shots) {
    const file = webpSize(join(process.cwd(), "public", shot.src));
    const scale = file.width / shot.width;
    assert.ok(scale === 1 || scale === 2, `${shot.src}: ${file.width} px wide for ${shot.width}`);
    assert.deepEqual(file, { width: shot.width * scale, height: shot.height * scale }, shot.src);
  }
});

test("the screenshots are of the released app, and the depths shown are free ones", () => {
  assert.match(SHOT_CAPTION, /^Real screen, sample code · Unvibe \d+\.\d+\.\d+$/);
  // Expert is Pro, which isn't on sale: the home shows only depths every Free account has.
  for (const shot of shots) assert.doesNotMatch(shot.alt, /\bExpert\b/, shot.src);
  for (const shot of shots) assert.ok(shot.alt.length > 20 && !/screenshot of/i.test(shot.alt), `${shot.src} alt says what is in it`);
});
