// Real-device walkthrough of the installed Unvibe app, run by .github/workflows/real-device-test.yml
// on GitHub's macOS and Windows machines. It drives the packaged app with Playwright's Electron
// support, saves a screenshot after every step, and writes a plain report of what passed.
//
// Env: UNVIBE_EXE (path to the installed app executable), SHOTS_DIR (output folder),
//      UNVIBE_OS ("mac" | "windows"), AXE_PATH (optional axe.min.js for the a11y check).
import { _electron as electron, chromium } from 'playwright';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const exe = process.env.UNVIBE_EXE;
const out = process.env.SHOTS_DIR ?? path.resolve('shots');
const os = process.env.UNVIBE_OS ?? (process.platform === 'win32' ? 'windows' : 'mac');
mkdirSync(out, { recursive: true });
const report = [];
let n = 0;
const log = (ok, step, detail = '') => { report.push(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `: ${detail}` : ''}`); console.log(report.at(-1)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const name = (label) => `${String(++n).padStart(2, '0')}-${label}.png`;

// axe-core runs after every in-app screenshot; serious/critical violations become FAIL lines.
// CI does not install the website's node_modules, so a missing axe file skips the check (noted).
const axePath = [process.env.AXE_PATH, path.resolve('node_modules/axe-core/axe.min.js'),
  '/tmp/unvibe-work/marketing/node_modules/axe-core/axe.min.js'].find((p) => p && existsSync(p));
const axeSource = axePath ? readFileSync(axePath, 'utf8') : null;
report.push(axeSource
  ? 'NOTE  a11y: axe-core checks each screenshot; color-contrast in Electron depends on what was rendered at that moment.'
  : 'NOTE  a11y: skipped, axe-core not found (set AXE_PATH to axe.min.js).');
let a11yMs = 0; // kept out of the timed first-run measurement

async function a11y(page, label) {
  // Only Unvibe's own screens: Google's account page is not ours to gate on.
  if (!axeSource || /^https?:/.test(page.url()) && !/^https:\/\/unvibe\.site\//.test(page.url())) return;
  const start = Date.now();
  try {
    // evaluate() goes through the debugger, so the pages' script-src 'self' CSP does not block it.
    if (!(await page.evaluate(() => Boolean(window.axe)))) await page.evaluate(axeSource);
    const found = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 160), why: n.failureSummary?.split('\n').slice(1, 2).join(' ').trim() })) })));
    if (found.length) {
      log(false, `a11y ${label}`, found.map((v) => v.id).join(', '));
      for (const v of found) for (const n of v.nodes) report.push(`      ${v.id}: ${n.target} | ${n.why ?? ''} | ${n.html}`);
    }
  } catch (e) { report.push(`NOTE  a11y ${label}: not checked (${e.message.split('\n')[0]})`); }
  a11yMs += Date.now() - start;
}

async function shot(page, label) {
  const file = name(label);
  try { await page.screenshot({ path: path.join(out, file), animations: 'disabled' }); }
  catch (e) { log(false, `Screenshot ${label}`, e.message.split('\n')[0]); }
  await a11y(page, label);
  return file;
}

/** Whole-screen capture from the operating system, so floating windows and the island show too. */
function desktopShot(label) {
  const file = path.join(out, name(`desktop-${label}`));
  try {
    if (os === 'mac') execFileSync('screencapture', ['-x', file]);
    else execFileSync('powershell', ['-NoProfile', '-Command',
      `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${file}')`]);
  } catch (e) { log(false, `Desktop screenshot ${label}`, e.message.split('\n')[0]); }
}

async function windowWith(app, part, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hit = app.windows().find((w) => w.url().includes(part));
    if (hit) return hit;
    await sleep(300);
  }
  return null;
}

async function clickText(page, text, timeout = 8000) {
  await page.getByRole('button', { name: text, exact: typeof text === 'string' }).first().click({ timeout });
}

// Must match FIRST_RUN_SAMPLE in app/src/main/main.ts: onboarding explains it for real.
const FIRST_RUN_SAMPLE = [
  'function debounce(fn, wait) {',
  '  let timer;',
  '  return (...args) => {',
  '    clearTimeout(timer);',
  '    timer = setTimeout(() => fn(...args), wait);',
  '  };',
  '}',
].join('\n');
// The promise to a new user: from opening the app to their first explanation within a minute.
const FIRST_EXPLANATION_BUDGET_S = 60;

const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-e2e-'));
// Shell-launched protocol handlers must use the same isolated profile as the driven app.
process.env.UNVIBE_USER_DATA = userData;
const launchedAt = Date.now();
// UNVIBE_APP_DIR lets a developer run this against `electron <app dir>` instead of an installed build.
const app = await electron.launch({ executablePath: exe, args: process.env.UNVIBE_APP_DIR ? [process.env.UNVIBE_APP_DIR] : [], env: { ...process.env, UNVIBE_USER_DATA: userData }, timeout: 90000 });
// Zero runtime errors is part of the gate: console errors and uncaught errors in Unvibe's own
// windows fail the run. Google's account page is not ours. Main-process output is kept for review.
const runtimeErrors = [];
const ours = (url) => !/^https?:/.test(url) || /^https:\/\/unvibe\.site\//.test(url);
const where = (page) => page.url().split('/').pop() || page.url();
const watch = (page) => {
  page.on('console', (msg) => { if (msg.type() === 'error' && ours(page.url())) runtimeErrors.push(`console ${where(page)}: ${msg.text()}`); });
  page.on('pageerror', (err) => { if (ours(page.url())) runtimeErrors.push(`pageerror ${where(page)}: ${err.message}`); });
};
app.windows().forEach(watch);
app.on('window', watch);
const mainLog = [];
app.process().stdout?.on('data', (d) => mainLog.push(String(d)));
app.process().stderr?.on('data', (d) => mainLog.push(String(d)));
const companion = await windowWith(app, 'companion.html', 60000);
if (!companion) { log(false, 'App opens'); writeFileSync(path.join(out, 'report.txt'), report.join('\n')); process.exit(1); }
await companion.waitForLoadState('domcontentloaded');
log(true, 'App opens', `version ${await app.evaluate(({ app }) => app.getVersion())}`);
if (os === 'windows') {
  const registered = await app.evaluate(({ app }) =>
    app.setAsDefaultProtocolClient('unvibe', process.execPath, [`--user-data-dir=${app.getPath('userData')}`]));
  assert.equal(registered, true, 'the installed app must register its protocol handler');
}
desktopShot('first-launch');

// --- First run, timed: hello → explain the sample for real → shortcut and permission ------------
// The walkthrough acts at a brisk human pace (no sleeps beyond what the UI needs), so the time is
// close to what a new user who reads and clicks straight through would see.
try {
  await companion.locator('.ob2__count').filter({ hasText: '1 / 3' }).waitFor({ timeout: 20000 });
  await shot(companion, 'onboarding-1-hello');
  await companion.getByPlaceholder('Your name').fill('Preston Test');
  await clickText(companion, "Let's go");
  await companion.locator('.ob2__count').filter({ hasText: '2 / 3' }).waitFor({ timeout: 8000 });
  await shot(companion, 'onboarding-2-try-it');
  await clickText(companion, 'Explain this code');
  log(true, 'Onboarding: hello and sample');
} catch (e) { log(false, 'Onboarding: hello and sample', e.message.split('\n')[0]); await shot(companion, 'onboarding-stuck'); }

const first = await waitForExplanation('first-run-explanation', FIRST_RUN_SAMPLE);
const seconds = Math.round((Date.now() - launchedAt - a11yMs) / 100) / 10;
log(first.ok, 'First-run sample explains code', first.why);
log(first.ok && seconds <= FIRST_EXPLANATION_BUDGET_S, 'Time from launch to first explanation', `${seconds}s (budget ${FIRST_EXPLANATION_BUDGET_S}s)`);
writeFileSync(path.join(out, 'time-to-first-explanation.txt'), `${seconds}\n`);

try {
  await clickText(companion, 'Next');
  await companion.locator('.ob2__count').filter({ hasText: '3 / 3' }).waitFor({ timeout: 8000 });
  await companion.locator('.perm-block').waitFor({ timeout: 8000 });
  await shot(companion, 'onboarding-3-anywhere');
  await clickText(companion, 'Start using Unvibe');
  await companion.locator('.ob').waitFor({ state: 'detached', timeout: 10000 });
  await shot(companion, 'after-onboarding');
  log(true, 'Onboarding: all three steps');
} catch (e) { log(false, 'Onboarding: all three steps', e.message.split('\n')[0]); await shot(companion, 'onboarding-stuck'); }

// Local mode is the default: no sign-in wall after onboarding.
try {
  await companion.locator('.topbar__title').waitFor({ timeout: 15000 });
  assert.equal((await companion.locator('.topbar__title').innerText()).trim(), 'Today');
  assert.equal(await companion.locator('.login').count(), 0, 'no sign-in wall after onboarding');
  await shot(companion, 'home');
  log(true, 'Home opens');
} catch (e) { log(false, 'Home opens', e.message.split('\n')[0]); }

// Google sign-in from the account menu: start the device flow, then open the approval page.
let userCode = '';
try {
  await companion.locator('.acct-trigger').click();
  await companion.getByRole('menuitem', { name: 'Sign in to sync' }).click();
  await clickText(companion, 'Continue with Google');
  await companion.locator('.signin__code b').first().waitFor({ timeout: 20000 });
  userCode = ((await companion.locator('.signin__code b').first().innerText().catch(() => '')) || '').trim();
  await shot(companion, 'google-signin-code-in-app');
  log(Boolean(userCode), 'Google sign-in starts in the app', userCode ? `code ${userCode}` : 'no code shown');
} catch (e) { log(false, 'Google sign-in starts in the app', e.message.split('\n')[0]); }

if (userCode) {
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    await page.goto(`https://unvibe.site/activate?user_code=${encodeURIComponent(userCode)}`, { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(1500);
    await shot(page, 'google-signin-approval-page');
    await page.getByRole('button', { name: /Continue with Google/i }).first().click({ timeout: 15000 });
    await page.waitForURL(/accounts\.google\.com/, { timeout: 30000 });
    await sleep(2500);
    await shot(page, 'google-signin-google-account-page');
    log(true, 'Google sign-in reaches the Google account page');
  } catch (e) { log(false, 'Google sign-in reaches the Google account page', e.message.split('\n')[0]); }
  await browser?.close();
}

// Back to the app without an account.
try {
  const skip = companion.locator('.login__local');
  if (await skip.count()) await skip.first().click();
  await companion.locator('.topbar__title').filter({ hasText: 'Today' }).waitFor({ timeout: 15000 });
  log(true, 'Back to the app without signing in');
} catch (e) { log(false, 'Back to the app without signing in', e.message.split('\n')[0]); }

for (const page of ['Ask Vibe', 'Library', 'Quiz', 'Briefs', 'Momentum', 'Plan', 'Share']) {
  try {
    await companion.locator('.side').getByRole('button', { name: page, exact: true }).click();
    await companion.locator('.topbar__title').filter({ hasText: page }).waitFor({ timeout: 10000 });
    assert.equal((await companion.locator('.topbar__title').innerText()).trim(), page);
    log(true, `Page ${page}`);
    await shot(companion, `page-${page.toLowerCase().replace(/\s+/g, '-')}`);
  } catch (e) { log(false, `Page ${page}`, e.message.split('\n')[0]); }
}

// Internal navigation is also used by deep links and the command palette.
for (const page of ['Projects', 'Concepts', 'Notebook', 'Library', 'Profile']) {
  try {
    await app.evaluate(({ BrowserWindow }, id) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('companion.html'));
      if (!win) throw new Error('Companion window missing');
      win.webContents.send('companion:showPage', id);
    }, page);
    await companion.locator('.topbar__title').filter({ hasText: page }).waitFor();
    await shot(companion, `internal-${page.toLowerCase()}`);
    log(true, `Internal page ${page}`);
  } catch (e) { log(false, `Internal page ${page}`, e.message.split('\n')[0]); }
}

// Design coverage includes the controls people use after their first explanation.
try {
  await companion.locator('.side-settings').click();
  for (const tab of ['General', 'Island', 'Sound & alerts', 'Learning', 'Privacy & Data', 'Integrations', 'AI', 'Account & Plan', 'About']) {
    await companion.locator('.mside').getByRole('button', { name: tab, exact: true }).click();
    await companion.locator('.mbody h2').filter({ hasText: tab }).waitFor();
    await shot(companion, `settings-${tab.toLowerCase().replace(/[^a-z]+/g, '-')}`);
  }
  await companion.getByRole('button', { name: 'Close settings', exact: true }).click();
  await companion.getByRole('dialog', { name: 'Settings', exact: true }).waitFor({ state: 'detached' });
  log(true, 'All settings tabs are reachable and dismissible');
} catch (e) { log(false, 'Settings design coverage', e.message.split('\n')[0]); await shot(companion, 'settings-stuck'); }

try {
  await companion.locator('.topbar__search').click();
  await companion.getByRole('dialog').waitFor();
  await shot(companion, 'search-empty');
  await companion.keyboard.press('Escape');
  await companion.locator('.acct-trigger').click();
  await companion.getByRole('menu', { name: 'Account', exact: true }).waitFor();
  await shot(companion, 'account-menu');
  await companion.getByRole('menuitem', { name: 'Send feedback', exact: true }).click();
  await companion.locator('.fbk').waitFor();
  await shot(companion, 'feedback-unsent');
  await companion.locator('.fbk__close').click();
  log(true, 'Search, account menu and feedback open without sending');
} catch (e) { log(false, 'Dialog design coverage', e.message.split('\n')[0]); await shot(companion, 'dialog-stuck'); }

const { shortcut } = await companion.evaluate(() => window.unvibe.appInfo());
const shortcutRegistered = await app.evaluate(({ globalShortcut }, accelerator) =>
  globalShortcut.isRegistered(accelerator), shortcut);
log(shortcutRegistered, 'Configured global shortcut is registered', shortcut);
const sample = 'function total(items) {\n  return items.reduce((sum, item) => sum + item.price * item.qty, 0);\n}';

async function waitForExplanation(label, expectedCode) {
  const panel = await windowWith(app, 'widget.html', 20000);
  if (!panel) return { ok: false, why: 'review panel did not open' };
  try {
    const preview = panel.locator('.code-context code').filter({ hasText: expectedCode });
    await preview.waitFor({ timeout: 30000 });
    assert.equal((await preview.innerText()).trim(), expectedCode.trim());
    // The selected-code preview alone is not an AI explanation.
    await panel.locator('.card--done .local-save-note').waitFor({ timeout: 90000 });
    await panel.locator('.body .cursor').waitFor({ state: 'detached', timeout: 30000 });
    const bodyText = await panel.locator('.body').innerText();
    const codeContext = await panel.locator('.code-context').innerText();
    const text = bodyText.replace(codeContext, '').trim();
    assert.ok(text.length > 80, 'a completed review must contain an explanation beyond the code preview');
    await shot(panel, label);
    desktopShot(label);
    return { ok: true, why: text.slice(0, 120).replace(/\s+/g, ' ') };
  } catch (error) {
    await shot(panel, `${label}-failed`);
    desktopShot(`${label}-failed`);
    return { ok: false, why: error.message.split('\n')[0] };
  }
}

// --- Editor bridge path (what ⌘U / Ctrl+U does inside VS Code and Cursor) -------------------
try {
  await app.evaluate(({ clipboard }, code) => clipboard.writeText(code), sample);
  if (os === 'mac') execFileSync('open', ['unvibe://review?source=ide']);
  else execFileSync('cmd', ['/c', 'start', '', 'unvibe://review?source=ide']);
  const r = await waitForExplanation('editor-bridge-explanation', sample);
  log(r.ok, 'Editor shortcut path explains code', r.why);
} catch (e) { log(false, 'Editor shortcut path explains code', e.message.split('\n')[0]); }

// --- Global shortcut in another app ------------------------------------------------------------
try {
  const file = path.join(tmpdir(), 'unvibe-sample.js');
  const globalSample = sample.replace('function total', 'function selectedTotal');
  writeFileSync(file, globalSample);
  if (os === 'mac') {
    execFileSync('open', ['-a', 'TextEdit', file]);
    await sleep(3000);
    execFileSync('osascript', ['-e', 'tell application "TextEdit" to activate', '-e', 'delay 1', '-e', 'tell application "System Events" to keystroke "a" using command down']);
    await sleep(800);
    desktopShot('textedit-selected');
    execFileSync('osascript', ['-e', 'tell application "System Events" to keystroke "u" using control down']);
  } else {
    execFile('notepad', [file]);
    await sleep(3000);
    assert.equal(shortcutRegistered, true, 'the configured shortcut must be registered before sending it');
    const keys = `${/Control|CommandOrControl/i.test(shortcut) ? '^' : ''}${/Alt/i.test(shortcut) ? '%' : ''}${/Shift/i.test(shortcut) ? '+' : ''}u`;
    // Windows refuses focus requests from background processes (the taskbar icon only flashes),
    // so bring Notepad forward and confirm it is the foreground window before sending any keys.
    const focusScript = path.join(tmpdir(), 'unvibe-focus-notepad.ps1');
    writeFileSync(focusScript, [
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
      'for ($i = 0; $i -lt 40 -and -not $p; $i++) { $p = Get-Process notepad -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*unvibe-sample*" } | Select-Object -First 1; if (-not $p) { Start-Sleep -Milliseconds 250 } }',
      'if (-not $p) { throw "The Notepad window with the sample was not found" }',
      'for ($i = 0; $i -lt 10 -and (Title) -notlike "*unvibe-sample*"; $i++) {',
      '  [Fg]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero); [Fg]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)',
      '  [void][Fg]::ShowWindow($p.MainWindowHandle, 9); [void][Fg]::SetForegroundWindow($p.MainWindowHandle); Start-Sleep -Milliseconds 300',
      '}',
      'if ((Title) -notlike "*unvibe-sample*") { throw "Notepad is not the foreground window (foreground: $(Title))" }',
      '$w = New-Object -ComObject WScript.Shell',
      "$w.SendKeys('^a'); Start-Sleep -Milliseconds 500",
      'if ((Title) -notlike "*unvibe-sample*") { throw "Notepad lost focus before the shortcut (foreground: $(Title))" }',
      '$w.SendKeys($keys)',
    ].join('\r\n'));
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', focusScript, '-keys', keys], { encoding: 'utf8' });
    desktopShot('notepad-selected');
  }
  const r = await waitForExplanation('global-shortcut-explanation', globalSample);
  log(r.ok, `Global shortcut (${shortcut}) in ${os === 'mac' ? 'TextEdit' : 'Notepad'}`, r.why);
} catch (e) { log(false, 'Global shortcut in another app', e.message.split('\n')[0]); }

await sleep(1000);
desktopShot('final');
log(runtimeErrors.length === 0, 'No console or uncaught errors in Unvibe windows', runtimeErrors.length ? `${runtimeErrors.length} found` : '');
for (const line of runtimeErrors) report.push(`      ${line}`);
writeFileSync(path.join(out, 'main-process.log'), mainLog.join(''));
writeFileSync(path.join(out, 'report.txt'), `Unvibe real-device walkthrough (${os})\n\n${report.join('\n')}\n`);
await app.close().catch(() => {});

// Leave this CI install out of founder stats (needs the UNVIBE_ADMIN_STATS_TOKEN secret).
if (process.env.UNVIBE_ADMIN_STATS_TOKEN) {
  try {
    const { installId } = JSON.parse(readFileSync(path.join(userData, 'unvibe-store.json'), 'utf8'));
    const res = await fetch('https://api.unvibe.site/api/v1/admin/qa-install', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.UNVIBE_ADMIN_STATS_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ installId }),
    });
    console.log(`QA install flag: ${res.status}`);
  } catch (e) { console.log('QA install flag failed', e.message); }
}
process.exit(report.some((line) => line.startsWith('FAIL')) ? 1 : 0);
