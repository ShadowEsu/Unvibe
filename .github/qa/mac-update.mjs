// QA (mac-update.sh): in the running Unvibe (debug port 9229), the app's own update check and install, the calls its
// Home card's "Update" button makes (window.unvibe.updateCheck / updateInstall). Prints PASS/FAIL/NOTE lines.
// Usage: node mac-update.mjs <out dir> <to version> <arm64|x64>
import { chromium } from "playwright";
import { join } from "node:path";

const [out, to, arch] = process.argv.slice(2);
const browser = await chromium.connectOverCDP("http://127.0.0.1:9229");
let page = null;
for (let i = 0; i < 60 && !page; i++) {
  page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes("companion")) ?? null;
  if (!page) await new Promise((r) => setTimeout(r, 500));
}
if (!page) { console.log("FAIL  no companion window on the debug port"); process.exit(1); }
const current = await page.evaluate(() => window.unvibe.appInfo?.().then((i) => i?.version).catch(() => null) ?? null).catch(() => null);
console.log(`NOTE  companion ${page.url().split("/").pop()}, app version ${current ?? "?"}`);

const check = await page.evaluate(() => window.unvibe.updateCheck());
console.log(`NOTE  updateCheck: ${JSON.stringify(check)}`);
const wantUrl = `https://github.com/ShadowEsu/Unvibe/releases/download/v${to}/Unvibe-${to}-mac-${arch}.dmg`;
const offered = check?.ok && check.available && check.latest === to && check.url === wantUrl;
console.log(`${offered ? "PASS" : "FAIL"}  update offered: available ${check?.available}, latest ${check?.latest}, url ${check?.url === wantUrl ? "= the " + arch + " DMG of v" + to : check?.url}`);
await page.waitForTimeout(1500);
await page.screenshot({ path: join(out, "2-from-home-update-offered.png") }).catch(() => {});
if (!offered) process.exit(1);

// The install downloads the DMG, checks it against SHA256SUMS-mac.txt, then the app quits and its helper swaps it in.
const started = Date.now();
const res = await page.evaluate(() => window.unvibe.updateInstall()).catch((e) => ({ disconnected: String(e).split("\n")[0] }));
console.log(`${res?.ok || res?.disconnected ? "PASS" : "FAIL"}  updateInstall answered after ${Math.round((Date.now() - started) / 1000)} s: ${JSON.stringify(res).slice(0, 200)}`);
await browser.close().catch(() => {});
