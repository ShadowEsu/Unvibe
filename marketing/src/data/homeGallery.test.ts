import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GALLERY, KEY_CHECK_SHOT, SHOT_CAPTION } from "./homeGallery";
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
const shots = [...GALLERY.flatMap((card) => card.shots), KEY_CHECK_SHOT, ...STEPS.filter((s) => s.caption).map((s) => s.image), ...installShots];

test("every real screenshot's width and height match its file, so nothing shifts as it loads", () => {
  for (const shot of shots) {
    assert.deepEqual(webpSize(join(process.cwd(), "public", shot.src)), { width: shot.width, height: shot.height }, shot.src);
  }
});

test("the screenshots are of the released app, and the depths shown are free ones", () => {
  assert.match(SHOT_CAPTION, /^Real screen, sample code · Unvibe \d+\.\d+\.\d+$/);
  const depths = GALLERY.flatMap((card) => card.shots.map((s) => s.depth)).filter(Boolean);
  assert.deepEqual(depths, ["Beginner", "Advanced"]);
  for (const shot of shots) assert.ok(shot.alt.length > 20 && !/screenshot of/i.test(shot.alt), `${shot.src} alt says what is in it`);
});
