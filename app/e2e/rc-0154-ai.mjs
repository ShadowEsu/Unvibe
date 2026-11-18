// Unvibe 0.1.54 RC rows that need hosted AI (unvibe-app's ask requests/unvibe-qa/20261117-2348-unvibe-app-rc-0154-walk.md,
// RC b62dfa3f), run by real-device-test.yml (input rc0154=ai-mac or ai-windows, with ai=true) on ONE system per
// dispatch. Run A of requests/boss/20261118-0025-unvibe-qa-rc0154-walk-call-plan.md; the walk-only rows are in
// rc-0154.mjs (Run W, 44271332415).
//
// Hosted calls, counted: every action that sends goes through spend(), which refuses past RC_AI_PLAN's budget, and
// the first failed call step stops every later one (cheapest first, so an early failure costs nothing more):
//   full (6): ⌃U explanation 1 · quiz check, questions 1-3 (3) · Ask Vibe 1 · setup's sample on a new profile 1
//   short (3): ⌃U explanation 1 · quiz question 1 (then Leave, never Next) · Ask Vibe 1
// Everything else here sends nothing: the agreement form, the question chips (they only fill the box), Save,
// density, the quiz's answer checks (graded in the app), drags, stills. Not pressed anywhere: Ask, Return in the ask
// box, Explain differently, More detail, the depth picker, Test me, Retry. Row 9's held Return on a chip is the one
// check that WOULD send if the RC were broken (the row's point); it is pressed once, with the box holding a chip's
// question, and a send there is reported as a FAIL and counted.
//
// Env: UNVIBE_EXE, SHOTS_DIR, UNVIBE_OS (mac | windows; linux = a local run against a mock backend), QA_AI_OK=1,
//      RC_AI_PLAN (full | short), RC_AI_PROFILE + RC_AI_ID, RC_SAMPLE_PROFILE + RC_SAMPLE_ID (full only; qa- ids the
//      workflow pre-flags and flags again after), MOUSE (mouse.swift, Mac), UNVIBE_APP_DIR (local run only).
// The helpers (pointer, launch, the shortcut in TextEdit / Notepad) are rc-0154.mjs's, copied so Run W's reviewed
// file stays as it ran.
import { launchApp, readStore } from './cdp-launch.mjs';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
const appDir = process.env.UNVIBE_APP_DIR;
const os = process.env.UNVIBE_OS ?? (process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux');
const PLAN = process.env.RC_AI_PLAN;
const BUDGET = { full: 6, short: 3 }[PLAN];
const out = path.resolve(process.env.SHOTS_DIR ?? 'rc-0154-ai');
mkdirSync(out, { recursive: true });
if (!exe) throw new Error('Set UNVIBE_EXE');
if (process.env.QA_AI_OK !== '1') throw new Error('rc-0154-ai.mjs sends hosted explanations: it needs QA_AI_OK=1 (workflow input ai=true)');
if (!BUDGET) throw new Error('RC_AI_PLAN must be full or short');

const report = [];
let n = 0;
const line = (s) => { report.push(s); console.log(s); };
const log = (ok, step, detail = '') => line(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `: ${detail}` : ''}`);
const note = (step, detail = '') => line(`NOTE  ${step}${detail ? `: ${detail}` : ''}`);
const untestable = (step, why) => line(`NOT TESTABLE  ${step}: ${why}`);
// Row 4 on a runner (BOSS, 18 Nov): synthetic presses are evidence, not a pass; the real-Mac check stays listed as a
// gap. A broken result is still a FAIL.
const runnerEvidence = (ok, step, detail) => (ok ? note(`${step} [runner evidence only, not a pass: the real-Mac check stays open]`, detail) : log(false, step, detail));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (e) => String(e?.message ?? e).split('\n')[0];

// --- The call budget ----------------------------------------------------------------------------------------------
let spent = 0;
let stopped = '';
/** Called right before an action that sends; refuses past the plan's budget, or after a failed call step. */
function spend(what) {
  if (stopped) throw new Error(`not sent: an earlier call step failed (${stopped})`);
  if (spent + 1 > BUDGET) throw new Error(`not sent: ${what} would be call ${spent + 1} of ${BUDGET} (${PLAN})`);
  spent += 1;
  line(`CALL  ${spent}/${BUDGET}: ${what}`);
}
const stop = (why) => { if (!stopped) { stopped = why; note('Every later call step is skipped', why); } };

const finish = async () => {
  clearInterval(dialogWatch);
  line(`NOTE  hosted calls sent by this run: ${spent} of the ${PLAN} plan's ${BUDGET}${stopped ? ` (stopped: ${stopped})` : ''}`);
  log(runtimeErrors.length === 0, 'No console or uncaught errors in Unvibe windows', runtimeErrors.length ? `${runtimeErrors.length} found` : '');
  for (const e of runtimeErrors) report.push(`      ${e}`);
  if (app) writeFileSync(path.join(out, 'main-process.log'), app.output.join(''));
  await app?.close().catch(() => {});
  writeFileSync(path.join(out, 'report-ai.txt'), `Unvibe 0.1.54 RC rows, AI run (${os}, plan ${PLAN})\n\n${report.join('\n')}\n`);
  process.exit(report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
};

async function shot(page, label) {
  const file = `${String(++n).padStart(2, '0')}-${label}.png`;
  try { await page.screenshot({ path: path.join(out, file), animations: 'disabled' }); } catch (e) { note(`still ${label}`, `not taken (${short(e)})`); }
  return file;
}
function desktop(label) {
  const file = path.join(out, `${String(++n).padStart(2, '0')}-desktop-${label}.png`);
  try {
    if (os === 'mac') execFileSync('screencapture', ['-x', file]);
    else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-Command',
      `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${file}')`]);
    else execFileSync('import', ['-window', 'root', file]);
  } catch (e) { note(`desktop still ${label}`, `not taken (${short(e)})`); }
}

// --- The operating system's pointer (as rc-0154.mjs) ----------------------------------------------------------------
let winScale = 1;
const ptrScript = path.join(tmpdir(), 'unvibe-rc-ai-pointer.ps1');
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
  // tap: no rest before the press, so a faded overlay cannot wake on hover (150 ms) before the press reaches it.
  'if ($op -eq "tap") { [void][Ptr]::SetCursorPos($x1, $y1); [Ptr]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [Ptr]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero) }',
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
  move(x, y) {
    if (os === 'mac') execFileSync(process.env.MOUSE, ['move', px(x), px(y)]);
    else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ptrScript, 'move', px(x), px(y), '0', '0', '1']);
    else execFileSync('xdotool', ['mousemove', px(x), px(y)]);
  },
  /** One press with no rest on the spot first (mouse.swift warps without a move event, then presses). */
  tap(x, y) {
    if (os === 'mac') execFileSync(process.env.MOUSE, ['click', px(x), px(y), '1']);
    else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ptrScript, 'tap', px(x), px(y), '0', '0', '1']);
    else execFileSync('xdotool', ['mousemove', px(x), px(y), 'click', '1']);
  },
};
const hover = async (c) => { pointer.move(c.x, c.y); await sleep(450); };

// --- The app --------------------------------------------------------------------------------------------------------
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
  const env = { ...process.env, UNVIBE_USER_DATA: userData };
  for (const key of Object.keys(env)) {
    if (/^(UNVIBE_ADMIN_STATS_TOKEN|UNVIBE_QA_FLAG_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_.*)$/.test(key)) delete env[key];
  }
  const args = [...(appDir ? [appDir] : []), ...(os === 'linux' ? ['--use-mock-keychain'] : [])];
  const launched = await launchApp({ exe, userData, args, env, timeout: 90000 });
  launched.onWindow(watch);
  const main = await launched.windowWith('companion.html', 60000);
  if (!main) throw new Error('the main window did not open');
  await main.waitForLoadState('domcontentloaded');
  return { app: launched, companion: main };
}
const where = (page) => page.evaluate(() => ({
  x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight, dpr: window.devicePixelRatio,
  area: { x: screen.availLeft, y: screen.availTop, w: screen.availWidth, h: screen.availHeight },
}));
async function centre(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: window.screenX + r.left + r.width / 2, y: window.screenY + r.top + r.height / 2 };
  }, selector);
}
async function waitFor(fn, ms = 5000, every = 150) {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v || Date.now() - t > ms) return v;
    await sleep(every);
  }
}
const panelWindow = () => app.windows().find((w) => w.url().includes('widget.html') && !w.isClosed());
const css = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const st = getComputedStyle(el);
  return { h: Math.round(el.getBoundingClientRect().height), font: st.fontSize, minH: st.minHeight, gap: st.gap };
}, sel);
// Density is switched as a person does, in Settings › General (the settings IPC alone doesn't reach the main window's
// data-density: a local smoke measured no change on the quiz and Ask pages that way). The overlay follows live.
async function setDensity(d) {
  await companion.evaluate(() => window.unvibe.openSettings());
  await companion.locator('.mside').getByRole('button', { name: 'General', exact: true }).click();
  const grid = companion.locator('.location-grid[aria-label="Density"]');
  await grid.waitFor({ timeout: 8000 });
  await grid.getByRole('button', { name: d === 'compact' ? 'Compact' : 'Comfortable', exact: true }).click();
  await sleep(500);
  await companion.getByRole('button', { name: 'Close settings', exact: true }).click();
  await companion.locator('.modal').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  const now = await companion.evaluate(() => document.documentElement.dataset.density);
  if (now !== d) throw new Error(`density is ${now} after choosing ${d}`);
  await sleep(300);
}

// The launch-at-login question is a native dialog, due after the first own-code explanation (the ⌃U one here). It is
// modal to the overlay, so it is answered No as soon as it shows: on a Mac through System Events (as real-device.mjs),
// on Windows through UI Automation (a #32770 dialog of Unvibe's own process). Each answer is kept for the report.
const dialogs = [];
let dialogWatchError = ''; // shown if the watcher never saw the question (Accessibility, UI Automation)
let dialogBusy = false;
const winDialogScript = path.join(tmpdir(), 'unvibe-rc-ai-dialogs.ps1');
if (os === 'windows') writeFileSync(winDialogScript, [
  'Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes',
  '$A = [System.Windows.Automation.AutomationElement]',
  '$ids = @(Get-Process Unvibe -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })',
  '$cls = New-Object System.Windows.Automation.PropertyCondition($A::ClassNameProperty, "#32770")',
  '$found = @()',
  'foreach ($w in $A::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $cls)) {',
  '  if ($ids -notcontains $w.Current.ProcessId) { continue }',
  '  $textCond = New-Object System.Windows.Automation.PropertyCondition($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text)',
  '  $text = (@($w.FindAll([System.Windows.Automation.TreeScope]::Descendants, $textCond) | ForEach-Object { $_.Current.Name }) -join " ")',
  '  foreach ($name in "No", "Cancel", "OK") {',
  '    $isButton = [System.Windows.Automation.PropertyCondition]::new($A::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)',
  '    $named = [System.Windows.Automation.PropertyCondition]::new($A::NameProperty, $name)',
  '    $c = [System.Windows.Automation.AndCondition]::new([System.Windows.Automation.Condition[]]@($isButton, $named))',
  '    $b = $w.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $c)',
  '    if ($b) { $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); $found += "$text [$name]"; break }',
  '  }',
  '}',
  '$found -join "|"',
].join('\r\n'));
const answerDialogs = () => {
  if (dialogBusy || !app) return;
  dialogBusy = true;
  const done = (error, stdout) => {
    dialogBusy = false;
    if (error) dialogWatchError = String(error.message).split('\n').filter(Boolean).pop() ?? '';
    else for (const m of String(stdout).split('|').map((s) => s.trim()).filter(Boolean)) dialogs.push(m);
  };
  if (os === 'mac') {
    execFile('osascript', ['-e', `tell application "System Events"
  set p to first process whose unix id is ${app.process.pid}
  set found to ""
  repeat with w in windows of p
    try
      set boxes to (sheets of w)
      if subrole of w is "AXDialog" then set end of boxes to w
      repeat with s in boxes
        set t to ""
        repeat with x in (static texts of s)
          set t to t & (value of x) & " "
        end repeat
        repeat with b in {"No", "Cancel", "OK"}
          if exists button b of s then
            click button b of s
            set found to found & t & "[" & b & "]|"
            exit repeat
          end if
        end repeat
      end repeat
    end try
  end repeat
  return found
end tell`], { timeout: 10000 }, done);
  } else if (os === 'windows') execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', winDialogScript], { timeout: 20000 }, done);
  else dialogBusy = false;
};
const dialogWatch = setInterval(answerDialogs, 2000);

// --- The shortcut in another app ------------------------------------------------------------------------------------
const CODE = 'function selectedTotal(items) {\n  return items.reduce((sum, item) => sum + item.price * item.qty, 0);\n}';
const sampleFile = path.join(tmpdir(), 'unvibe-rc0154-sample.js');
writeFileSync(sampleFile, CODE);
let editorOpen = false;
let shortcut = 'Control+U';
const focusScript = path.join(tmpdir(), 'unvibe-rc-ai-focus.ps1');
/** Select all in TextEdit / Notepad and press the global shortcut (rc-0154.mjs shortcutInEditor, without its checks). */
async function pressShortcut() {
  if (os === 'mac') {
    if (!editorOpen) { execFileSync('open', ['-a', 'TextEdit', sampleFile]); await sleep(3000); editorOpen = true; }
    execFileSync('osascript', ['-e', 'tell application "TextEdit" to activate', '-e', 'delay 1', '-e', 'tell application "System Events" to keystroke "a" using command down'], { timeout: 20000 });
    await sleep(600);
    execFileSync('osascript', ['-e', 'tell application "System Events" to keystroke "u" using control down'], { timeout: 15000 });
  } else if (os === 'windows') {
    if (!editorOpen) { execFile('notepad', [sampleFile]); await sleep(3000); editorOpen = true; }
    const keys = `${/Control|CommandOrControl/i.test(shortcut) ? '^' : ''}${/Alt/i.test(shortcut) ? '%' : ''}${/Shift/i.test(shortcut) ? '+' : ''}u`;
    writeFileSync(focusScript, [
      'param([string]$keys, [switch]$frontOnly)',
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
      'if ($frontOnly) { exit 0 }',
      '$w = New-Object -ComObject WScript.Shell',
      "$w.SendKeys('^a'); Start-Sleep -Milliseconds 500",
      'if ((Title) -notlike "*unvibe-rc0154-sample*") { throw "Notepad lost focus before the shortcut (foreground: $(Title))" }',
      '$w.SendKeys($keys)',
    ].join('\r\n'));
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', focusScript, '-keys', keys], { encoding: 'utf8', timeout: 30000 });
  } else {
    await companion.evaluate(() => window.unvibe.reviewSelection());
  }
}
/** The editor in front again (the overlay loses focus if it had it); nothing is typed. */
function editorToFront() {
  if (os === 'mac') execFileSync('osascript', ['-e', 'tell application "TextEdit" to activate'], { timeout: 15000 });
  else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', focusScript, '-frontOnly'], { encoding: 'utf8', timeout: 30000 });
}
/** The answer has finished: done, no typing cursor, the question chips enabled. */
async function explanationDone(panel, ms = 120000) {
  await panel.locator('.ob.ob--done').waitFor({ timeout: ms });
  await panel.locator('.ob-answer .cursor').waitFor({ state: 'detached', timeout: 60000 });
  await panel.locator('button.ob-question:not([disabled])').first().waitFor({ timeout: 30000 });
  return (await panel.locator('.ob-answer').innerText()).trim();
}

// --- Profile A: setup skipped ----------------------------------------------------------------------------------------
let app = null;
let companion = null;
line(`NOTE  mode: AI run, plan ${PLAN} (at most ${BUDGET} hosted calls; each is listed as CALL n/${BUDGET})`);
const A = profile(process.env.RC_AI_PROFILE ?? mkdtempSync(path.join(tmpdir(), 'unvibe-rc0154-ai-')), process.env.RC_AI_ID ?? `qa-rc0154-ai-local-${Date.now()}`);
try {
  ({ app, companion } = await start(A));
} catch (e) { log(false, 'The RC opens', short(e)); await finish(); }
const info = await companion.evaluate(() => window.unvibe.appInfo());
shortcut = info.shortcut;
line(`NOTE  Unvibe ${info.version}, install id ${readStore(A).installId}, shortcut ${shortcut}`);
// Only the RC under test may send: anything else is refused before the first call.
if (info.version !== '0.1.54') { log(false, 'The AI run needs the 0.1.54 RC', `this build is ${info.version}; nothing was sent`); await finish(); }
if (os === 'windows') winScale = (await where(companion)).dpr || 1;
try {
  await companion.locator('.onboard__count').first().waitFor({ timeout: 20000 });
  await companion.getByPlaceholder('Your name').fill('Sam Test');
  await companion.getByRole('button', { name: "Let's go", exact: true }).click();
  for (const next of ['3 /', null]) {
    await companion.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 8000 });
    if (next) await companion.locator('.onboard__count').filter({ hasText: next }).waitFor({ timeout: 8000 });
  }
  await companion.locator('.onboard').waitFor({ state: 'detached', timeout: 10000 });
  await companion.locator('.topbar__title').filter({ hasText: 'Today' }).waitFor({ timeout: 15000 });
} catch (e) { log(false, 'Setup skipped to Today', short(e)); await shot(companion, 'setup-stuck'); await finish(); }

// --- Call 1: the ⌃U explanation (row 15) ----------------------------------------------------------------------------
// First press: no agreement yet, so the overlay asks for it and reads nothing. The three boxes are ticked and
// Continue pressed (as a person does); the overlay then waits empty ("Ready when you are.") with nothing sent. The
// second press, with the code still selected, sends it: call 1.
let panel = null;
try {
  await pressShortcut();
  panel = await waitFor(async () => panelWindow(), 20000, 250);
  if (!panel) throw new Error('the overlay did not open');
  const consent = panel.locator('.ob.ob--aiConsent .consent-form');
  await consent.waitFor({ timeout: 20000 });
  const boxes = consent.locator('input[type="checkbox"]');
  if ((await boxes.count()) !== 3) throw new Error('the agreement form does not have three boxes');
  await shot(panel, 'cu-agreement');
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  await consent.getByRole('button', { name: 'Continue', exact: true }).click();
  await panel.locator('.ob.ob--empty').waitFor({ timeout: 20000 });
  if (await panel.locator('.ob-answer').count()) throw new Error('something streamed after Continue, before the second press');
  await shot(panel, 'cu-agreed-empty');
  note('⌃U, first press', 'the agreement form; three boxes ticked, Continue; the overlay waits empty, nothing sent');
  spend(`⌃U explanation (${shortcut} on the selected code in ${os === 'mac' ? 'TextEdit' : os === 'windows' ? 'Notepad' : 'the local stand-in'})`);
  if (os === 'linux') {
    await companion.evaluate((code) => navigator.clipboard.writeText(code), CODE);
    await panel.getByRole('button', { name: 'Explain my clipboard', exact: true }).click();
  } else await pressShortcut();
  const text = await explanationDone(panel);
  await shot(panel, 'cu-done');
  desktop('cu-done');
  log(text.length > 80, 'Row 15: a ⌃U explanation runs end to end (agreement, then the selected code explained)', `${text.length} characters: "${text.slice(0, 100).replace(/\s+/g, ' ')}…"`);
  if (text.length <= 80) stop('the ⌃U explanation came back too short');
} catch (e) {
  log(false, 'Row 15: a ⌃U explanation runs end to end', short(e));
  if (panel && !panel.isClosed()) await shot(panel, 'cu-stuck');
  desktop('cu-stuck');
  stop('the ⌃U explanation failed');
}

// --- No-call rows on the finished overlay: 8, 10, 9, 2 (done state), 11 (overlay) ----------------------------------
if (!stopped) {
  // The launch-at-login question comes right after the first own-code explanation (a sheet on the overlay); the
  // watcher answers No before anything here touches the overlay.
  if (os !== 'linux' && !await waitFor(async () => dialogs.some((m) => /log in/.test(m)), 15000, 250)) note('The launch-at-login question', 'not seen within 15 s of the first explanation');
  await sleep(1000);

  // Row 4 (no call: a question chip only fills the box). With the editor in front: (a) while the overlay is at full
  // opacity (it opened without focus), the first real press on a question chip works (acceptFirstMouse); (b) once it
  // has had focus and the editor takes focus back, it fades to 22 % and the first press only wakes it (the box stays
  // empty); the second press fills the box. Presses are the system's pointer with no rest first (a 150 ms rest wakes).
  const opacity = () => panel.evaluate(() => Number(getComputedStyle(document.querySelector('.ob')).opacity));
  const boxValue = () => panel.evaluate(() => document.querySelector('input.ob-ask__input')?.value ?? null);
  const at = (selector, text) => panel.evaluate(([sel, t]) => {
    const el = [...document.querySelectorAll(sel)].find((x) => !t || x.textContent.trim() === t);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: window.screenX + r.left + r.width / 2, y: window.screenY + r.top + r.height / 2 };
  }, [selector, text]);
  if (os === 'linux') untestable('Row 4: first press with the editor in front, faded first press', 'local run: no editor and no window manager');
  else {
    try {
      editorToFront();
      await sleep(800);
      const o1 = await opacity();
      if (o1 > 0.99) {
        const c = await at('button.ob-question', 'Why this way?');
        pointer.tap(c.x, c.y);
        await sleep(500);
        const v = await boxValue();
        desktop('row4-first-press');
        runnerEvidence(v === 'Why this way?', 'Row 4: with the editor in front, the first press on a question chip works (acceptFirstMouse)', `opacity ${o1}; box "${v}"`);
        await panel.locator('input.ob-ask__input').fill('');
        editorToFront();
        await sleep(800);
      } else note('Row 4: the first press on an overlay at full opacity', `not reached: the overlay already had focus (opacity ${o1} with the editor in front)`);
      let o2 = await opacity();
      if (o2 > 0.3) {
        // The press didn't give the overlay focus: a press on its title does, then the editor takes it back.
        const t = await at('.ob-head__title');
        pointer.tap(t.x, t.y);
        await sleep(500);
        editorToFront();
        await sleep(800);
        o2 = await opacity();
      }
      if (o2 > 0.3) throw new Error(`the overlay did not fade with the editor in front (opacity ${o2})`);
      desktop('row4-faded');
      const c = await at('button.ob-question', 'What breaks if I remove it?');
      pointer.tap(c.x, c.y);
      await sleep(500);
      const v1 = await boxValue();
      const o3 = await opacity();
      desktop('row4-faded-first-press');
      runnerEvidence(v1 === '' && o3 > 0.99, 'Row 4: the first press on a faded overlay only wakes it (the chip under it is not pressed)', `opacity ${o2} → ${o3}; box "${v1}"`);
      pointer.tap(c.x, c.y);
      await sleep(500);
      const v2 = await boxValue();
      runnerEvidence(v2 === 'What breaks if I remove it?', 'Row 4: the second press then works', `box "${v2}"`);
      await panel.locator('input.ob-ask__input').fill('');
    } catch (e) { log(false, 'Row 4: the first press and the faded first press', short(e)); desktop('row4-stuck'); }
  }

  // Row 8: the layout under a finished explanation.
  try {
    const layout = await panel.evaluate(() => {
      const q = document.querySelector('.ob-questions');
      const ask = document.querySelector('.ob-ask');
      const chips = document.querySelector('.ob-chips--text');
      const send = document.querySelector('button.ob-ask__send');
      const order = Boolean(q && ask && chips) && Boolean(q.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(ask.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING);
      return {
        label: document.querySelector('.ob-questions__label')?.textContent.trim(),
        questions: [...document.querySelectorAll('button.ob-question')].map((b) => b.textContent.trim()),
        placeholder: document.querySelector('input.ob-ask__input')?.placeholder,
        send: send ? { label: send.getAttribute('aria-label'), bg: getComputedStyle(send).backgroundColor, disabled: send.disabled } : null,
        chips: [...document.querySelectorAll('.ob-chips--text button.ob-chip')].map((b) => b.textContent.trim()),
        order,
      };
    });
    const ok = layout.label === 'Question it'
      && JSON.stringify(layout.questions) === JSON.stringify(['Why this way?', 'What breaks if I remove it?', 'What would a reviewer flag?'])
      && layout.placeholder === 'Ask your own question…' && layout.send?.label === 'Ask'
      && JSON.stringify(layout.chips) === JSON.stringify(['Explain differently', 'Save', 'Understood']) && layout.order;
    await shot(panel, 'row8-question-it');
    log(ok, 'Row 8: after an explanation: "Question it", the three questions, "Ask your own question…" with Ask, then Explain differently · Save · Understood', JSON.stringify(layout));
  } catch (e) { log(false, 'Row 8: Question it layout', short(e)); }

  // Row 10 (Design S-1, Mac): the done state at 1x and 2x, light theme.
  if (os === 'mac') {
    try {
      const theme = await panel.evaluate(() => document.documentElement.dataset.theme ?? document.documentElement.getAttribute('data-theme'));
      const dpr = (await where(panel)).dpr;
      await shot(panel, `row10-done-${dpr}x-light`);
      const size = await panel.evaluate(() => ({ w: innerWidth, h: innerHeight }));
      const cdp = await panel.context().newCDPSession(panel);
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: dpr === 2 ? 1 : 2, mobile: false });
      await sleep(500);
      await shot(panel, `row10-done-${dpr === 2 ? 1 : 2}x-light`);
      await cdp.send('Emulation.clearDeviceMetricsOverride');
      await cdp.detach();
      log(theme !== 'dark', 'Row 10 (Design S-1, Mac): the done state, still at 1x and 2x, light', `screen at ${dpr}x; the other scale rendered by CDP at the same ${size.w}x${size.h}; theme ${theme ?? 'light (unset)'}`);
    } catch (e) { log(false, 'Row 10: Design stills', short(e)); }
  }

  // Row 9: a chip fills the box and focuses it, nothing is sent; a second chip replaces an untouched question; typed
  // text is never replaced; Return held on a chip sends nothing. "Nothing sent": the overlay stays on its Explain
  // view (a send switches it to Ask) with no thread turn, checked after each step.
  const sentNothing = () => panel.evaluate(() => ({ explainView: document.querySelector('.ob')?.classList.contains('ob--view-explain'), turns: document.querySelectorAll('.ob-thread__turn').length }));
  const box = () => panel.evaluate(() => {
    const input = document.querySelector('input.ob-ask__input');
    return {
      value: input?.value, focused: document.activeElement === input,
      pressed: [...document.querySelectorAll('button.ob-question')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent.trim()),
    };
  });
  try {
    const opacity = await panel.evaluate(() => Number(getComputedStyle(document.querySelector('.ob')).opacity));
    if (opacity < 0.99) { const c = await centre(panel, '.ob-head__title'); await hover(c); note('Row 9', `the overlay was faded (${opacity}); woken by resting the pointer on it`); }
    const [q1, q2, q3] = ['Why this way?', 'What breaks if I remove it?', 'What would a reviewer flag?'];
    const chip = (name) => panel.locator('button.ob-question').filter({ hasText: name });
    await chip(q1).click();
    await sleep(300);
    const a = await box();
    const a0 = await sentNothing();
    await chip(q2).click();
    await sleep(300);
    const b = await box();
    await panel.locator('input.ob-ask__input').press('End');
    await panel.keyboard.type(' (mine)');
    await chip(q3).click();
    await sleep(300);
    const c = await box();
    const c0 = await sentNothing();
    await shot(panel, 'row9-typed-kept');
    // Held Return on a chip, with the box emptied first: the first keydown is the chip's click (it fills the box and
    // moves focus there); the repeats then land in a box that holds a question, where only a fresh Return may send.
    await panel.locator('input.ob-ask__input').fill('');
    await chip(q1).focus();
    await panel.keyboard.down('Enter');
    for (let i = 0; i < 5; i++) { await sleep(60); await panel.keyboard.down('Enter'); }
    await panel.keyboard.up('Enter');
    await sleep(3000);
    const d = await box();
    const d0 = await sentNothing();
    await shot(panel, 'row9-held-return');
    const nothingSent = [a0, c0, d0].every((s) => s.explainView && s.turns === 0);
    if (!d0.explainView || d0.turns) { spent += 1; line(`CALL  ${spent}/${BUDGET}: NOT PLANNED: the held Return on a chip sent the question`); stop('row 9 sent a question'); }
    log(a.value === q1 && a.focused && JSON.stringify(a.pressed) === JSON.stringify([q1]), 'Row 9: a question chip fills the box and focuses it', JSON.stringify(a));
    log(b.value === q2 && b.focused && JSON.stringify(b.pressed) === JSON.stringify([q2]), 'Row 9: a second chip replaces an untouched question', JSON.stringify(b));
    log(c.value === `${q2} (mine)` && c.focused && c.pressed.length === 0, 'Row 9: text you typed is never replaced by a chip', JSON.stringify(c));
    log(d.value === q1 && d0.explainView && d0.turns === 0, 'Row 9: Return held on a chip sends nothing (the box holds the question, focus in it)', `${JSON.stringify(d)}; ${JSON.stringify(d0)}`);
    log(nothingSent, 'Row 9: nothing was sent by any chip (the overlay stayed on Explain with no thread)', JSON.stringify([a0, c0, d0]));
    await panel.locator('input.ob-ask__input').fill('');
  } catch (e) { log(false, 'Row 9: question chips', short(e)); }

  // Row 11, finished overlay: the question chips and text chips are smaller in Compact, live.
  try {
    const before = { q: await css(panel, 'button.ob-question'), label: await css(panel, '.ob-questions__label'), chip: await css(panel, '.ob-chips--text .ob-chip'), answer: await css(panel, '.ob-answer') };
    await setDensity('compact');
    const after = { q: await css(panel, 'button.ob-question'), label: await css(panel, '.ob-questions__label'), chip: await css(panel, '.ob-chips--text .ob-chip'), answer: await css(panel, '.ob-answer') };
    await shot(panel, 'row11-done-compact');
    await setDensity('comfortable');
    const smaller = (x, y) => Boolean(x && y) && y.h < x.h && parseFloat(y.font) < parseFloat(x.font);
    log(smaller(before.q, after.q) && parseFloat(after.label.font) < parseFloat(before.label.font) && parseFloat(after.chip.font) < parseFloat(before.chip.font),
      'Row 11: the finished overlay goes Compact live (question chips, label, text chips)', `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  } catch (e) { log(false, 'Row 11: finished overlay density', short(e)); }

  // Row 2, done state: the header drag with the real pointer (the full row ran on the agreement form in Run W).
  try {
    const p0 = await where(panel);
    const c = await centre(panel, '.ob-head__title');
    await hover(c);
    const dx = p0.x + p0.w / 2 > p0.area.x + p0.area.w / 2 ? -200 : 200;
    pointer.drag(c.x, c.y, c.x + dx, c.y);
    await sleep(900);
    const p1 = await where(panel);
    desktop('row2-done-dragged');
    log(Math.abs(p1.x - p0.x - dx) <= 20, 'Row 2: a finished overlay moves by its header too', `${p0.x},${p0.y} → ${p1.x},${p1.y} (dragged ${dx})`);
  } catch (e) { log(false, 'Row 2: done-state drag', short(e)); }
  await panel.locator('.ob-head__close').click().catch(() => {});
  await waitFor(async () => panel.isClosed(), 5000);
}
untestable('Row 4 (first click, faded first click) with a person\'s hand on a real Mac', 'a gap for a real-Mac check: runner presses are synthetic system events (see the runner evidence above)');

// --- Calls 2-4 (full) or 2 (short): the quiz on that lesson (rows 12, 15, 11) ---------------------------------------
const NOT_QUITE = /^Not quite\./;
if (!stopped) {
  try {
    await companion.locator('.side').getByRole('button', { name: 'Quiz', exact: true }).click();
    await companion.locator('.qz-home').waitFor({ timeout: 10000 });
    await companion.locator('.qz-home__list .qz-home__pick').first().waitFor({ timeout: 10000 });
    // Row 11, quiz home: the lesson row is smaller in Compact.
    const comfy = await css(companion, '.m-row.qz-home__row');
    await setDensity('compact');
    const compact = await css(companion, '.m-row.qz-home__row');
    await shot(companion, 'row11-quiz-home-compact');
    await setDensity('comfortable');
    await shot(companion, 'quiz-home');
    log(Boolean(comfy && compact) && compact.h < comfy.h && parseFloat(compact.font) < parseFloat(comfy.font), 'Row 11: the quiz list goes Compact', `${JSON.stringify(comfy)} → ${JSON.stringify(compact)}`);
    await companion.locator('.qz-home__list .qz-home__pick').first().click();
    await companion.locator('.qz-start button.qz-start__go').waitFor({ timeout: 10000 });
    await shot(companion, 'quiz-start');
  } catch (e) { log(false, 'Quiz: the lesson from the ⌃U explanation opens on its Start screen', short(e)); await shot(companion, 'quiz-stuck'); stop('the quiz did not reach its Start screen'); }
}
const questions = PLAN === 'full' ? 3 : 1;
let wrongSeen = null;
let reachedResults = false;
for (let q = 1; q <= questions && !stopped; q++) {
  try {
    spend(`quiz question ${q} of the check`);
    if (q === 1) await companion.locator('.qz-start button.qz-start__go').click();
    else await companion.locator('button.qz-right__go').click();
    await companion.locator('.qz-question .qz-q__text').waitFor({ timeout: 90000 });
    await companion.locator('.qz-question .qz-option').first().waitFor({ timeout: 10000 });
    const options = await companion.locator('.qz-question .qz-option').allInnerTexts();
    if (options.some((o) => /How to delete the entire repository safely/.test(o))) throw new Error('the app showed its local stand-in question, so the comprehension call failed');
    await shot(companion, `quiz-q${q}`);
    // Row 11 on the first question: the question screen in Compact.
    if (q === 1) {
      const before = { option: await css(companion, '.qz-question .qz-option'), text: await css(companion, '.qz-q__text') };
      await setDensity('compact');
      const after = { option: await css(companion, '.qz-question .qz-option'), text: await css(companion, '.qz-q__text') };
      await shot(companion, 'row11-quiz-question-compact');
      await setDensity('comfortable');
      log(parseFloat(after.option.font) < parseFloat(before.option.font) || after.option.h < before.option.h, 'Row 11: the quiz question goes Compact', `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    }
    // Answer by keys: a digit picks, Return checks; after a wrong answer, row 12's checks, then the arrows pick and
    // Return checks again, until it is right (graded in the app: no call).
    await companion.locator('.qz-question .qz-options').click({ position: { x: 1, y: 1 } }).catch(() => {});
    await companion.keyboard.press('1');
    const chosen1 = await companion.locator('.qz-question .qz-option[aria-checked="true"]').innerText().catch(() => '');
    for (let attempt = 0; attempt < 4; attempt++) {
      await companion.keyboard.press('Enter');
      const right = await companion.locator('.qz-right').waitFor({ timeout: 4000 }).then(() => true, () => false);
      if (right) break;
      const state = await companion.evaluate(() => {
        const wrong = [...document.querySelectorAll('.qz-question .qz-option.is-wrong')];
        const active = document.activeElement;
        return {
          wrong: wrong.length,
          disabled: wrong.every((w) => w.getAttribute('aria-disabled') === 'true'),
          why: document.querySelector('.qz-foot__msg [role=status] .qz-foot__why, .qz-foot__msg .qz-foot__why')?.textContent.trim() ?? '',
          statusRole: Boolean(document.querySelector('.qz-foot__msg [role=status]')),
          focusOnOpen: Boolean(active?.matches('.qz-option') && !active.classList.contains('is-wrong')),
          check: document.querySelector('.qz-foot button.m-btn--filled')?.disabled ?? null,
        };
      });
      if (!wrongSeen) {
        wrongSeen = state;
        await shot(companion, `row12-wrong-q${q}`);
        log(state.wrong >= 1 && state.disabled && NOT_QUITE.test(state.why) && state.statusRole && state.focusOnOpen,
          'Row 12: a wrong answer greys out (aria-disabled), "Not quite." is in the status line, focus moves to the next open answer', `${JSON.stringify(state)} (first pick: "${chosen1}")`);
        untestable('Row 12: VoiceOver / Narrator reading "Not quite."', 'no screen reader on a hosted runner; the text is in the role=status line above');
        // The arrows move between the open answers (and pick); then a digit picks.
        const beforeArrow = await companion.locator('.qz-question .qz-option[aria-checked="true"]').count();
        await companion.keyboard.press('ArrowDown');
        const arrowPick = await companion.locator('.qz-question .qz-option[aria-checked="true"]').innerText().catch(() => '');
        const all = await companion.locator('.qz-question .qz-option').evaluateAll((els) => els.map((e) => ({ wrong: e.classList.contains('is-wrong') })));
        const digit = all.findIndex((o, i) => !o.wrong && i > 0) + 1;
        await companion.keyboard.press(String(digit));
        const digitPick = await companion.locator('.qz-question .qz-option[aria-checked="true"]').innerText().catch(() => '');
        log(beforeArrow === 0 && Boolean(arrowPick) && Boolean(digitPick), 'Row 12: arrow keys move between answers and pick; 1-4 pick', `after the wrong one nothing chosen; ↓ chose "${arrowPick}"; ${digit} chose "${digitPick}"`);
      } else {
        // Later wrong answers: the next open answer by digit.
        const all = await companion.locator('.qz-question .qz-option').evaluateAll((els) => els.map((e) => ({ wrong: e.classList.contains('is-wrong') })));
        await companion.keyboard.press(String(all.findIndex((o) => !o.wrong) + 1));
      }
    }
    if (!(await companion.locator('.qz-right').count())) throw new Error('no answer was graded right after trying every option');
    await shot(companion, `quiz-q${q}-right`);
    note(`Quiz question ${q}`, 'answered right (Return checks)');
  } catch (e) { log(false, `Quiz question ${q}`, short(e)); await shot(companion, `quiz-q${q}-stuck`); stop(`quiz question ${q} failed`); }
}
if (!stopped && questions === 3) {
  try {
    await companion.locator('button.qz-right__go').click(); // "See my score": no call (the last question is done)
    await companion.locator('.qz-results').waitFor({ timeout: 10000 });
    const head = (await companion.locator('.qz-results .qz-title').first().innerText()).trim();
    await shot(companion, 'quiz-results');
    reachedResults = true;
    const comfy = await css(companion, '.qz-results .m-tile__num');
    await setDensity('compact');
    const compact = await css(companion, '.qz-results .m-tile__num');
    await shot(companion, 'row11-quiz-results-compact');
    await setDensity('comfortable');
    log(true, 'Row 15: a quiz check runs end to end (3 questions, then the score)', head);
    log(Boolean(comfy && compact) && parseFloat(compact.font) < parseFloat(comfy.font), 'Row 11: the quiz results go Compact', `${JSON.stringify(comfy)} → ${JSON.stringify(compact)}`);
  } catch (e) { log(false, 'Row 15: quiz results', short(e)); }
}
if (questions === 1 && !stopped) {
  // Short plan: leave after question 1. Never Next or Return on the right-answer screen (that loads question 2).
  await companion.locator('.qz-bar__leave').click().catch((e) => note('Quiz: Leave', short(e)));
  note('Row 15: quiz end to end', 'short plan: one question only; the results screen is not reached');
}
if (!wrongSeen && !stopped) note('Row 12: the wrong-answer state', `not reached: the first pick was right on ${questions === 1 ? 'the question' : 'every question'}`);
await companion.locator('.side').getByRole('button', { name: 'Today', exact: true }).click().catch(() => {});

// --- Call: Ask Vibe (rows 15, 11) -------------------------------------------------------------------------------------
if (!stopped) {
  try {
    await companion.locator('.side').getByRole('button', { name: 'Ask Vibe', exact: true }).click();
    const draft = companion.locator('textarea#chatDraft');
    await draft.waitFor({ timeout: 10000 });
    await draft.fill('In one sentence: what does selectedTotal return for an empty list?');
    spend('Ask Vibe question');
    await companion.locator('button.ask-composer__send').click();
    const answer = companion.locator('article.ask-turn--assistant .ask-answer__body').last();
    await answer.or(companion.locator('.chat-error')).first().waitFor({ timeout: 120000 });
    if (await companion.locator('.chat-error').count()) throw new Error(`Ask Vibe showed an error: ${(await companion.locator('.chat-error').innerText()).trim().slice(0, 120)}`);
    const text = (await answer.innerText()).trim();
    await shot(companion, 'askvibe-answer');
    log(text.length > 10, 'Row 15: Ask Vibe answers', `"${text.slice(0, 100).replace(/\s+/g, ' ')}"`);
    const before = { user: await css(companion, '.ask-user'), body: await css(companion, '.ask-answer__body') };
    await setDensity('compact');
    const after = { user: await css(companion, '.ask-user'), body: await css(companion, '.ask-answer__body') };
    await shot(companion, 'row11-askvibe-compact');
    await setDensity('comfortable');
    const changed = (x, y) => Boolean(x && y) && (parseFloat(y.font) < parseFloat(x.font) || y.h < x.h);
    log(changed(before.user, after.user) || changed(before.body, after.body), 'Row 11: the Ask thread goes Compact', `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  } catch (e) { log(false, 'Row 15: Ask Vibe', short(e)); await shot(companion, 'askvibe-stuck'); stop('Ask Vibe failed'); }
}

// Row 11, a lesson (no call: opening a Library lesson reads it from this computer).
try {
  await companion.locator('.side').getByRole('button', { name: 'Library', exact: true }).click();
  await companion.locator('.topbar__title').filter({ hasText: 'Library' }).waitFor({ timeout: 10000 });
  // The list view (the cards are the default): its rows are the list row 11 asks about.
  await companion.locator('.mlib-view').getByRole('button', { name: 'List', exact: true }).click().catch(() => {});
  const row = companion.locator('.mlib-rows .m-row.mlib-row').first();
  if (await row.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
    const listComfy = await css(companion, '.mlib-rows .m-row.mlib-row');
    await setDensity('compact');
    const listCompact = await css(companion, '.mlib-rows .m-row.mlib-row');
    await shot(companion, 'row11-library-compact');
    await setDensity('comfortable');
    log(Boolean(listComfy && listCompact) && (listCompact.h < listComfy.h || parseFloat(listCompact.font) < parseFloat(listComfy.font)), 'Row 11: the Library list goes Compact', `${JSON.stringify(listComfy)} → ${JSON.stringify(listCompact)}`);
    await row.locator('button.mlib-row__open').click();
    await companion.locator('.mles .mles-rich').first().waitFor({ timeout: 10000 });
    const lesson = await css(companion, '.mles .mles-rich');
    await setDensity('compact');
    const lessonCompact = await css(companion, '.mles .mles-rich');
    await shot(companion, 'row11-lesson-compact');
    await setDensity('comfortable');
    await shot(companion, 'lesson');
    log(Boolean(lesson && lessonCompact) && (parseFloat(lessonCompact.font) < parseFloat(lesson.font) || lessonCompact.h < lesson.h), 'Row 11: a lesson goes Compact', `${JSON.stringify(lesson)} → ${JSON.stringify(lessonCompact)}`);
  } else note('Row 11: the Library list and a lesson', 'no lesson row found');
} catch (e) { log(false, 'Row 11: Library list and lesson', short(e)); }

// --- Row 14 again, with Run W's probe fixed (no call) -------------------------------------------------------------------
// As rc-0154.mjs: the code is never printed (only its length), and the app and browsers are quit right after.
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
if (process.env.CI !== 'true') note('Row 14', 'skipped outside CI (it starts a real Google sign-in and quits the browsers)');
else {
  try {
    await quitBrowsers();
    const before = await browserState();
    await companion.evaluate(() => window.unvibe.openSettings());
    await companion.locator('.mside').getByRole('button', { name: 'Account & Plan', exact: true }).click();
    const google = companion.locator('.modal .plan-board__signin .field-btn--google');
    await google.waitFor({ timeout: 10000 });
    let processAt = 0;
    let windowAt = 0;
    let lastMiss = 0; // when the last probe that found no browser window started
    const clickedAt = Date.now();
    await google.click();
    const watcher = (async () => {
      while (!windowAt && Date.now() - clickedAt < 30000) {
        const t = Date.now();
        const b = await browserState();
        if (b.process && !processAt) processAt = t;
        if (b.window) windowAt = Date.now(); else lastMiss = t;
        await sleep(100);
      }
    })();
    await companion.locator('.modal .signin__code b').first().waitFor({ timeout: 20000 });
    const codeAt = Date.now();
    const code = (await companion.locator('.modal .signin__code b').first().innerText()).trim();
    await watcher;
    const rel = (t) => (t ? `${t - clickedAt} ms` : 'not seen in 30 s');
    const shown = code ? `a code (${code.length} characters)` : 'no code';
    // Proven only if a probe that started after the code was on screen still found no browser window (each probe
    // takes time, so the first window is known only to lie between the last miss and the hit).
    if (before.window || !windowAt) note('Row 14: the browser window was not measured', `open before the click: ${before.window} (${before.what}); ${shown} at ${rel(codeAt)}; browser process ${rel(processAt)}, window ${rel(windowAt)}`);
    else if (code && codeAt <= lastMiss) log(true, 'Row 14: the device code shows in the app before the browser window opens', `${shown} at ${rel(codeAt)}; no browser window at ${rel(lastMiss)}; first window seen ${rel(windowAt)} after the click (browser process ${rel(processAt)})`);
    else if (!code || windowAt < codeAt) log(false, 'Row 14: the device code shows in the app before the browser window opens', `${shown} at ${rel(codeAt)}; a browser window was already seen ${rel(windowAt)} after the click`);
    else note('Row 14: inconclusive', `${shown} at ${rel(codeAt)}; the window appeared between ${rel(lastMiss)} and ${rel(windowAt)}, so the order is within one probe`);
  } catch (e) { log(false, 'Row 14: sign-in code before the browser', short(e)); }
  // The app's sign-in poll ends when it quits; the browsers go too.
  writeFileSync(path.join(out, 'main-process-before-row14-quit.log'), app.output.join(''));
  await app.close().catch(() => {});
  app = null;
  await quitBrowsers();
}

// --- Call (full): setup's sample on a new profile, row 5's explained state ------------------------------------------
if (PLAN === 'full' && !stopped) {
  try {
    await app?.close(); // row 14 (before this) has already quit it in CI
    const S = profile(process.env.RC_SAMPLE_PROFILE ?? mkdtempSync(path.join(tmpdir(), 'unvibe-rc0154-sample-')), process.env.RC_SAMPLE_ID ?? `qa-rc0154-sample-local-${Date.now()}`);
    ({ app, companion } = await start(S));
    line(`NOTE  sample profile install id ${readStore(S).installId}`);
    await companion.locator('.onboard__count').first().waitFor({ timeout: 20000 });
    await companion.getByPlaceholder('Your name').fill('Sam Test');
    await companion.getByRole('button', { name: "Let's go", exact: true }).click();
    await companion.locator('.onboard--step-1').waitFor({ timeout: 8000 });
    spend('setup sample ("Explain this code")');
    await companion.getByRole('button', { name: 'Explain this code', exact: true }).click();
    const sp = await waitFor(async () => panelWindow(), 20000, 250);
    if (!sp) throw new Error('the overlay did not open for the sample');
    await explanationDone(sp);
    await companion.locator('[role=group][aria-label="How was that explanation pitched?"]').waitFor({ timeout: 30000 }).catch(() => note('Row 5', 'the "How was that explanation pitched?" buttons did not show'));
    desktop('sample-explained');
    const cdp = await companion.context().newCDPSession(companion);
    try {
      for (const [w, h] of [[1280, 720], [1180, 780], [980, 620]]) {
        await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 0, mobile: false });
        await sleep(500);
        const r = await companion.evaluate(() => {
          const btn = document.querySelector('.onboard__foot .onboard__forward > button.onboard__primary');
          if (!btn) return null;
          const b = btn.getBoundingClientRect();
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          const scrolled = [document.scrollingElement, ...document.querySelectorAll('.onboard, .onboard *')].filter((el) => el && el.scrollTop > 0).length;
          return { label: btn.textContent.trim(), top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, onTop: Boolean(hit) && (hit === btn || btn.contains(hit)), scrolled };
        });
        await shot(companion, `row5-explained-${w}x${h}`);
        const ok = Boolean(r) && r.label === 'Next' && r.top >= 0 && r.bottom <= r.vh && r.onTop && r.scrolled === 0;
        if (w === 980) note(`Row 5: explained state at 980x620 (not in the ask; for the record)`, JSON.stringify(r));
        else log(ok, `Row 5: Try it, explained: Next fully in view with nothing scrolled at ${w}x${h}`, JSON.stringify(r));
      }
    } finally {
      await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
      await cdp.detach().catch(() => {});
    }
  } catch (e) { log(false, 'Row 5: the sample explained, Next in view', short(e)); stop('the setup sample failed'); }
} else if (PLAN === 'short') note('Row 5: explained state', 'short plan: the sample is not sent');

await sleep(2500); // one more pass of the dialog watcher
const asks = dialogs.filter((m) => /Open Unvibe when you log in/.test(m));
note('Native dialogs answered', dialogs.length ? dialogs.join(' | ') : `none seen${dialogWatchError ? ` (watcher error: ${dialogWatchError})` : ''}`);
if (spent > 0 && os !== 'linux') log(asks.length <= 1, 'The launch-at-login question shows at most once (answered No)', `${asks.length} time(s)`);
await finish();
