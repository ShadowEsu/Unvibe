// Builds public/investors/unvibe-pitch-deck.pdf (and the short/full copies) from deck/unvibe-deck.html.
// Usage: node scripts/build-deck.mjs [--png outDir]
import { chromium } from "playwright";
import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "deck", "unvibe-deck.html");
const out = path.join(root, "public", "investors", "unvibe-pitch-deck.pdf");
const pngDir = process.argv[2] === "--png" ? process.argv[3] : null;

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(`file://${src}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: out, width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true });
for (const copy of ["unvibe-investor-deck-short.pdf", "unvibe-investor-deck-full.pdf"]) {
  copyFileSync(out, path.join(root, "public", "investors", copy));
}
if (pngDir) {
  const slides = await page.$$("section.s");
  for (let i = 0; i < slides.length; i++) await slides[i].screenshot({ path: path.join(pngDir, `slide-${String(i + 1).padStart(2, "0")}.png`) });
}
await browser.close();
console.log(`deck written: ${out}`);
