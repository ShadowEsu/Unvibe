// Real-device walkthrough of the installed Unvibe app, run by .github/workflows/real-device-test.yml
// on GitHub's macOS and Windows machines. It drives the packaged app with Playwright's Electron
// support, saves a screenshot after every step, and writes a plain report of what passed.
//
// Env: UNVIBE_EXE (path to the installed app executable), SHOTS_DIR (output folder),
//      UNVIBE_OS ("mac" | "windows").
import { _electron as electron, chromium } from 'playwright';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
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

async function shot(page, label) {
  const file = name(label);
  try { await page.screenshot({ path: path.join(out, file) }); } catch (e) { console.log('screenshot failed', label, e.message); }
  return file;
}

/** Whole-screen capture from the operating system, so floating windows and the island show too. */
function desktopShot(label) {
  const file = path.join(out, name(`desktop-${label}`));
  try {
    if (os === 'mac') execFileSync('screencapture', ['-x', file]);
    else execFileSync('powershell', ['-NoProfile', '-Command',
      `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${file}')`]);
  } catch (e) { console.log('desktop screenshot failed', e.message); }
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

const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-e2e-'));
// Shell-launched protocol handlers must use the same isolated profile as the driven app.
process.env.UNVIBE_USER_DATA = userData;
const app = await electron.launch({ executablePath: exe, env: { ...process.env, UNVIBE_USER_DATA: userData }, timeout: 90000 });
const companion = await windowWith(app, 'companion.html', 60000);
if (!companion) { log(false, 'App opens'); writeFileSync(path.join(out, 'report.txt'), report.join('\n')); process.exit(1); }
await companion.waitForLoadState('domcontentloaded');
await sleep(2500);
log(true, 'App opens', `version ${await app.evaluate(({ app }) => app.getVersion())}`);
if (os === 'windows') {
  const registered = await app.evaluate(({ app }) =>
    app.setAsDefaultProtocolClient('unvibe', process.execPath, [`--user-data-dir=${app.getPath('userData')}`]));
  assert.equal(registered, true, 'the installed app must register its protocol handler');
}
desktopShot('first-launch');

// --- Onboarding ---------------------------------------------------------------------------
try {
  await shot(companion, 'onboarding-1-hello');
  await clickText(companion, "Let's go");
  await sleep(1200);
  await shot(companion, 'onboarding-2-you');
  await companion.getByPlaceholder('What should Vibe call you?').fill('Preston Test');
  await sleep(400);
  await shot(companion, 'onboarding-2-name-filled');
  log(true, 'Onboarding: hello and name');
} catch (e) { log(false, 'Onboarding: hello and name', e.message.split('\n')[0]); }

// Google sign-in: start the device flow from the app, then open the approval page in a browser.
let userCode = '';
try {
  await clickText(companion, 'Fill this in with Google');
  await companion.locator('.signin__code b, .signin__code').first().waitFor({ timeout: 20000 });
  await sleep(800);
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

try {
  await clickText(companion, 'Continue');
  await sleep(1500);
  assert.equal((await companion.locator('.ob2__count').innerText()).trim(), '3 / 5');
  await shot(companion, 'onboarding-3-connect-editors');
  await clickText(companion, 'Continue');
  await sleep(1500);
  assert.equal((await companion.locator('.ob2__count').innerText()).trim(), '4 / 5');
  await shot(companion, 'onboarding-4-permissions');
  await clickText(companion, 'Continue');
  await sleep(8000);
  assert.equal((await companion.locator('.ob2__count').innerText()).trim(), '5 / 5');
  await shot(companion, 'onboarding-5-demo');
  await clickText(companion, 'Start using Unvibe');
  await sleep(3500);
  await companion.locator('.ob').waitFor({ state: 'detached', timeout: 10000 });
  await shot(companion, 'after-onboarding');
  log(true, 'Onboarding: all five steps');
} catch (e) { log(false, 'Onboarding: all five steps', e.message.split('\n')[0]); await shot(companion, 'onboarding-stuck'); }

// Not signed in yet, so the app asks; continue without an account.
try {
  const skip = companion.locator('.login__local');
  if (await skip.count()) { await skip.first().click(); await sleep(2500); }
  await companion.locator('.topbar__title').waitFor({ timeout: 15000 });
  assert.equal((await companion.locator('.topbar__title').innerText()).trim(), 'Today');
  await shot(companion, 'home');
  log(true, 'Home opens');
} catch (e) { log(false, 'Home opens', e.message.split('\n')[0]); }

for (const page of ['Ask Vibe', 'Library', 'Quiz', 'Briefs', 'Momentum', 'Plan', 'Share']) {
  try {
    await companion.locator('.side').getByRole('button', { name: page, exact: true }).click();
    await companion.locator('.topbar__title').filter({ hasText: page }).waitFor({ timeout: 10000 });
    assert.equal((await companion.locator('.topbar__title').innerText()).trim(), page);
    log(true, `Page ${page}`);
    await shot(companion, `page-${page.toLowerCase().replace(/\s+/g, '-')}`);
  } catch (e) { log(false, `Page ${page}`, e.message.split('\n')[0]); }
}

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
    await panel.locator('.local-save-note').waitFor({ timeout: 90000 });
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
    execFileSync('powershell', ['-NoProfile', '-Command',
      `$w=New-Object -ComObject WScript.Shell; if (-not $w.AppActivate('unvibe-sample')) { throw 'Notepad did not become the foreground app' }; Start-Sleep -Milliseconds 700; $w.SendKeys('^a'); Start-Sleep -Milliseconds 500; $w.SendKeys('${keys}')`]);
  }
  const r = await waitForExplanation('global-shortcut-explanation', globalSample);
  log(r.ok, `Global shortcut (${shortcut}) in ${os === 'mac' ? 'TextEdit' : 'Notepad'}`, r.why);
} catch (e) { log(false, 'Global shortcut in another app', e.message.split('\n')[0]); }

await sleep(1000);
desktopShot('final');
writeFileSync(path.join(out, 'report.txt'), `Unvibe real-device walkthrough (${os})\n\n${report.join('\n')}\n`);
await app.close().catch(() => {});
process.exit(report.some((line) => line.startsWith('FAIL')) ? 1 : 0);
