#!/usr/bin/env node
/**
 * Turn a real capture from app/e2e/marketing-media.mjs into the homepage demo media.
 *
 *   node scripts/build-demo-media.mjs <MEDIA_DIR>
 *
 * Needs ffmpeg and cwebp on PATH. Writes:
 *   public/videos/unvibe-real-demo.mp4 (+ -poster.webp, -poster-720.webp): onboarding, then the panel explaining
 *     live, depth, follow-up and Test me at real speed. It ends there: the companion pages show
 *     the capture account's name. Waits between steps are cut where segments join; nothing
 *     inside a segment is sped up or edited.
 *   public/unvibe/real/*.webp: the screenshots the homepage walkthrough uses.
 *   src/data/demoMedia.json: version and length, so captions never drift from the recording.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const mediaDir = process.argv[2];
if (!mediaDir || !existsSync(join(mediaDir, "timeline.json"))) {
  console.error("usage: node scripts/build-demo-media.mjs <MEDIA_DIR with timeline.json>");
  process.exit(2);
}
const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const timeline = JSON.parse(readFileSync(join(mediaDir, "timeline.json"), "utf8"));
const mark = (label) => {
  const found = timeline.marks.find((m) => m.label === label);
  if (!found) throw new Error(`timeline is missing the "${label}" step; recapture before rebuilding`);
  return found.s;
};
const video = (name) => {
  const found = timeline.videos.find((v) => v.window === name);
  if (!found) throw new Error(`no recording for ${name}`);
  const localPath = join(mediaDir, "raw", basename(found.path));
  return { ...found, path: existsSync(localPath) ? localPath : found.path };
};
const shots = {
  "panel-explained-top": [880],
  "panel-beginner": [880],
  "panel-follow-up": [880],
  "panel-test-me": [880],
  today: [1600],
  briefs: [1600],
  momentum: [1600],
  "settings-privacy": [1600],
  quiz: [1600],
};
const missing = Object.keys(shots).filter((name) => !existsSync(join(mediaDir, "shots", `${name}.png`)));
if (missing.length) throw new Error(`Recapture required screenshots before building: ${missing.join(", ")}`);

const companion = video("companion.html");
const panel = video("widget.html");
const segments = {
  onboarding: [Math.max(0, mark(`app open ${timeline.version}`) - companion.opened + 0.5), mark("onboarding") - companion.opened + 0.8],
  panel: [0, mark("test me") - panel.opened + 0.5],
};
const length = Object.values(segments).reduce((sum, [a, b]) => sum + (b - a), 0);

const out = join(site, "public/videos/unvibe-real-demo.mp4");
const poster = join(site, "public/videos/unvibe-real-demo-poster.webp");
const posterPhone = join(site, "public/videos/unvibe-real-demo-poster-720.webp");
const dusk = join(site, "public/hero/golden-gate-dusk.webp");
const W = 1280;
const H = 800;
const fmt = `fps=30,format=yuv420p,setsar=1`;
const trim = ([a, b]) => `trim=start=${a.toFixed(2)}:end=${b.toFixed(2)},setpts=PTS-STARTPTS`;

// The panel recording sits in the top-left of a 1280x800 frame; show it over the blurred dusk photo.
const filter = [
  `[0:v]${trim(segments.onboarding)},scale=${W}:${H},${fmt}[a]`,
  `[2:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=18,eq=brightness=-0.06,loop=-1:1,${fmt}[bg]`,
  `[1:v]${trim(segments.panel)},crop=620:800:0:0,scale=-2:740,${fmt}[p]`,
  `[bg][p]overlay=(W-w)/2:(H-h)/2:shortest=1,${fmt}[b]`,
  `[a][b]concat=n=2:v=1:a=0[v]`,
].join(";");

mkdirSync(dirname(out), { recursive: true });
execFileSync("ffmpeg", [
  "-v", "error", "-y",
  "-i", companion.path, "-i", panel.path, "-loop", "1", "-i", dusk,
  "-filter_complex", filter, "-map", "[v]", "-t", length.toFixed(2),
  "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-profile:v", "high", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", "-an", out,
], { stdio: "inherit" });

// Poster: the panel mid-explanation, so the first paint already shows the product working.
const posterAt = segments.onboarding[1] + Math.min(4, segments.panel[1] / 3);
const posterPng = join(mediaDir, "poster.png");
execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", posterAt.toFixed(2), "-i", out, "-frames:v", "1", posterPng]);
execFileSync("cwebp", ["-quiet", "-q", "78", posterPng, "-o", poster]);
// Phones render the window about 350 CSS px wide (700 device px); AppTour's srcset picks this one there.
execFileSync("cwebp", ["-quiet", "-q", "78", "-resize", "720", "0", posterPng, "-o", posterPhone]);

const realDir = join(site, "public/unvibe/real");
mkdirSync(realDir, { recursive: true });
for (const [name, [width]] of Object.entries(shots)) {
  const src = join(mediaDir, "shots", `${name}.png`);
  execFileSync("cwebp", ["-quiet", "-q", "82", "-resize", String(width), "0", src, "-o", join(realDir, `${name}.webp`)]);
}

writeFileSync(
  join(site, "src/data/demoMedia.json"),
  `${JSON.stringify({ version: timeline.version, platform: "Mac", seconds: Math.round(length) }, null, 2)}\n`,
);
console.log(`demo ${length.toFixed(1)}s from Unvibe ${timeline.version}`);
