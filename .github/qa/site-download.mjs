// QA (qa-first-open.yml): the site's own one-click download, in the real Google Chrome on this runner's OS, the way a
// visitor gets Unvibe (Show HN, unvibe-pm Fri 6 Nov). Opens the home page, says No thanks to analytics, presses the
// first visible "Download" button (#228's DownloadCta: picks the file from the OS, Chrome's architecture hint and the
// WebGL renderer), and records:
//   the pick and the browser hints behind it; the file that downloads (name, URL, size, sha256 vs the release's
//   SHA256SUMS); the thank-you page (/beta?dl=<key>#thanks) and the first-open steps it shows for this OS.
// Env: SITE (http://127.0.0.1:3000 for a local build of a PR, or https://unvibe.site), OUT, EXPECT (mac-arm |
// mac-intel | windows); the release is the one the site's file names. Writes OUT/site-report.txt, OUT/pick.json, OUT/dl-file.txt (the saved
// file's path, for the install row) and pictures. No analytics: ?notrack=1, and the site sends nothing from
// automated browsers. Exit 1 on any FAIL.
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const { SITE, OUT, EXPECT } = process.env;
// The file each pick should start; the release version is read from the file the site hands out (0.1.49 today).
const files = { "mac-arm": "-mac-arm64.dmg", "mac-intel": "-mac-x64.dmg", windows: "-win-x64-portable.exe" };
const other = { "mac-arm": "-mac-x64.dmg", "mac-intel": "-mac-arm64.dmg" };
// What the thank-you card (section#thanks, #228's Download.tsx) must say for each pick: its heading names the build
// (D_THANKS.file with downloadPick's label), and the steps are InstallBox's first-open steps for that OS. The card's
// "Unvibe Not Opened" is a picture, so the Mac check reads the step words; the rest of /beta (the full install guide
// for both systems, below the card) doesn't count.
const card = {
  "mac-arm": { label: "for Mac (Apple silicon).", os: "mac" },
  "mac-intel": { label: "for Mac (Intel).", os: "mac" },
  windows: { label: "for Windows.", os: "windows" },
};
const steps = {
  mac: { want: ["Your download has started.", "Applications", "Privacy & Security", "Open Anyway"], not: ["Run anyway"] },
  windows: { want: ["Your download has started.", "Run anyway"], not: ["Open Anyway", "Privacy & Security"] },
};
mkdirSync(OUT, { recursive: true });
const report = join(OUT, "site-report.txt");
writeFileSync(report, "");
const r = (s) => { console.log(s); appendFileSync(report, s + "\n"); };
let fails = 0;
const check = (ok, name, detail = "") => { if (!ok) fails++; r(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); return ok; };

const dl = join(homedir(), "Downloads");
mkdirSync(dl, { recursive: true });
// CHANNEL: "chrome" (default, the installed Google Chrome) or "" for Playwright's own Chromium (a local smoke run).
const channel = process.env.CHANNEL ?? "chrome";
const browser = await chromium.launch({ ...(channel ? { channel } : {}), headless: process.env.HEADLESS === "1" ? true : false, downloadsPath: dl });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
// Local smoke against a protected preview only: BYPASS_FILE's secret goes to the SITE origin and nowhere else.
if (process.env.BYPASS_FILE) {
  const secret = readFileSync(process.env.BYPASS_FILE, "utf8").trim();
  await context.route((u) => u.origin === new URL(SITE).origin, (route) =>
    route.continue({ headers: { ...route.request().headers(), "x-vercel-protection-bypass": secret } }));
}
const page = await context.newPage();
const pick = { site: SITE, expect: EXPECT };
try {
  r(`site ${SITE}, Chrome ${browser.version()}, expect ${EXPECT} (${files[EXPECT]})`);
  const res = await page.goto(`${SITE}/?notrack=1`, { waitUntil: "load", timeout: 90000 });
  check(res?.status() === 200, "home page loads", `status ${res?.status()}`);
  const no = page.getByRole("button", { name: "No thanks" });
  if (await no.isVisible().catch(() => false)) { await no.click(); r("analytics bar: pressed No thanks"); }
  pick.hints = await page.evaluate(async () => {
    const ua = navigator.userAgentData;
    const he = ua?.getHighEntropyValues ? await ua.getHighEntropyValues(["architecture", "bitness", "platform", "platformVersion"]) : null;
    let gl = null;
    try {
      const c = document.createElement("canvas").getContext("webgl");
      const i = c?.getExtension("WEBGL_debug_renderer_info");
      gl = c && i ? c.getParameter(i.UNMASKED_RENDERER_WEBGL) : null;
    } catch {}
    return { userAgent: navigator.userAgent, uaCh: he, webglRenderer: gl, maxTouchPoints: navigator.maxTouchPoints };
  });
  r(`browser hints: architecture ${pick.hints.uaCh?.architecture ?? "none"}, platform ${pick.hints.uaCh?.platform ?? "?"} ${pick.hints.uaCh?.platformVersion ?? ""}, WebGL '${pick.hints.webglRenderer ?? "none"}'`);
  await page.waitForTimeout(1500); // the button reads the architecture hint asynchronously after hydration
  await page.screenshot({ path: join(OUT, "site-1-home.png") });

  const cta = page.locator("a[data-dl]:visible").first();
  pick.button = (await cta.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  r(`pressing the first visible download button: '${pick.button}'`);
  const t0 = Date.now();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 90000 }), cta.click()]);
  pick.url = download.url();
  pick.file = download.suggestedFilename();
  pick.secondsToStart = (Date.now() - t0) / 1000;
  const key = Object.keys(files).find((k) => new RegExp(`^Unvibe-[0-9.]+${files[k].replace(/\./g, "\\.")}$`).test(pick.file)) ?? "unknown";
  pick.key = key;
  pick.version = (pick.file.match(/^Unvibe-([0-9.]+)-/) || [])[1] ?? "";
  check(key === EXPECT, `the site picks the right file for this computer`, `${pick.file} (${key}), want Unvibe-<v>${files[EXPECT]}; started ${pick.secondsToStart.toFixed(1)} s after the press, from ${pick.url}`);
  await page.waitForURL(/\/beta\?dl=/, { timeout: 30000 }).catch(() => {});
  pick.thanksUrl = page.url();
  check(pick.thanksUrl.includes(`/beta?dl=${EXPECT}`) && pick.thanksUrl.endsWith("#thanks"), "the thank-you page opens for that file", pick.thanksUrl);

  const saved = join(dl, pick.file);
  await download.saveAs(saved);
  const failure = await download.failure();
  const bytes = readFileSync(saved);
  pick.size = statSync(saved).size;
  pick.sha256 = createHash("sha256").update(bytes).digest("hex");
  const sumsName = EXPECT === "windows" ? "SHA256SUMS-windows.txt" : "SHA256SUMS-mac.txt";
  const sums = await (await fetch(`https://github.com/ShadowEsu/Unvibe/releases/download/v${pick.version}/${sumsName}`)).text();
  const want = sums.split("\n").map((l) => l.trim().split(/\s+\*?/)).find(([, n]) => n === pick.file)?.[0] ?? "";
  check(!failure && want && pick.sha256 === want, "the download completes and matches the release's checksum",
    `${pick.size.toLocaleString("en-US")} B, sha256 ${pick.sha256.slice(0, 16)}…, ${sumsName} says ${want ? want.slice(0, 16) + "…" : "NOT LISTED"}${failure ? `, failure ${failure}` : ""}`);
  // What the browser marked the file with (macOS quarantine / Windows Mark of the Web), on Chrome's own file and on
  // the saved copy the install row opens (it keeps a mark that is there, and adds one only if none is).
  const mark = (f) => {
    try {
      return process.platform === "darwin"
        ? execFileSync("xattr", ["-p", "com.apple.quarantine", f], { encoding: "utf8" }).trim()
        : readFileSync(`${f}:Zone.Identifier`, "utf8").replace(/\s+/g, " ").trim();
    } catch { return null; }
  };
  pick.markChrome = mark(await download.path());
  // Playwright's saveAs copy drops the mark; put Chrome's own mark back, so the install row opens what a visitor has.
  if (pick.markChrome) {
    if (process.platform === "darwin") execFileSync("xattr", ["-w", "com.apple.quarantine", pick.markChrome, saved]);
    else writeFileSync(`${saved}:Zone.Identifier`, readFileSync(`${await download.path()}:Zone.Identifier`));
  }
  pick.mark = mark(saved);
  r(`browser's mark: on Chrome's file ${pick.markChrome ?? "none"}; on the copy the install row opens ${pick.mark ?? "none"}`);
  writeFileSync(join(OUT, "dl-file.txt"), saved);

  // The thank-you card: its OS, the build it names, and the first-open steps in it (visible text of the card only).
  const thanks = page.locator("section#thanks");
  await thanks.scrollIntoViewIfNeeded({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const text = (await thanks.innerText().catch(() => "")).replace(/\s+/g, " ");
  const exp = card[EXPECT];
  pick.cardOs = await thanks.getAttribute("data-os").catch(() => null);
  pick.cardText = text.slice(0, 1200);
  const missing = steps[exp.os].want.filter((s) => !text.includes(s));
  const wrong = steps[exp.os].not.filter((s) => text.includes(s));
  check(pick.cardOs === exp.os && text.includes(exp.label), "the thank-you card is for this computer's build",
    `data-os ${pick.cardOs}, names '${(text.match(/Unvibe [0-9.]+ for [^.]+\./) || ["?"])[0]}', want '${exp.label}'`);
  check(missing.length === 0 && wrong.length === 0, `the thank-you card shows the ${exp.os === "mac" ? "Mac" : "Windows"} first-open steps`,
    `missing ${missing.length ? missing.join(", ") : "none"}; other system's words: ${wrong.length ? wrong.join(", ") : "none"}`);
  // Anything covering the card's steps or links at this size (the setup-email pop-up, the feedback button).
  pick.overlaps = await page.evaluate(() => {
    const card = document.querySelector("section#thanks")?.getBoundingClientRect();
    if (!card) return [];
    return [...document.querySelectorAll("body *")].filter((el) => {
      const s = getComputedStyle(el);
      if (!["fixed", "sticky"].includes(s.position) || s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
      const b = el.getBoundingClientRect();
      if (b.width < 40 || b.height < 30 || el.closest("header, nav")) return false;
      return b.left < card.right && b.right > card.left && b.top < card.bottom && b.bottom > card.top;
    }).filter((el, _, all) => !all.some((o) => o !== el && o.contains(el)))
      .map((el) => { const b = el.getBoundingClientRect(); return `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} '${el.innerText.replace(/\s+/g, " ").slice(0, 50)}' at ${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`; });
  });
  r(`NOTE  fixed layers over the card at 1440x900: ${pick.overlaps.length ? pick.overlaps.join(" | ") : "none"}`);
  await page.screenshot({ path: join(OUT, "site-2-thanks.png") });
  await page.screenshot({ path: join(OUT, "site-3-thanks-full.png"), fullPage: true });
  if (other[EXPECT]) {
    const alt = await page.locator(`a[href$="${other[EXPECT]}"]:visible`).count();
    check(alt > 0, "the other Mac build is one click away on the thank-you page", `${alt} visible link(s) to ${other[EXPECT]}`);
  }
} catch (e) {
  check(false, "site download flow", String(e).slice(0, 300));
  await page.screenshot({ path: join(OUT, "site-error.png") }).catch(() => {});
} finally {
  writeFileSync(join(OUT, "pick.json"), JSON.stringify(pick, null, 2));
  await browser.close();
}
r(`site download: ${fails} FAIL`);
process.exit(fails ? 1 : 0);
