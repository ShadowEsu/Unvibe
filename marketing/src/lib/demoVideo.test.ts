import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** The homepage demo AppTour plays: every file it names exists, is named by its content, and has a licence row. */
const appTour = readFileSync(path.resolve("src/components/paper/AppTour.tsx"), "utf8");
const stem = /const DEMO = "\/videos\/([a-z0-9-]+)";/.exec(appTour)?.[1];

describe("homepage demo video", () => {
  it("AppTour names one demo file stem", () => {
    assert.ok(stem, "AppTour.tsx has no DEMO stem");
  });

  it("ships the MP4, both posters and the captions, and the MP4 name carries its SHA-256", () => {
    for (const suffix of [".mp4", "-poster.webp", "-poster-720.webp", ".en.vtt"]) {
      assert.ok(existsSync(path.resolve("public/videos", `${stem}${suffix}`)), `public/videos/${stem}${suffix} is missing`);
    }
    const digest = createHash("sha256").update(readFileSync(path.resolve("public/videos", `${stem}.mp4`))).digest("hex");
    assert.ok(stem!.endsWith(`-${digest.slice(0, 8)}`), `${stem}.mp4 should end in -${digest.slice(0, 8)}`);
  });

  it("captions are WebVTT, with no SRT comma timestamps", () => {
    const vtt = readFileSync(path.resolve("public/videos", `${stem}.en.vtt`), "utf8");
    assert.ok(vtt.startsWith("WEBVTT\n"));
    assert.doesNotMatch(vtt, /\d{2}:\d{2}:\d{2},\d{3}/);
    assert.match(vtt, /\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/);
  });

  it("docs/licenses.md lists its source and licence", () => {
    assert.ok(readFileSync(path.resolve("../docs/licenses.md"), "utf8").includes(`${stem}.mp4`));
  });
});
