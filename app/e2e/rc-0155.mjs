// Unvibe 0.1.55 RC rows with no hosted-AI call (RC app/rc-0155 601fc29d; the lead's agents/unvibe/review-rc0155-
// 601fc29d.md, Security S-2 requests/security/20261119-1640-…, QA plan agents/unvibe-qa/2026-11-19-thu1119/rc0155/
// WALK-PLAN.md), run by real-device-test.yml (input rc0155=walk) on GitHub's macOS and Windows machines.
//
// #354: a sign-in card that goes away drops its device code, so main stops polling POST /api/v1/auth/token.
//   leave (Mac + Windows): Settings → Account & Plan → Continue with Google, the code shows, the card closes (Escape
//         closes Settings) while the code still waits;
//   ⌘W (Mac, the lead's N1): the same, but the main window is closed with a real ⌘W (a System Events key press, an
//         OS key event) while the code waits. On Windows the close button minimizes on purpose (main.ts), so the card
//         stays and its poll rightly goes on: not run there.
// The polls are counted in the app's Chromium net log (netlog.mjs: default capture mode; only time, method, path and
// status of the API's requests are kept, in netlog-<phase>.txt; the raw log is written outside SHOTS_DIR and deleted).
// The sign-in code is never read, printed or captured (#350): no still while it shows, and browsers are quit first.
//
// Phases: control = the last release (0.1.54), before the fix: its polls are expected to go on after the close, which
//         proves the net log sees them (NOTE lines, never PASS/FAIL);
//         walk = the RC: PASS only when ≥ 2 polls were seen between the click and the close, and none from 1.5 s
//         after the close through the next 30 s.
// NO hosted-AI call anywhere in this file: nothing is explained, asked or quizzed, and the profile never agrees to send.
//
// Env: UNVIBE_EXE, SHOTS_DIR, UNVIBE_OS (mac | windows; linux for a local run), RC_PHASE (control | walk),
//      RC55_PROFILE (a new profile), RC55_INSTALL_ID (its qa- install id, flagged by the workflow), NETLOG_DIR (outside
//      SHOTS_DIR), API_HOST (default api.unvibe.site), UNVIBE_APP_DIR (local run: electron + the app's folder).
import { launchApp, readStore } from './cdp-launch.mjs';
import { apiRequests, keepSummaryAndDrop, netLogArg } from './netlog.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
const appDir = process.env.UNVIBE_APP_DIR;
const os = process.env.UNVIBE_OS ?? (process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux');
const phase = process.env.RC_PHASE;
const out = path.resolve(process.env.SHOTS_DIR ?? 'rc-0155');
const host = process.env.API_HOST ?? 'api.unvibe.site';
const netDir = path.resolve(process.env.NETLOG_DIR ?? mkdtempSync(path.join(tmpdir(), 'unvibe-rc0155-netlog-')));
if (!exe) throw new Error('Set UNVIBE_EXE');
if (phase !== 'control' && phase !== 'walk') throw new Error('RC_PHASE must be control or walk');
if (`${netDir}${path.sep}`.startsWith(`${out}${path.sep}`)) throw new Error('NETLOG_DIR must be outside SHOTS_DIR: the raw net log is never uploaded');
mkdirSync(out, { recursive: true });
mkdirSync(netDir, { recursive: true });
const netlog = path.join(netDir, `netlog-${phase}-${os}.json`);

const report = [];
let n = 0;
const line = (s) => { report.push(s); console.log(s); };
const log = (ok, step, detail = '') => line(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `: ${detail}` : ''}`);
const note = (step, detail = '') => line(`NOTE  ${step}${detail ? `: ${detail}` : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (e) => String(e?.message ?? e).split('\n')[0];
async function waitFor(fn, ms = 5000, every = 150) {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t > ms) return v;
    await sleep(every);
  }
}
async function shot(page, label) {
  const file = `${phase}-${String(++n).padStart(2, '0')}-${label}.png`;
  try { await page.screenshot({ path: path.join(out, file), animations: 'disabled' }); } catch (e) { note(`still ${label}`, `not taken (${short(e)})`); }
}
function desktop(label) {
  const file = path.join(out, `${phase}-${String(++n).padStart(2, '0')}-desktop-${label}.png`);
  try {
    if (os === 'mac') execFileSync('screencapture', ['-x', file]);
    else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-Command',
      `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${file}')`]);
    else execFileSync('import', ['-window', 'root', file]);
  } catch (e) { note(`desktop still ${label}`, `not taken (${short(e)})`); }
}

// --- The app ------------------------------------------------------------------------------------------------------
function profile(dir, installId) {
  mkdirSync(dir, { recursive: true });
  if (!existsSync(path.join(dir, 'unvibe-store.json'))) writeFileSync(path.join(dir, 'unvibe-store.json'), JSON.stringify({ installId }));
  return dir;
}
const P = profile(process.env.RC55_PROFILE ?? mkdtempSync(path.join(tmpdir(), 'unvibe-rc0155-')), process.env.RC55_INSTALL_ID ?? `qa-rc0155-local-${Date.now()}`);
// The app under test never gets a token this process might hold (Security NIT on S-1 0051).
const env = { ...process.env, UNVIBE_USER_DATA: P };
for (const key of Object.keys(env)) {
  if (/^(UNVIBE_ADMIN_STATS_TOKEN|UNVIBE_QA_FLAG_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_.*)$/.test(key)) delete env[key];
}
const app = await launchApp({
  exe, userData: P, env, timeout: 90000,
  args: [...(appDir ? [appDir] : []), ...(os === 'linux' ? ['--use-mock-keychain'] : []), netLogArg(netlog)],
});
const companion = await app.windowWith('companion.html', 60000);
if (!companion) throw new Error('the main window did not open');
await companion.waitForLoadState('domcontentloaded');
const version = (await companion.evaluate(() => window.unvibe.appInfo())).version;
line(`NOTE  Unvibe ${version} (${phase}), install id ${readStore(P).installId}; polls counted in the app's net log for ${host}`);

// Setup on the new profile: a name, both steps skipped (nothing is explained), then Today.
try {
  await companion.locator('.onboard__count, .topbar__title').first().waitFor({ timeout: 20000 });
  if (await companion.locator('.onboard__count').count()) {
    await companion.getByPlaceholder('Your name').fill('Sam Signin');
    await companion.getByRole('button', { name: "Let's go", exact: true }).click();
    for (const next of ['3 /', null]) {
      await companion.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 8000 });
      if (next) await companion.locator('.onboard__count').filter({ hasText: next }).waitFor({ timeout: 8000 });
    }
    await companion.locator('.onboard').waitFor({ state: 'detached', timeout: 10000 });
  }
  await companion.locator('.topbar__title').waitFor({ timeout: 10000 });
  await shot(companion, 'today');
} catch (e) { line(`FAIL  Setup on the new profile: ${short(e)}`); await shot(companion, 'setup-stuck'); }

// --- Browsers -----------------------------------------------------------------------------------------------------
// Continue with Google opens the default browser at the sign-in page (its address holds the code), so browsers are
// quit before every start and before any desktop still. Found with pgrep / tasklist, stopped with pkill / taskkill.
const BROWSERS = os === 'windows' ? ['msedge.exe', 'chrome.exe', 'firefox.exe'] : ['Safari', 'Google Chrome', 'Microsoft Edge', 'firefox'];
async function quitBrowsers() {
  for (const b of BROWSERS) {
    try {
      if (os === 'mac') execFileSync('pkill', ['-x', b], { timeout: 10000 });
      else if (os === 'windows') execFileSync('taskkill', ['/IM', b, '/F', '/T'], { timeout: 15000, stdio: 'ignore' });
    } catch { /* not running */ }
  }
  await sleep(2500);
}

// --- #354 rows ----------------------------------------------------------------------------------------------------
const POLL = '/api/v1/auth/token';
const GRACE = 1500;
const WINDOW = 30000;
const polls = (requests, from, to = Infinity) => requests.filter((r) => r.method === 'POST' && r.path === POLL && r.t > from && r.t <= to);
const CANCELLED = '[auth] device sign-in cancelled: the card closed';
const cancelledLines = () => app.output.join('').split(CANCELLED).length - 1;

/** Settings → Account & Plan → Continue with Google, until the code shows (never read). Returns the click time. */
async function startSignIn() {
  await quitBrowsers();
  await companion.evaluate(() => window.unvibe.openSettings());
  await companion.locator('.mside').getByRole('button', { name: 'Account & Plan', exact: true }).click();
  const google = companion.locator('.modal .plan-board__signin .field-btn--google');
  await google.waitFor({ timeout: 10000 });
  const t = Date.now();
  await google.click();
  await companion.locator('.modal .signin__code b').first().waitFor({ timeout: 20000 });
  // Pacing only: the verdict is read from the whole log after the app quits (the log is written in batches).
  await waitFor(() => polls(apiRequests(netlog, host), t).length >= 2, 25000, 500);
  return t;
}

const rows = [];
if (process.env.CI !== 'true' && os !== 'linux') note('#354 rows', 'skipped outside CI and a local Linux run (they start a real Google sign-in and quit the browsers)');
else {
  // Row: leave (the card closes inside a live page).
  try {
    const t0 = await startSignIn();
    const loggedBefore = cancelledLines();
    const tClose = Date.now();
    await companion.keyboard.press('Escape');
    const closed = Boolean(await waitFor(async () => (await companion.locator('.modal').count()) === 0, 5000));
    await quitBrowsers();
    // #350: the card holds the code, so the still is taken only once it is gone.
    if (closed) await shot(companion, 'after-leave');
    else note('#354 leave: no still', 'Settings did not close: the card may still show the code');
    await sleep(Math.max(0, tClose + GRACE + WINDOW - Date.now()));
    rows.push({ row: 'leave', t0, tClose, closed, logged: cancelledLines() > loggedBefore });
  } catch (e) { log(false, '#354 leave: the sign-in card closes while its code waits', short(e)); }

  // Row: ⌘W (Mac): the window that shows the code is destroyed.
  if (os === 'mac') {
    try {
      const t0 = await startSignIn();
      execFileSync('osascript', ['-e', `tell application "System Events" to set frontmost of (first process whose unix id is ${app.process.pid}) to true`], { timeout: 15000 });
      await sleep(600);
      const front = execFileSync('osascript', ['-e', 'tell application "System Events" to get unix id of first process whose frontmost is true'], { encoding: 'utf8', timeout: 15000 }).trim();
      const tClose = Date.now();
      execFileSync('osascript', ['-e', 'tell application "System Events" to keystroke "w" using command down'], { timeout: 15000 });
      const closed = Boolean(await waitFor(() => companion.isClosed(), 5000));
      const running = () => app.process.exitCode === null && app.process.signalCode === null;
      const aliveAtClose = running();
      await quitBrowsers();
      if (closed) desktop('after-command-w');
      else note('#354 N1 ⌘W: no still', 'the window did not close: the card may still show the code');
      await sleep(Math.max(0, tClose + GRACE + WINDOW - Date.now()));
      rows.push({ row: 'cmdw', t0, tClose, closed, front: front === String(app.process.pid), alive: aliveAtClose && running() });
    } catch (e) { log(false, '#354 N1 ⌘W: a real ⌘W closes the window that shows the code', short(e)); }
  } else note('#354 N1 ⌘W', `not run on ${os}: the close button minimizes there on purpose (main.ts: "Minimize instead so it always stays clickable in the taskbar"), so the card stays and its poll rightly goes on`);
}

await app.close();
await quitBrowsers();
const requests = keepSummaryAndDrop(netlog, host, path.join(out, `netlog-${phase}-${os}.txt`));
line(`NOTE  net log: ${requests.length} request(s) to ${host} kept as time, method, path and status in netlog-${phase}-${os}.txt; the raw log is deleted`);

const at = (t, from) => `${((t - from) / 1000).toFixed(1)} s`;
for (const r of rows) {
  const before = polls(requests, r.t0, r.tClose);
  const after = polls(requests, r.tClose + GRACE, r.tClose + GRACE + WINDOW);
  const seen = `${before.length} poll(s) between the click and the close (${before.length ? `the last ${at(r.tClose, before.at(-1).t)} before the close, ` : ''}status ${[...new Set(before.map((p) => p.status || '-'))].join('/') || '-'}); ${after.length} in the 30 s from 1.5 s after it${after.length ? ` (the first ${at(after[0].t, r.tClose)} after the close)` : ''}`;
  if (r.row === 'leave') {
    const detail = `${seen}; Settings closed ${r.closed}; main logged "${CANCELLED}" ${r.logged}`;
    if (phase === 'control') note(`#354 leave, control on ${version} (before the fix)`, `${detail}${after.length ? '. The polls go on after the card closed: the net log sees them' : '. No polls after the close here either: this control does not show the bug'}`);
    else log(before.length >= 2 && after.length === 0 && r.closed, '#354 leave: the sign-in card closes while its code waits, and main stops polling /auth/token', detail);
  } else {
    const detail = `${seen}; Unvibe was the front app at the key press ${r.front}; window closed ${r.closed}; app still running ${r.alive}`;
    if (phase === 'control') note(`#354 N1 ⌘W, control on ${version} (before the fix)`, `${detail}${after.length ? '. The polls go on after the window closed: the net log sees them' : '. No polls after the close here either: this control does not show the bug'}`);
    else log(before.length >= 2 && after.length === 0 && r.closed && r.front && r.alive, '#354 N1: a real ⌘W closes the main window while its code waits; the app keeps running and stops polling /auth/token', detail);
  }
}

writeFileSync(path.join(out, `report-${phase}.txt`), `Unvibe 0.1.55 RC rows, ${phase} (${os})\n\n${report.join('\n')}\n`);
process.exit(report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
