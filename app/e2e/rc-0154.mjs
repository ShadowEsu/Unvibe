// Unvibe 0.1.54 RC rows (unvibe-app's ask requests/unvibe-qa/20261117-2348-unvibe-app-rc-0154-walk.md, RC b62dfa3f),
// run by real-device-test.yml (input rc0154) on GitHub's macOS and Windows machines after the usual walkthrough.
// Like real-device.mjs it drives the installed app through Chromium's debug port (cdp-launch.mjs), saves a still per
// step and writes report.txt. Drags and double-clicks use the operating system's own pointer (mouse.swift on a Mac,
// user32 through PowerShell on Windows, xdotool on a local Linux run): the app moves its windows from PointerEvent
// screen travel, which synthetic page events don't give.
//
// NO hosted-AI call anywhere in this file. What would send (an explanation, Ask, a quiz question, Ask Vibe) is not
// done here; the profile never holds the send agreement while a capture can happen (checked before every ⌃U), and the
// one moment it holds it (row 6's "sending off" check: agree, then switch off at once, both through the app's IPC)
// comes after the last capture and presses only ⌘U, which never captures (commandUHint.ts).
//
// Env: UNVIBE_EXE, SHOTS_DIR, UNVIBE_OS (mac | windows; linux for a local run), RC_PHASE (pre | walk),
//      RC_PROFILE_UPGRADE (the profile 0.1.52 set up in the pre phase), RC_PROFILE (a new profile for the walk),
//      RC_UPGRADE_ID / RC_INSTALL_ID (qa- install ids, flagged by the workflow), MOUSE (mouse.swift binary, Mac),
//      UNVIBE_APP_DIR (local run: electron + the app's folder instead of an installed build).
// Phases: pre = with Unvibe 0.1.52 installed, set up profile U (name, onboarding skipped, dark theme) and quit;
//         walk = with the RC installed over it: profile U opens as an upgrade, then every walk-only row on profile B.
import { launchApp, readStore } from './cdp-launch.mjs';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
const appDir = process.env.UNVIBE_APP_DIR;
const os = process.env.UNVIBE_OS ?? (process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux');
const phase = process.env.RC_PHASE;
const out = path.resolve(process.env.SHOTS_DIR ?? 'rc-0154');
mkdirSync(out, { recursive: true });
if (!exe) throw new Error('Set UNVIBE_EXE');
if (phase !== 'pre' && phase !== 'walk') throw new Error('RC_PHASE must be pre or walk');

const report = [];
let n = 0;
const line = (s) => { report.push(s); console.log(s); };
const log = (ok, step, detail = '') => line(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `: ${detail}` : ''}`);
const note = (step, detail = '') => line(`NOTE  ${step}${detail ? `: ${detail}` : ''}`);
const untestable = (step, why) => line(`NOT TESTABLE  ${step}: ${why}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (e) => String(e?.message ?? e).split('\n')[0];
const finish = (code) => {
  writeFileSync(path.join(out, `report-${phase}.txt`), `Unvibe 0.1.54 RC rows, ${phase} (${os})\n\n${report.join('\n')}\n`);
  process.exit(code ?? (report.some((l) => l.startsWith('FAIL')) ? 1 : 0));
};

async function shot(page, label) {
  const file = `${String(++n).padStart(2, '0')}-${label}.png`;
  try { await page.screenshot({ path: path.join(out, file), animations: 'disabled' }); } catch (e) { note(`still ${label}`, `not taken (${short(e)})`); }
  return file;
}
/** The whole screen, so the Island and the overlay show with the app around them. */
function desktop(label) {
  const file = path.join(out, `${String(++n).padStart(2, '0')}-desktop-${label}.png`);
  try {
    if (os === 'mac') execFileSync('screencapture', ['-x', file]);
    else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-Command',
      `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${file}')`]);
    else execFileSync('import', ['-window', 'root', file]);
  } catch (e) { note(`desktop still ${label}`, `not taken (${short(e)})`); }
}

// --- The operating system's pointer --------------------------------------------------------------------------------
// Coordinates are screen points (CSS px of a window at its own scale, as window.screenX gives them). Windows works
// in physical pixels once the script is DPI-aware, so each point is multiplied by the screen's scale there.
let winScale = 1;
const ptrScript = path.join(tmpdir(), 'unvibe-rc-pointer.ps1');
if (os === 'windows') writeFileSync(ptrScript, [
  'param([string]$op, [int]$x1, [int]$y1, [int]$x2, [int]$y2, [int]$n)',
  'Add-Type @"',
  'using System; using System.Runtime.InteropServices;',
  'public class Ptr {',
  '  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();',
  '  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);',
  '  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);',
  '}',
  '"@',
  '[void][Ptr]::SetProcessDPIAware()',
  'if ($op -eq "move") { [void][Ptr]::SetCursorPos($x1, $y1) }',
  'if ($op -eq "click") { [void][Ptr]::SetCursorPos($x1, $y1); Start-Sleep -Milliseconds 120; for ($i = 0; $i -lt $n; $i++) { [Ptr]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [Ptr]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60 } }',
  'if ($op -eq "drag") {',
  '  [void][Ptr]::SetCursorPos($x1, $y1); Start-Sleep -Milliseconds 120',
  '  [Ptr]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 80',
  '  for ($i = 1; $i -le 24; $i++) { [void][Ptr]::SetCursorPos([int]($x1 + ($x2 - $x1) * $i / 24), [int]($y1 + ($y2 - $y1) * $i / 24)); Start-Sleep -Milliseconds 20 }',
  '  [Ptr]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)',
  '}',
].join('\r\n'));
const px = (v) => String(Math.round(v * (os === 'windows' ? winScale : 1)));
const pointer = {
  drag(x1, y1, x2, y2) {
    if (os === 'mac') execFileSync(process.env.MOUSE, ['drag', px(x1), px(y1), px(x2), px(y2)]);
    else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ptrScript, 'drag', px(x1), px(y1), px(x2), px(y2), '1']);
    else {
      execFileSync('xdotool', ['mousemove', px(x1), px(y1), 'sleep', '0.12', 'mousedown', '1', 'sleep', '0.08']);
      for (let i = 1; i <= 24; i++) execFileSync('xdotool', ['mousemove', px(x1 + (x2 - x1) * i / 24), px(y1 + (y2 - y1) * i / 24), 'sleep', '0.02']);
      execFileSync('xdotool', ['mouseup', '1']);
    }
  },
  click(x, y, clicks = 1) {
    if (os === 'mac') execFileSync(process.env.MOUSE, ['click', px(x), px(y), String(clicks)]);
    else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ptrScript, 'click', px(x), px(y), '0', '0', String(clicks)]);
    else execFileSync('xdotool', ['mousemove', px(x), px(y), 'sleep', '0.12', 'click', '--repeat', String(clicks), '--delay', '90', '1']);
  },
  move(x, y) {
    if (os === 'mac') execFileSync(process.env.MOUSE, ['move', px(x), px(y)]);
    else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ptrScript, 'move', px(x), px(y), '0', '0', '1']);
    else execFileSync('xdotool', ['mousemove', px(x), px(y)]);
  },
};
/** Rest the pointer on a spot first: a faded overlay wakes on a 150 ms hover and swallows a press that comes sooner. */
const hover = async (c) => { pointer.move(c.x, c.y); await sleep(450); };
/** Away from the Island and the overlay, so a hover card closes before the next measurement. */
async function parkPointer() {
  const { area } = await where(companion);
  pointer.move(area.x + area.w * 0.3, area.y + area.h * 0.5);
  await sleep(800);
}
/**
 * The overlay fades to 22 % when focus leaves it (here: the Settings clicks in the main window). A press on a faded
 * pane only wakes it and is swallowed (widget.tsx onPointerDownCapture, Security S5 on #344), as a person's first
 * click would be; so a faded pane is woken with one click on its header first, and that is reported.
 */
async function wake(panel, c) {
  const opacity = () => panel.evaluate(() => Number(getComputedStyle(document.querySelector('.ob')).opacity));
  const before = await opacity();
  if (before > 0.99) return c;
  await hover(c);
  pointer.click(c.x, c.y, 1);
  await sleep(500);
  const after = await opacity();
  note('Row 2: the overlay was faded before the drag', `opacity ${before}; after one click on its header ${after} (the click woke it and did nothing else)`);
  return centre(panel, '.ob-head__title');
}

// --- The app ------------------------------------------------------------------------------------------------------
const runtimeErrors = [];
const ours = (url) => !/^https?:/.test(url);
const watch = (page) => {
  page.on('console', (msg) => { if (msg.type() === 'error' && ours(page.url())) runtimeErrors.push(`console ${page.url().split('/').pop()}: ${msg.text()}`); });
  page.on('pageerror', (err) => { if (ours(page.url())) runtimeErrors.push(`pageerror ${page.url().split('/').pop()}: ${err.message}`); });
};
function profile(dir, installId) {
  mkdirSync(dir, { recursive: true });
  if (!existsSync(path.join(dir, 'unvibe-store.json'))) writeFileSync(path.join(dir, 'unvibe-store.json'), JSON.stringify({ installId }));
  return dir;
}
async function start(userData) {
  // The app under test never gets a founder token this process might hold.
  const env = { ...process.env, UNVIBE_USER_DATA: userData };
  // Nor any CI token (Security NIT on S-1 0051): the app needs none of them.
  for (const key of Object.keys(env)) {
    if (/^(UNVIBE_ADMIN_STATS_TOKEN|UNVIBE_QA_FLAG_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_.*)$/.test(key)) delete env[key];
  }
  const args = [...(appDir ? [appDir] : []), ...(os === 'linux' ? ['--use-mock-keychain'] : [])];
  const app = await launchApp({ exe, userData, args, env, timeout: 90000 });
  app.onWindow(watch);
  const companion = await app.windowWith('companion.html', 60000);
  if (!companion) throw new Error('the main window did not open');
  await companion.waitForLoadState('domcontentloaded');
  return { app, companion };
}
const settingsOf = (userData) => { try { return JSON.parse(readFileSync(path.join(userData, 'unvibe-settings.json'), 'utf8')); } catch { return {}; } };
/** A window's place on screen and its screen's work area, in points. */
const where = (page) => page.evaluate(() => ({
  x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight, dpr: window.devicePixelRatio,
  area: { x: screen.availLeft, y: screen.availTop, w: screen.availWidth, h: screen.availHeight },
}));
/** An element's centre on screen, in points. */
async function centre(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: window.screenX + r.left + r.width / 2, y: window.screenY + r.top + r.height / 2, left: window.screenX + r.left, top: window.screenY + r.top, w: r.width, h: r.height };
  }, selector);
}
async function waitFor(fn, ms = 5000, every = 150) {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t > ms) return v;
    await sleep(every);
  }
}
const near = (a, b, tol = 2) => Math.abs(a - b) <= tol;

// --- Phase pre: Unvibe 0.1.52 sets up profile U --------------------------------------------------------------------
if (phase === 'pre') {
  const U = profile(process.env.RC_PROFILE_UPGRADE, process.env.RC_UPGRADE_ID ?? `qa-rc0154-upgrade-local-${Date.now()}`);
  try {
    const { app, companion } = await start(U);
    const version = (await companion.evaluate(() => window.unvibe.appInfo())).version;
    await companion.locator('.onboard__count').first().waitFor({ timeout: 20000 });
    await companion.getByPlaceholder('Your name').fill('Sam Upgrade');
    await companion.getByRole('button', { name: "Let's go", exact: true }).click();
    for (const next of ['3 /', null]) {
      await companion.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 8000 });
      if (next) await companion.locator('.onboard__count').filter({ hasText: next }).waitFor({ timeout: 8000 });
    }
    await companion.locator('.onboard').waitFor({ state: 'detached', timeout: 10000 });
    await companion.evaluate(() => window.unvibe.setSettings({ theme: 'dark' }));
    await sleep(800);
    await shot(companion, `pre-${version}-today-dark`);
    const s = settingsOf(U);
    log(s.onboarded === true && s.theme === 'dark' && s.displayName === 'Sam Upgrade', `Unvibe ${version} set up profile U (onboarded, name, dark theme) before the RC goes over it`,
      `onboarded ${s.onboarded}, theme ${s.theme}, name ${s.displayName}, settingsRevision ${s.settingsRevision}`);
    writeFileSync(path.join(U, 'qa-pre-version.txt'), version);
    await app.close();
  } catch (e) { log(false, 'Unvibe 0.1.52 sets up profile U', short(e)); }
  finish();
}

// --- Phase walk ----------------------------------------------------------------------------------------------------
line('NOTE  mode: walk only: no explanation, Ask, quiz question or Ask Vibe is requested anywhere (no hosted-AI call)');

// Install over 0.1.52: profile U, set up by 0.1.52 in the pre phase, opens in the RC as the same person.
const U = process.env.RC_PROFILE_UPGRADE;
if (U && existsSync(path.join(U, 'qa-pre-version.txt'))) {
  const before = readFileSync(path.join(U, 'qa-pre-version.txt'), 'utf8').trim();
  let up = null;
  try {
    up = await start(U);
    const { companion } = up;
    const version = (await companion.evaluate(() => window.unvibe.appInfo())).version;
    // Setup skipped the own code, so the next open shows the own-code step (OwnCodeWelcome, main/ownCodeStep.ts) by
    // design; its Not now goes to Today. Numbered setup again (.onboard__count) would be the upgrade losing the person.
    await companion.locator('.topbar__title, .onboard--welcome, .onboard__count').first().waitFor({ timeout: 20000 });
    await sleep(500);
    const setupAgain = await companion.locator('.onboard__count').count();
    const welcome = await companion.locator('.onboard--welcome').count();
    const theme = await companion.evaluate(() => document.documentElement.dataset.theme);
    await shot(companion, 'upgrade-first-launch');
    if (welcome) {
      await companion.locator('.onboard--welcome .onboard__forward').getByRole('button', { name: 'Not now', exact: true }).click();
      note(`Install over ${before}: first open`, "the own-code step (\"Welcome back. Try it on your own code.\") shows, as on any next open after setup skipped the own code; Not now");
    }
    await companion.locator('.topbar__title').waitFor({ timeout: 10000 });
    const title = (await companion.locator('.topbar__title').innerText()).trim();
    const s = settingsOf(U);
    await shot(companion, 'upgrade-today');
    log(version !== before && setupAgain === 0 && title === 'Today' && s.onboarded === true && s.theme === 'dark' && theme === 'dark' && s.displayName === 'Sam Upgrade',
      `Install over ${before}: ${version} opens as the same person (no setup again, Today, dark theme and name kept)`,
      `version ${version}, numbered setup shown ${setupAgain > 0}, own-code step ${welcome > 0}, page ${title}, onboarded ${s.onboarded}, theme ${s.theme}/${theme}, name ${s.displayName}, density ${s.density ?? 'unset'}`);
  } catch (e) {
    const shows = up ? await up.companion.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 240)).catch(() => '') : '';
    log(false, `Install over ${before}: the RC opens profile U`, `${short(e)}; the window shows "${shows}"`);
    if (up) await shot(up.companion, 'upgrade-stuck');
  }
  await up?.app.close().catch(() => {});
} else note('Install over 0.1.52', 'no profile from the pre phase (a local run, or the pre phase failed: see report-pre.txt)');

const B = profile(process.env.RC_PROFILE ?? mkdtempSync(path.join(tmpdir(), 'unvibe-rc0154-')), process.env.RC_INSTALL_ID ?? `qa-rc0154-local-${Date.now()}`);
let { app, companion } = await start(B);
const version = (await companion.evaluate(() => window.unvibe.appInfo())).version;
line(`NOTE  Unvibe ${version}, install id ${readStore(B).installId}`);
if (os === 'windows') winScale = (await where(companion)).dpr || 1;
const { shortcut } = await companion.evaluate(() => window.unvibe.appInfo());
const steps = os === 'windows' ? 3 : 4;

// Rows 7 and 5: Hello and Try it at the window minimum, 1280x720 and the default size. The first-run window is
// maximized on the runner's 1024x768 screen, so each size is emulated through CDP (as the 0.1.53 walk did), then cleared.
const SIZES = [[980, 620], [1280, 720], [1180, 780]];
async function fit(step, label) {
  const cdp = await companion.context().newCDPSession(companion);
  try {
    for (const [w, h] of SIZES) {
      try {
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 0, mobile: false });
        await sleep(400);
        const r = await companion.evaluate(() => {
          const btn = document.querySelector('.onboard__foot .onboard__primary, .onboard__foot .onboard__quiet');
          const root = document.querySelector('.onboard');
          if (!btn || !root) return null;
          const b = btn.getBoundingClientRect();
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          const scrolled = [document.scrollingElement, ...document.querySelectorAll('.onboard, .onboard *')].filter((el) => el && el.scrollTop > 0).length;
          return { label: btn.textContent.trim(), top: b.top, bottom: b.bottom, vh: innerHeight, vw: innerWidth, onTop: Boolean(hit) && (hit === btn || btn.contains(hit)), scrolled, overflow: root.scrollHeight - root.clientHeight };
        });
        await shot(companion, `setup-${step}-${w}x${h}`);
        const ok = Boolean(r) && r.top >= 0 && r.bottom <= r.vh && r.onTop && r.scrolled === 0;
        log(ok, `${label} at ${w}x${h}: the forward button is fully in view with nothing scrolled`,
          r ? `'${r.label}' spans ${Math.round(r.top)}-${Math.round(r.bottom)} px of ${r.vw}x${r.vh}; on top ${r.onTop}; scrolled ${r.scrolled}; .onboard overflow ${r.overflow} px` : 'no forward button');
      } catch (e) { log(false, `${label} at ${w}x${h}`, short(e)); }
    }
  } finally {
    await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await cdp.detach().catch(() => {});
    await sleep(300);
  }
}

/** Mac: Unvibe's own main window in front, so a real ⌘U reaches it (the hint watches only Unvibe's windows). */
function unvibeToFront() {
  execFileSync('osascript', ['-e', `tell application "System Events" to set frontmost of (first process whose unix id is ${app.process.pid}) to true`], { timeout: 15000 });
}
/** The Island's notice text, if one shows. */
async function islandNotice() {
  const bar = app.windows().find((w) => w.url().includes('bar.html') && !w.isClosed());
  if (!bar) return null;
  return bar.evaluate(() => (document.querySelector('.island--notice .island__notice, .island__note')?.textContent ?? '').trim()).catch(() => null);
}
const HINT = 'The shortcut is Control+U, not Command+U.';
let lastHintAt = 0;
async function commandU(label, expectHint) {
  unvibeToFront();
  await sleep(500);
  execFileSync('osascript', ['-e', 'tell application "System Events" to keystroke "u" using command down'], { timeout: 15000 });
  const seen = await waitFor(async () => (await islandNotice()) === HINT, expectHint ? 4000 : 3500);
  if (seen) lastHintAt = Date.now();
  desktop(`command-u-${label}`);
  return Boolean(seen);
}

try {
  await companion.locator('.onboard__count').filter({ hasText: `1 / ${steps}` }).waitFor({ timeout: 20000 });
  await shot(companion, 'hello');
  await fit('1-hello', "Row 7: Hello's \"Let's go\"");
  await companion.getByPlaceholder('Your name').fill('Sam Test');
  await companion.getByRole('button', { name: "Let's go", exact: true }).click();
  await companion.locator('.onboard__count').filter({ hasText: `2 / ${steps}` }).waitFor({ timeout: 8000 });
  await shot(companion, 'try-it');
  // Row 5: the keys a person must hold.
  const keys = await companion.evaluate(() => ({
    caps: [...document.querySelectorAll('.onboard__keys .onboard__keys-caps kbd')].map((k) => k.textContent.trim()),
    capsLabel: document.querySelector('.onboard__keys .onboard__keys-caps')?.getAttribute('aria-label') ?? null,
    line: document.querySelector('.onboard__keys-line')?.textContent.trim() ?? null,
    command: /Command/.test(document.querySelector('.onboard')?.textContent ?? ''),
  }));
  if (os === 'mac') {
    log(JSON.stringify(keys.caps) === JSON.stringify(['⌃ control', 'U']) && keys.line === 'Hold Control, not Command, and press U.',
      'Row 5 (Mac): Try it shows the keycaps "⌃ control" + "U" and "Hold Control, not Command, and press U."', `keycaps ${JSON.stringify(keys.caps)}; line "${keys.line}"`);
  } else {
    const expected = shortcut.split('+').map((k) => (/^(Control|CommandOrControl)$/.test(k) ? 'Ctrl' : k));
    log(JSON.stringify(keys.caps) === JSON.stringify(expected) && keys.line === null && !keys.command,
      `Row 5 (${os}): Try it shows the person's own shortcut keys (${shortcut}) and no Command line`, `keycaps ${JSON.stringify(keys.caps)} (label ${keys.capsLabel}); keys line ${JSON.stringify(keys.line)}; "Command" anywhere in setup ${keys.command}`);
  }
  await fit('2-try-it', 'Row 5: Try it before explaining ("Skip for now")');
  note('Row 5: Try it explained state (Next in view at 1280x720 and the default size)', 'needs the sample explained (a hosted call): the AI run');
  // Row 6 (Mac), sending on: ⌘U with the sample's code selected in Unvibe's own window.
  if (os === 'mac') {
    try {
      await companion.evaluate(() => {
        const code = document.querySelector('.onboard__editor');
        const range = document.createRange();
        range.selectNodeContents(code);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      });
      const shown = await commandU('sending-on', true);
      log(shown, 'Row 6 (Mac, Security A1): ⌘U on selected code in Unvibe, sending on (no agreement switched off): the Island says the shortcut is Control+U', shown ? `"${HINT}"` : `Island notice: "${await islandNotice()}"`);
      await shot(companion, 'try-it-after-command-u');
    } catch (e) { log(false, 'Row 6 (Mac): ⌘U hint, sending on', short(e)); }
  }
  await companion.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await companion.locator('.onboard__count').filter({ hasText: `3 / ${steps}` }).waitFor({ timeout: 8000 });
  await companion.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await companion.locator('.onboard').waitFor({ state: 'detached', timeout: 10000 });
  await companion.locator('.topbar__title').filter({ hasText: 'Today' }).waitFor({ timeout: 15000 });
  log(true, 'Setup walked (name, both steps skipped): Today opens');
} catch (e) { log(false, 'Setup', short(e)); await shot(companion, 'setup-stuck'); }

// Row 15 (walk part): Today has no scrollbar at the default size (1180x780, emulated) or in the runner's window.
async function todayFits(label) {
  return companion.evaluate(() => {
    const page = document.querySelector('.layout .content__main > .page.page--home');
    return page ? { scroll: page.scrollHeight, client: page.clientHeight, vw: innerWidth, vh: innerHeight } : null;
  }).then((r) => {
    log(Boolean(r) && r.scroll <= r.client, `Row 15: Today has nothing to scroll ${label}`, r ? `scrollHeight ${r.scroll}, clientHeight ${r.client}, viewport ${r.vw}x${r.vh}` : 'no .page--home');
  });
}
try {
  await shot(companion, 'today');
  const cdp = await companion.context().newCDPSession(companion);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 780, deviceScaleFactor: 0, mobile: false });
  await sleep(500);
  await shot(companion, 'today-1180x780');
  await todayFits('at the default size (1180x780)');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await cdp.detach();
  await sleep(400);
  const real = await companion.evaluate(() => `${innerWidth}x${innerHeight}`);
  if (real !== '1180x780') note('Today in the runner\'s own window', `${real} (the default 1180x780 is emulated above; the runner screen is smaller)`);
} catch (e) { log(false, 'Row 15: Today has no scrollbar', short(e)); }

// Row 13: the palette has no blur behind it; Share's header box; the sign-in card's thin border.
try {
  await companion.keyboard.press(os === 'mac' ? 'Meta+K' : 'Control+K');
  const overlay = companion.locator('.search-overlay');
  await overlay.waitFor({ timeout: 5000 });
  await sleep(300);
  const st = await companion.evaluate(() => { const s = getComputedStyle(document.querySelector('.search-overlay')); return { blur: s.backdropFilter, bg: s.backgroundColor }; });
  await shot(companion, 'palette');
  log(st.blur === 'none', 'Row 13: the palette (⌘K / Ctrl+K) has no blur behind it', `backdrop-filter ${st.blur}; background ${st.bg}`);
  await companion.keyboard.press('Escape');
  await overlay.waitFor({ state: 'detached', timeout: 5000 });
} catch (e) { log(false, 'Row 13: the palette has no blur behind it', short(e)); }
try {
  await companion.locator('.side').getByRole('button', { name: 'Share', exact: true }).click();
  await companion.locator('.gift-view > .page-head').waitFor({ timeout: 10000 });
  await sleep(400);
  const st = await companion.evaluate(() => {
    const css = (sel) => { const el = document.querySelector(sel); if (!el) return null; const s = getComputedStyle(el); return { border: `${s.borderTopWidth} ${s.borderTopStyle}`, radius: s.borderTopLeftRadius, padding: s.paddingTop, shadow: s.boxShadow, bg: s.backgroundColor }; };
    return { head: css('.gift-view > .page-head'), card: css('section.gift-signin') };
  });
  await shot(companion, 'share');
  log(Boolean(st.head) && st.head.border === '1px solid' && st.head.padding === '20px', 'Row 13: Share shows its header box', JSON.stringify(st.head));
  log(Boolean(st.card) && st.card.border === '1px solid' && st.card.shadow === 'none', 'Row 13: the sign-in card has a 1 px border and no drop shadow', JSON.stringify(st.card));
} catch (e) { log(false, 'Row 13: Share header box and sign-in card', short(e)); }

// Row 14: Settings › Account & Plan › Continue with Google: the code shows in the app, and when the browser opens.
// The browser is watched from the operating system (a process, then a window) while the app's code is awaited; the
// probes run as child processes without blocking, so the code's time is measured while they run. The walkthrough's
// own sign-in left a browser open, so browsers are quit first: the window that counts is the one this click opens.
// Run W (44271332415) showed the first probe blind on both systems and its Mac quit (tell application "Firefox")
// starting Firefox's Gatekeeper prompt, so processes are now found with pgrep / tasklist and stopped with pkill /
// taskkill; only System Events is asked about windows, by process name, which starts nothing.
const run = promisify(execFile);
const BROWSERS = os === 'windows' ? ['msedge.exe', 'chrome.exe', 'firefox.exe'] : ['Safari', 'Google Chrome', 'Microsoft Edge', 'firefox'];
async function browserState() {
  try {
    if (os === 'mac') {
      const rows = [];
      for (const b of BROWSERS) {
        if (!await run('pgrep', ['-x', b]).then(() => true, () => false)) continue;
        const count = await run('osascript', ['-e', `tell application "System Events" to count windows of process "${b}"`], { encoding: 'utf8', timeout: 5000 })
          .then(({ stdout }) => Number(stdout.trim()) || 0, () => 0);
        rows.push(`${b}:${count}`);
      }
      return { process: rows.length > 0, window: rows.some((r) => Number(r.split(':').pop()) > 0), what: rows.join(' ') };
    }
    if (os === 'windows') {
      // tasklist /v: the last CSV column is the window title, "N/A" for a process with no window.
      const { stdout } = await run('tasklist', ['/v', '/fo', 'csv', '/nh'], { encoding: 'utf8', timeout: 10000 });
      const rows = stdout.split(/\r?\n/).filter((l) => BROWSERS.some((b) => l.toLowerCase().startsWith(`"${b}"`)));
      const titles = rows.map((l) => l.replace(/"\s*$/, '').split('","').pop()).filter((t) => t && t !== 'N/A');
      return { process: rows.length > 0, window: titles.length > 0, what: titles.slice(0, 2).join(' | ') };
    }
  } catch { /* none yet */ }
  return { process: false, window: false, what: '' };
}
async function quitBrowsers() {
  for (const b of BROWSERS) {
    try {
      if (os === 'mac') execFileSync('pkill', ['-x', b], { timeout: 10000 });
      else if (os === 'windows') execFileSync('taskkill', ['/IM', b, '/F', '/T'], { timeout: 15000, stdio: 'ignore' });
    } catch { /* not running */ }
  }
  await sleep(2500);
}
/** The next open shows the own-code step (setup skipped the own code); its Not now goes to Today. */
async function pastWelcome() {
  const notNow = companion.locator('.onboard--welcome .onboard__forward').getByRole('button', { name: 'Not now', exact: true });
  if (await notNow.waitFor({ timeout: 8000 }).then(() => true, () => false)) await notNow.click();
  await companion.locator('.topbar__title').waitFor({ timeout: 10000 });
}
// The repo is public and the Actions log is readable while the run goes, so the sign-in code is never printed (only
// its length; the stills upload after the run, when the app is gone). The app polls for approval for up to 10 min and
// has no cancel, so it is quit right after this row (that ends the poll), the browsers too, and it is opened again
// (Security R1, requests/security/20261118-0051-…). Outside CI the row is skipped: it would start a real sign-in in
// the developer's own browser and quit their browsers.
if (process.env.CI !== 'true') note('Row 14', 'skipped outside CI (it starts a real Google sign-in and quits the browsers)');
else {
  let started = false;
  try {
    let before = await browserState();
    if (before.window) { await quitBrowsers(); before = await browserState(); }
    if (before.window) note('Row 14', `a browser window is still open before the click (${before.what})`);
    await companion.evaluate(() => window.unvibe.openSettings());
    await companion.locator('.mside').getByRole('button', { name: 'Account & Plan', exact: true }).click();
    const google = companion.locator('.modal .plan-board__signin .field-btn--google');
    await google.waitFor({ timeout: 10000 });
    await shot(companion, 'settings-account-signed-out');
    let browserProcessAt = 0;
    let browserWindowAt = 0;
    let lastMiss = 0; // when the last probe that found no browser window started
    let codeAt = 0;
    const clickedAt = Date.now();
    started = true;
    await google.click();
    const watcher = (async () => {
      while (!browserWindowAt && Date.now() - clickedAt < 20000) {
        const t = Date.now();
        const b = await browserState();
        if (b.process && !browserProcessAt) browserProcessAt = t;
        if (b.window) browserWindowAt = Date.now(); else lastMiss = t;
        await sleep(100);
      }
    })();
    await companion.locator('.modal .signin__code b').first().waitFor({ timeout: 20000 });
    codeAt = Date.now();
    const code = (await companion.locator('.modal .signin__code b').first().innerText()).trim();
    const shown = code ? `a code (${code.length} characters)` : 'no code';
    // No still here: the app and the browser both show the code (the lead's note on the walkthrough's artifact).
    await watcher;
    const rel = (t) => (t ? `${t - clickedAt} ms` : 'not seen in 20 s');
    if (!browserWindowAt || before.window) {
      note('Row 14: Continue with Google shows the device code in the app; the browser window that click opened was not observed',
        `${shown} at ${rel(codeAt)}; browser process ${rel(browserProcessAt)}, window ${rel(browserWindowAt)} after the click; open before the click: ${before.window}`);
      log(Boolean(code), 'Row 14: the device code shows in the app after Continue with Google (order against the browser: see the NOTE)', `${shown} at ${rel(codeAt)}`);
    } else if (code && codeAt <= lastMiss) {
      // Proven: a probe that started after the code was on screen still found no browser window.
      log(true, 'Row 14: Continue with Google shows the device code in the app before the browser window opens',
        `${shown} at ${rel(codeAt)}; no browser window at ${rel(lastMiss)}; first window seen ${rel(browserWindowAt)} after the click (browser process ${rel(browserProcessAt)})`);
    } else if (!code || browserWindowAt < codeAt) {
      log(false, 'Row 14: Continue with Google shows the device code in the app before the browser window opens', `${shown} at ${rel(codeAt)}; a browser window was already seen ${rel(browserWindowAt)} after the click`);
    } else note('Row 14: inconclusive', `${shown} at ${rel(codeAt)}; the window appeared between ${rel(lastMiss)} and ${rel(browserWindowAt)}, so the order is within one probe`);
  } catch (e) { log(false, 'Row 14: sign-in code before the browser', short(e)); await shot(companion, 'sign-in-stuck'); }
  if (started) {
    try {
      await app.close();
      await quitBrowsers();
      ({ app, companion } = await start(B));
      await pastWelcome();
      note('Row 14', 'the app was quit right after this row (that ends its sign-in poll; nothing was approved), the browsers were quit, and the app was opened again');
    } catch (e) { log(false, 'Row 14: quit and reopen after the sign-in code', short(e)); }
  }
}

// Row 11: Density in the main window: Comfortable → Compact makes the sidebar and Settings rows smaller, at once,
// light and dark; it is saved (and checked again after the restart in row 1).
const sizes = () => companion.evaluate(() => {
  const m = (sel) => { const el = document.querySelector(sel); if (!el) return null; const s = getComputedStyle(el); return { h: Math.round(el.getBoundingClientRect().height), font: s.fontSize }; };
  return { density: document.documentElement.dataset.density, side: m('.layout .nav button'), tab: m('.modal .mside button'), label: m('.modal .setrow .sl'), row: m('.m-row') };
});
async function densityButton(label) {
  await companion.locator('.location-grid[aria-label="Density"]').getByRole('button', { name: label, exact: true }).click();
  await sleep(500);
}
try {
  await companion.evaluate(() => window.unvibe.openSettings());
  await companion.locator('.mside').getByRole('button', { name: 'General', exact: true }).click();
  await companion.locator('.location-grid[aria-label="Density"]').waitFor({ timeout: 8000 });
  const comfy = await sizes();
  await shot(companion, 'density-comfortable-light');
  await densityButton('Compact');
  const compact = await sizes();
  await shot(companion, 'density-compact-light');
  await companion.evaluate(() => window.unvibe.setSettings({ theme: 'dark' }));
  await sleep(700);
  await shot(companion, 'density-compact-dark');
  await densityButton('Comfortable');
  await shot(companion, 'density-comfortable-dark');
  await densityButton('Compact');
  await companion.evaluate(() => window.unvibe.setSettings({ theme: 'light' }));
  await sleep(500);
  const smaller = (a, b) => Boolean(a && b) && b.h < a.h && parseFloat(b.font) < parseFloat(a.font);
  const saved = settingsOf(B).density;
  log(comfy.density === 'comfortable' && compact.density === 'compact' && smaller(comfy.side, compact.side) && smaller(comfy.tab, compact.tab) && saved === 'compact',
    'Row 11: Density › Compact makes the sidebar and Settings rows smaller at once (light and dark stills), and is saved',
    `sidebar ${JSON.stringify(comfy.side)} → ${JSON.stringify(compact.side)}; settings tab ${JSON.stringify(comfy.tab)} → ${JSON.stringify(compact.tab)}; label ${JSON.stringify(comfy.label)} → ${JSON.stringify(compact.label)}; saved ${saved}`);
  if (!compact.row) note('Row 11: lists (.m-row)', 'no list rows on a new profile; the AI run checks lists, the Ask thread, a lesson and the quiz');
  await companion.getByRole('button', { name: 'Close settings', exact: true }).click();
  await companion.getByRole('dialog', { name: 'Settings', exact: true }).waitFor({ state: 'detached', timeout: 5000 });
} catch (e) { log(false, 'Row 11: Density in the main window', short(e)); await shot(companion, 'density-stuck'); }

// --- Row 2: the overlay, opened by the global shortcut in another app on a profile with no send agreement ---------
// The panel shows the agreement form (never ticked), with the same header as every other state (widget.tsx), so its
// drag, reopen, double-click, arrow keys and off-screen drop are walked here at 0 calls; the AI run repeats the drag
// on a finished explanation.
const sampleFile = path.join(tmpdir(), 'unvibe-rc0154-sample.js');
writeFileSync(sampleFile, 'function selectedTotal(items) {\n  return items.reduce((sum, item) => sum + item.price * item.qty, 0);\n}');
function noAgreement() {
  if (existsSync(path.join(B, 'unvibe-consent.json'))) {
    const c = JSON.parse(readFileSync(path.join(B, 'unvibe-consent.json'), 'utf8'));
    const live = (c.records ?? []).some((r) => !r.revokedAt);
    if (live) throw new Error('this profile holds a send agreement, so the shortcut would send the selection; refused before the keystroke');
  }
}
let editorOpen = false;
async function shortcutInEditor() {
  noAgreement();
  if (os === 'mac') {
    if (!editorOpen) { execFileSync('open', ['-a', 'TextEdit', sampleFile]); await sleep(3000); editorOpen = true; }
    execFileSync('osascript', ['-e', 'tell application "TextEdit" to activate', '-e', 'delay 1', '-e', 'tell application "System Events" to keystroke "a" using command down'], { timeout: 20000 });
    await sleep(600);
    execFileSync('osascript', ['-e', 'tell application "System Events" to keystroke "u" using control down'], { timeout: 15000 });
  } else if (os === 'windows') {
    if (!editorOpen) { execFile('notepad', [sampleFile]); await sleep(3000); editorOpen = true; }
    const keys = `${/Control|CommandOrControl/i.test(shortcut) ? '^' : ''}${/Alt/i.test(shortcut) ? '%' : ''}${/Shift/i.test(shortcut) ? '+' : ''}u`;
    const focus = path.join(tmpdir(), 'unvibe-rc-focus.ps1');
    writeFileSync(focus, [
      'param([string]$keys)',
      'Add-Type @"',
      'using System; using System.Text; using System.Runtime.InteropServices;',
      'public class Fg {',
      '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
      '  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);',
      '  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);',
      '  [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, UIntPtr e);',
      '  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder b, int n);',
      '}',
      '"@',
      'function Title { $b = New-Object System.Text.StringBuilder 512; [void][Fg]::GetWindowText([Fg]::GetForegroundWindow(), $b, 512); $b.ToString() }',
      '$p = $null',
      'for ($i = 0; $i -lt 40 -and -not $p; $i++) { $p = Get-Process notepad -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*unvibe-rc0154-sample*" } | Select-Object -First 1; if (-not $p) { Start-Sleep -Milliseconds 250 } }',
      'if (-not $p) { throw "The Notepad window with the sample was not found" }',
      'for ($i = 0; $i -lt 10 -and (Title) -notlike "*unvibe-rc0154-sample*"; $i++) {',
      '  [Fg]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [Fg]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)',
      '  [void][Fg]::ShowWindow($p.MainWindowHandle, 9); [void][Fg]::SetForegroundWindow($p.MainWindowHandle); Start-Sleep -Milliseconds 300',
      '}',
      'if ((Title) -notlike "*unvibe-rc0154-sample*") { throw "Notepad is not the foreground window (foreground: $(Title))" }',
      '$w = New-Object -ComObject WScript.Shell',
      "$w.SendKeys('^a'); Start-Sleep -Milliseconds 500",
      'if ((Title) -notlike "*unvibe-rc0154-sample*") { throw "Notepad lost focus before the shortcut (foreground: $(Title))" }',
      '$w.SendKeys($keys)',
    ].join('\r\n'));
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', focus, '-keys', keys], { encoding: 'utf8', timeout: 30000 });
  } else {
    // Local run: no other app; the panel opens through the same IPC the Island's Understand uses.
    await companion.evaluate(() => window.unvibe.reviewSelection());
  }
  const panel = await waitFor(async () => app.windows().find((w) => w.url().includes('widget.html') && !w.isClosed()), 20000, 250);
  if (!panel) throw new Error('the overlay did not open');
  await panel.locator('.ob.ob--aiConsent .consent-form').waitFor({ timeout: 20000 });
  await sleep(600);
  if (await panel.locator('.ob-answer').count()) throw new Error('an answer is streaming in a walk-only run');
  return panel;
}
const spotOf = () => { const s = settingsOf(B).overlaySpots ?? {}; const keys = Object.keys(s); return keys.length ? s[keys[0]] : null; };
let panel = null;
try {
  panel = await shortcutInEditor();
  const boxes = panel.locator('.consent-form input[type="checkbox"]');
  const ticked = await boxes.evaluateAll((els) => els.filter((e) => e.checked).length);
  log((await boxes.count()) === 3 && ticked === 0, `Global shortcut (${shortcut}) opens the overlay on the send agreement (3 unticked boxes, never ticked here)`);
  await shot(panel, 'overlay-agreement');
  desktop('overlay-agreement');
  // Row 11, overlay: Compact applies on open, and switching density is live in the open overlay.
  try {
    // The agreement form has no density-sized text of its own (that is the explanation's: .ob-meta, .ob-answer,
    // .ob-question, measured in the AI run); here the page's data-density must follow without a reload.
    const metaFont = () => panel.evaluate(() => ({ density: document.documentElement.dataset.density, mark: window.__qaMark === 1 }));
    await panel.evaluate(() => { window.__qaMark = 1; });
    const open = await metaFont();
    await companion.evaluate(() => window.unvibe.openSettings());
    await companion.locator('.mside').getByRole('button', { name: 'General', exact: true }).click();
    await densityButton('Comfortable');
    const after = await waitFor(async () => { const m = await metaFont(); return m.density === 'comfortable' ? m : null; }, 3000);
    await shot(panel, 'overlay-agreement-comfortable');
    await densityButton('Compact');
    const back = await waitFor(async () => { const m = await metaFont(); return m.density === 'compact' ? m : null; }, 3000);
    await shot(panel, 'overlay-agreement-compact');
    await companion.getByRole('button', { name: 'Close settings', exact: true }).click();
    log(open.density === 'compact' && Boolean(after) && Boolean(back) && after.mark && back.mark,
      'Row 11: the open overlay follows Density live (Compact on open, Comfortable and back without reloading)',
      `on open ${JSON.stringify(open)}; → Comfortable ${JSON.stringify(after)}; → Compact ${JSON.stringify(back)}`);
  } catch (e) { log(false, 'Row 11: Density live in the open overlay', short(e)); }

  // Drag by the header with the real pointer, toward the screen's centre.
  const p0 = await where(panel);
  const head = await wake(panel, await centre(panel, '.ob-head__title'));
  const dx = p0.x + p0.w / 2 > p0.area.x + p0.area.w / 2 ? -220 : 220;
  const dy = p0.y + p0.h / 2 > p0.area.y + p0.area.h / 2 ? -90 : 90;
  await hover(head);
  pointer.drag(head.x, head.y, head.x + dx, head.y + dy);
  await sleep(800);
  const p1 = await where(panel);
  const spot1 = spotOf();
  await shot(panel, 'overlay-dragged');
  desktop('overlay-dragged');
  log(near(p1.x - p0.x, dx, 20) && near(p1.y - p0.y, dy, 20) && Boolean(spot1) && near(spot1.x, p1.x) && near(spot1.y, p1.y),
    'Row 2: the overlay moves by its header (real pointer) and its spot is saved', `from ${p0.x},${p0.y} by ${dx},${dy} → ${p1.x},${p1.y}; saved ${JSON.stringify(spot1)}`);

  // Tab to the header (as a person does: from nothing focused, Tab until the header has focus; only Tab is pressed on
  // the way, so no box is ticked), then the arrow keys: 16 px a step, saved half a second after the last key, toward
  // the screen's centre (away from the edges the panel is clamped to).
  const kx = p1.x + p1.w / 2 > p1.area.x + p1.area.w / 2 ? 'ArrowLeft' : 'ArrowRight';
  const ky = p1.y + p1.h / 2 > p1.area.y + p1.area.h / 2 ? 'ArrowUp' : 'ArrowDown';
  await panel.evaluate(() => document.activeElement?.blur());
  let tabs = 0;
  while (!(await panel.evaluate(() => document.activeElement?.matches('.ob-head') ?? false))) {
    if (++tabs > 20) throw new Error('Tab never reached the overlay header in 20 presses');
    await panel.keyboard.press('Tab');
  }
  note('Row 2: the overlay header', `reached with Tab (${tabs} press${tabs === 1 ? '' : 'es'} from nothing focused)`);
  await panel.keyboard.press(kx);
  await panel.keyboard.press(kx);
  await panel.keyboard.press(ky);
  await sleep(900);
  const p2 = await where(panel);
  const spot2 = spotOf();
  const ex = kx === 'ArrowRight' ? 32 : -32;
  const ey = ky === 'ArrowDown' ? 16 : -16;
  log(p2.x - p1.x === ex && p2.y - p1.y === ey && Boolean(spot2) && spot2.x === p2.x && spot2.y === p2.y,
    `Row 2: with the header focused, the arrow keys move the overlay 16 px a step (${kx} ×2, ${ky})`, `${p1.x},${p1.y} → ${p2.x},${p2.y}; saved ${JSON.stringify(spot2)}`);

  // Reopen: close the overlay, press the shortcut again: it comes back at the saved spot.
  await panel.locator('.ob-head__close').click();
  await waitFor(async () => panel.isClosed(), 5000);
  panel = await shortcutInEditor();
  const p3 = await where(panel);
  await shot(panel, 'overlay-reopened');
  desktop('overlay-reopened');
  log(near(p3.x, p2.x) && near(p3.y, p2.y), 'Row 2: closed and reopened, the overlay comes back at its saved spot', `saved ${p2.x},${p2.y}; reopened at ${p3.x},${p3.y}`);

  // Double-click the header: back beside the pointer of the last shortcut press, and the spot is forgotten.
  const head3 = await centre(panel, '.ob-head__title');
  await hover(head3);
  pointer.click(head3.x, head3.y, 2);
  await sleep(900);
  const p4 = await where(panel);
  const spot4 = spotOf();
  await shot(panel, 'overlay-double-clicked');
  desktop('overlay-double-clicked');
  log(spot4 === null && (!near(p4.x, p3.x) || !near(p4.y, p3.y)) && p4.x >= p4.area.x && p4.x + p4.w <= p4.area.x + p4.area.w,
    'Row 2: a double-click on the header puts the overlay back beside the selection point and forgets the spot', `${p3.x},${p3.y} → ${p4.x},${p4.y}; saved spots ${JSON.stringify(settingsOf(B).overlaySpots ?? {})}`);

  // Off-screen drop: dragged two thirds past the right edge, it lands fully on screen (12 px in).
  const head4 = await centre(panel, '.ob-head__title');
  const targetX = p4.area.x + p4.area.w - p4.w / 3 + (head4.x - p4.x);
  await hover(head4);
  pointer.drag(head4.x, head4.y, targetX, head4.y);
  await sleep(900);
  const p5 = await where(panel);
  await shot(panel, 'overlay-dropped-off-screen');
  desktop('overlay-dropped-off-screen');
  const right = p5.area.x + p5.area.w;
  log(p5.x + p5.w <= right - 11 && p5.x >= p5.area.x, 'Row 2: dropped partly off screen, the overlay lands fully on screen',
    `dropped toward x ${Math.round(targetX - (head4.x - p4.x))} (width ${p5.w}); landed at ${p5.x},${p5.y}, right edge ${p5.x + p5.w} of ${right}`);
  await panel.locator('.ob-head__close').click();
  await waitFor(async () => panel.isClosed(), 5000);
} catch (e) { log(false, 'Row 2: the overlay', short(e)); if (panel && !panel.isClosed()) await shot(panel, 'overlay-stuck'); desktop('overlay-stuck'); }
untestable('Row 3 (Mac, Security A3): overlay on a second display, display unplugged', 'a hosted runner has one display; unvibe-app\'s evidence covers the code path');
untestable('Row 4 (Mac): first click with the editor focused (acceptFirstMouse), faded first click', 'needs a real Mac\'s window focus and a human pointer (a synthetic press within 150 ms of entering is always swallowed); the code path is in widget.tsx:1041-1063');

// --- Row 1: the Island -----------------------------------------------------------------------------------------------
const bar = () => app.windows().find((w) => w.url().includes('bar.html') && !w.isClosed());
const islandSpot = () => { const s = settingsOf(B).islandSpots ?? {}; const keys = Object.keys(s); return keys.length ? s[keys[0]] : null; };
async function pill() {
  const b = bar();
  if (!b) return null;
  const c = await centre(b, '.island .island__compact');
  const cls = await b.evaluate(() => document.querySelector('.island')?.className ?? '');
  const title = await b.evaluate(() => document.querySelector('.island .island__compact')?.getAttribute('title') ?? null);
  const area = (await where(b)).area;
  return c ? { ...c, cls, title, area } : null;
}
async function islandLocation(label) {
  await companion.evaluate(() => window.unvibe.openSettings());
  await companion.locator('.mside').getByRole('button', { name: 'Island', exact: true }).click();
  await companion.locator('.location-grid[aria-label="Island location"]').getByRole('button', { name: label, exact: true }).click();
  await sleep(1200);
  await companion.getByRole('button', { name: 'Close settings', exact: true }).click();
  await sleep(600);
}
try {
  if (os === 'mac') {
    const top = await waitFor(pill, 8000);
    if (!top) throw new Error('no Island window');
    const t0 = { x: top.left, y: top.top };
    pointer.drag(top.x, top.y, top.x - 200, top.y + 160);
    await sleep(900);
    const t1 = await pill();
    desktop('island-top-drag-attempt');
    log(/island--attached/.test(top.cls) && top.title === null && near(t1.left, t0.x) && near(t1.top, t0.y),
      'Row 1 (Mac): the Top (notch) Island does not drag', `classes "${top.cls}", title ${top.title}; before ${t0.x},${t0.y}, after a real drag ${t1.left},${t1.top}`);
    await islandLocation('Bottom');
  }
  await parkPointer();
  const p = await waitFor(async () => { const q = await pill(); return q && /island--movable/.test(q.cls) ? q : null; }, 8000);
  if (!p) throw new Error(`the Island is not floating (${(await pill())?.cls ?? 'no Island'})`);
  desktop('island-floating');
  const ddx = p.x > p.area.x + p.area.w / 2 ? -200 : 200;
  const ddy = p.y > p.area.y + p.area.h / 2 ? -150 : 150;
  pointer.drag(p.x, p.y, p.x + ddx, p.y + ddy);
  await sleep(1000);
  await parkPointer();
  const q = await pill();
  const s1 = islandSpot();
  desktop('island-dragged');
  log(near(q.left - p.left, ddx, 20) && near(q.top - p.top, ddy, 20) && Boolean(s1) && near(s1.x, q.left, 3) && near(s1.y, q.top, 3),
    'Row 1: the floating Island drags with the real pointer and its spot is saved', `pill ${p.left},${p.top} → ${q.left},${q.top}; saved ${JSON.stringify(s1)}; title "${p.title}"`);
  // Edge snap: dropped 9 px outside the 12 px margin line (21 px from the work area's left edge), it lands on the line.
  const wantLeft = q.area.x + 21;
  pointer.drag(q.x, q.y, q.x + (wantLeft - q.left), q.y);
  await sleep(1000);
  const r = await pill();
  const s2 = islandSpot();
  desktop('island-snapped');
  log(near(r.left, q.area.x + 12, 1) && Boolean(s2) && near(s2.x, r.left, 1),
    'Row 1: an Island dropped near the screen edge snaps to 12 px in', `dropped with its left at ${wantLeft} (work area from ${q.area.x}); landed at ${r.left}; saved ${JSON.stringify(s2)}`);
  // Quit and reopen: the Island comes back at the saved spot; the density chosen in row 11 is kept too.
  await app.close();
  ({ app, companion } = await start(B));
  const back = await waitFor(async () => { const z = await pill(); return z && /island--movable/.test(z.cls) ? z : null; }, 10000);
  desktop('island-after-reopen');
  log(Boolean(back) && near(back.left, r.left, 2) && near(back.top, r.top, 2), 'Row 1: after quitting and reopening, the Island comes back at its saved spot',
    back ? `saved ${r.left},${r.top}; reopened at ${back.left},${back.top}` : 'no floating Island after the reopen');
  const dens = await companion.evaluate(() => document.documentElement.dataset.density);
  log(dens === 'compact' && settingsOf(B).density === 'compact', 'Row 11: Compact is kept after a restart', `main window data-density ${dens}; saved ${settingsOf(B).density}`);
  await pastWelcome();
  await shot(companion, 'after-restart-compact');
} catch (e) { log(false, 'Row 1: the Island', short(e)); desktop('island-stuck'); }

// --- Row 6 (Mac), the silent cases: while Settings › Activation shortcut records, and with sending switched off ----
// The hint is one Island notice per 15 s (notify.ts), so each silent check waits 16 s after the last notice, and a
// positive check between them proves the hint is still live. Recording ⌘U makes ⌘U the new shortcut (that is the
// recorder working); the Mac default Control+U is put back through the same settings IPC the recorder saves with,
// and checked, before anything else. Sending off: the agreement is given and switched off at once through the app's
// IPC (consentAgree, consentRevoke); only ⌘U is pressed after that, and ⌘U never captures (commandUHint.ts).
if (os === 'mac') {
  const settle = async () => { const wait = lastHintAt + 16000 - Date.now(); if (wait > 0) await sleep(wait); };
  try {
    await settle();
    await companion.evaluate(() => window.unvibe.openSettings());
    await companion.locator('.mside').getByRole('button', { name: 'General', exact: true }).click();
    await companion.locator('button.act.kbd-cap').click();
    await companion.locator('button.act.kbd-cap.rec').waitFor({ timeout: 5000 });
    await shot(companion, 'shortcut-recording');
    const shown = await commandU('while-recording', false);
    const recorded = settingsOf(B).shortcut;
    log(!shown, 'Row 6 (Mac): ⌘U while Settings › Activation shortcut is recording: the Island says nothing', `notice "${await islandNotice()}"; the recorder took ${recorded}`);
    await companion.keyboard.press('Escape').catch(() => {});
    await companion.evaluate(() => window.unvibe.setSettings({ shortcut: 'Control+U' }));
    await sleep(600);
    const restored = settingsOf(B).shortcut;
    await companion.getByRole('button', { name: 'Close settings', exact: true }).click().catch(() => {});
    if (restored !== 'Control+U') throw new Error(`the shortcut could not be put back to Control+U (${restored})`);
    // The settings IPC write doesn't refresh the main window's shortcut labels (the recorder's own save does; Security's
    // Run W NIT: still 45 showed ⌘U on Today), so the main window is reloaded before the next stills.
    await companion.reload();
    await pastWelcome();
    const cmdLabels = await companion.evaluate(() => document.body.innerText.includes('⌘U'));
    if (cmdLabels) throw new Error('the main window still shows ⌘U labels after the reload');
    note('Row 6 (Mac)', `shortcut put back to ${restored} after the recording check; the main window reloaded, no ⌘U labels`);
    await settle();
    const again = await commandU('sending-on-again', true);
    log(again, 'Row 6 (Mac): ⌘U hint shows again with sending on and Control+U (proves the silent checks are not the 15 s limit)');
    await settle();
    // Nothing may be held for sending when the agreement exists for that moment: no overlay open, no live agreement.
    if (app.windows().some((w) => w.url().includes('widget.html') && !w.isClosed())) throw new Error('an overlay is open; refused before the agreement');
    noAgreement();
    const status = await companion.evaluate(() => window.unvibe.consentStatus());
    const agreed = await companion.evaluate((provider) => window.unvibe.consentAgree({ aiSend: true, terms: true, age18: true, provider }), status.provider);
    await companion.evaluate(() => window.unvibe.consentRevoke());
    await sleep(500);
    const off = await companion.evaluate(() => window.unvibe.consentStatus());
    if (agreed?.ok !== true || off.allowed) throw new Error(`sending could not be switched off (agree ${JSON.stringify(agreed)}, after revoke ${JSON.stringify(off)})`);
    const silent = await commandU('sending-off', false);
    log(!silent, 'Row 6 (Mac): ⌘U with sending switched off: the Island says nothing', `notice "${await islandNotice()}"; consent allowed ${off.allowed}`);
  } catch (e) { log(false, 'Row 6 (Mac): the silent cases', short(e)); desktop('command-u-stuck'); }
} else note('Row 6', `Mac only (the ⌘U hint); ${os} has no Command key`);

await sleep(1000);
log(runtimeErrors.length === 0, 'No console or uncaught errors in Unvibe windows', runtimeErrors.length ? `${runtimeErrors.length} found` : '');
for (const e of runtimeErrors) report.push(`      ${e}`);
writeFileSync(path.join(out, 'main-process.log'), app.output.join(''));
await app.close().catch(() => {});
finish();
