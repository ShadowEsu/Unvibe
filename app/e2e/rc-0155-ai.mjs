// Unvibe 0.1.55 RC rows that need hosted AI (RC app/rc-0155 601fc29d; QA plan agents/unvibe-qa/2026-11-19-thu1119/
// rc0155/WALK-PLAN.md, BOSS's budget: 3 hosted calls per system, Mac and Windows), run by real-device-test.yml (input
// rc0155=ai-mac or ai-windows, with ai=true) on ONE system per dispatch. The walk-only rows are in rc-0155.mjs.
//
// Hosted calls, counted: every action that sends goes through spend(), which refuses one past BUDGET (3; 2 with
// RC55_SKIP_TABLE=1, BOSS's cap for Run A Windows, Security SHOULD-RA1), and the first failed call
// step stops every later one:
//   CALL 1, #353: Explain pressed twice on the confirm sheet ("Explain this code?", reached as the editor link does it:
//           unvibe://review?source=ide with code on the clipboard; the agreement form comes first) → one POST.
//   CALL 2, #358: one Ask question for a small table of the answer's cases → every table fits the 320 px overlay.
//           Not sent with RC55_SKIP_TABLE=1 (ai-windows): the server prompt forbids tables, see CALL 2 below.
//   CALL 3, #353: Retry pressed twice on the error view → one POST. The error comes from api.unvibe.site pointing at
//           this machine (a hosts line, then the app restarted, so no old connection or DNS answer is reused), which
//           sends nothing to the API (checked: the runner's own request to it fails, and so does every one the app
//           made); the line is removed and the app's 60 s DNS cache waited out before Retry. The workflow removes the
//           line again in an always() step.
// The POSTs are counted in the app's Chromium net log (netlog.mjs: default mode; only time, method, path and status
// of the API's requests are kept, in netlog-ai-<os>-<n>.txt; the raw logs are written outside SHOTS_DIR and deleted).
// Both presses are two clicks on the same button in one task (a counter on the button proves both reached it), so
// the second can only be stopped by the main-process gate #353 adds. Nothing else here sends: the agreement form,
// stills, sizes.
//
// Env: UNVIBE_EXE, SHOTS_DIR, UNVIBE_OS (mac | windows; linux = a local run against a mock API), QA_AI_OK=1,
//      RC55_AI_PROFILE + RC55_AI_ID (a qa- id the workflow pre-flags and flags again after), NETLOG_DIR (outside
//      SHOTS_DIR), API_HOST (default api.unvibe.site), UNVIBE_APP_DIR + MOCK_DOWN_FILE (local run only: the mock API
//      answers 503 while that file exists, in place of the hosts line), RC55_SKIP_TABLE (1 = CALL 2 not sent).
import { launchApp, readStore } from './cdp-launch.mjs';
import { apiRequests, keepSummaryAndDrop, netLogArg } from './netlog.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
const appDir = process.env.UNVIBE_APP_DIR;
const os = process.env.UNVIBE_OS ?? (process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux');
const out = path.resolve(process.env.SHOTS_DIR ?? 'rc-0155-ai');
const host = process.env.API_HOST ?? 'api.unvibe.site';
const TMP = process.env.RUNNER_TEMP ?? tmpdir();
const netDir = path.resolve(process.env.NETLOG_DIR ?? mkdtempSync(path.join(TMP, 'unvibe-rc0155-netlog-')));
const BUDGET = process.env.RC55_SKIP_TABLE === '1' ? 2 : 3;
if (!exe) throw new Error('Set UNVIBE_EXE');
if (process.env.QA_AI_OK !== '1') throw new Error('rc-0155-ai.mjs sends hosted explanations: it needs QA_AI_OK=1 (workflow input ai=true)');
if (`${netDir}${path.sep}`.startsWith(`${out}${path.sep}`)) throw new Error('NETLOG_DIR must be outside SHOTS_DIR: the raw net log is never uploaded');
if (os === 'linux' && !process.env.MOCK_DOWN_FILE) throw new Error('A local run needs MOCK_DOWN_FILE (the mock API stands in for the hosts line)');
mkdirSync(out, { recursive: true });
mkdirSync(netDir, { recursive: true });

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
    if (v || Date.now() - t > ms) return v;
    await sleep(every);
  }
}

// --- The call budget ----------------------------------------------------------------------------------------------
let spent = 0;
let stopped = '';
/** Called right before an action that sends; refuses past the budget, or after a failed call step. */
function spend(what) {
  if (stopped) throw new Error(`not sent: an earlier call step failed (${stopped})`);
  if (spent + 1 > BUDGET) throw new Error(`not sent: ${what} would be call ${spent + 1} of ${BUDGET}`);
  spent += 1;
  line(`CALL  ${spent}/${BUDGET}: ${what}`);
}
const stop = (why) => { if (!stopped) { stopped = why; note('Every later call step is skipped', why); } };

async function shot(page, label) {
  const file = `${String(++n).padStart(2, '0')}-${label}.png`;
  try { await page.screenshot({ path: path.join(out, file), animations: 'disabled' }); } catch (e) { note(`still ${label}`, `not taken (${short(e)})`); }
}

// --- api.unvibe.site off and on (CALL 3) --------------------------------------------------------------------------
const MARK = '# unvibe-qa-rc0155';
const HOSTS = os === 'windows' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts';
const hostsLines = [`127.0.0.1 ${host} ${MARK}`, `::1 ${host} ${MARK}`];
function flushDns() {
  try {
    if (os === 'mac') { execFileSync('sudo', ['dscacheutil', '-flushcache']); execFileSync('sudo', ['killall', '-HUP', 'mDNSResponder']); }
    else if (os === 'windows') execFileSync('ipconfig', ['/flushdns'], { stdio: 'ignore' });
  } catch (e) { note('DNS cache flush', short(e)); }
}
// The hosts file's own bytes are saved before the block and written back exactly (Security MUST-H3); the workflow's
// always() step restores from the same copy if this script never gets there.
const HOSTS_ORIG = path.join(TMP, 'hosts.orig');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
function block() {
  if (os === 'linux') { writeFileSync(process.env.MOCK_DOWN_FILE, 'down'); return; }
  const orig = readFileSync(HOSTS);
  if (!existsSync(HOSTS_ORIG)) writeFileSync(HOSTS_ORIG, orig);
  note('The hosts file before the block', `sha256 ${sha256(orig)} (${orig.length} bytes; saved as $RUNNER_TEMP/hosts.orig)`);
  const eol = os === 'windows' ? '\r\n' : '\n';
  const add = `${eol}${hostsLines.join(eol)}${eol}`;
  if (os === 'mac') execFileSync('sudo', ['tee', '-a', HOSTS], { input: add, stdio: ['pipe', 'ignore', 'inherit'] });
  else writeFileSync(HOSTS, add, { flag: 'a' });
  flushDns();
}
/** Writes the saved bytes back (always safe to call again); without a saved copy, removes the marked lines. */
function unblock() {
  if (os === 'linux') { rmSync(process.env.MOCK_DOWN_FILE, { force: true }); return; }
  if (existsSync(HOSTS_ORIG)) {
    const orig = readFileSync(HOSTS_ORIG);
    if (os === 'mac') execFileSync('sudo', ['tee', HOSTS], { input: orig, stdio: ['pipe', 'ignore', 'inherit'] });
    else writeFileSync(HOSTS, orig);
    flushDns();
    const before = sha256(orig);
    const after = sha256(readFileSync(HOSTS));
    log(after === before, 'The hosts file is back byte for byte', `sha256 before ${before}, after ${after}`);
    return;
  }
  const kept = readFileSync(HOSTS, 'utf8').split(/\r?\n/).filter((l) => !l.endsWith(MARK)).join(os === 'windows' ? '\r\n' : '\n');
  if (os === 'mac') execFileSync('sudo', ['tee', HOSTS], { input: kept, stdio: ['pipe', 'ignore', 'inherit'] });
  else writeFileSync(HOSTS, kept);
  flushDns();
  note('The hosts file', 'a marked line was left from before this run and no saved copy exists: the marked lines were removed');
}
const hostsHasMark = () => os !== 'linux' && readFileSync(HOSTS, 'utf8').includes(MARK);
/** The runner's own request to the API: whether anything answers (any HTTP status) within 10 s. */
async function apiAnswers() {
  if (os === 'linux') return 'not checked (a local run: the mock API stands in for the hosts line)';
  try {
    const res = await fetch(`https://${host}/api/v1/health`, { signal: AbortSignal.timeout(10000) });
    return `HTTP ${res.status}`;
  } catch (e) { return `no answer (${short(e.cause ?? e)})`; }
}

// --- The app ------------------------------------------------------------------------------------------------------
function profile(dir, installId, extra = {}) {
  mkdirSync(dir, { recursive: true });
  if (!existsSync(path.join(dir, 'unvibe-store.json'))) writeFileSync(path.join(dir, 'unvibe-store.json'), JSON.stringify({ installId, ...extra }));
  return dir;
}
// The launch-at-login question is seeded as already asked (store.ts loginPromptAsked), so no native dialog sits over
// the overlay (0.1.54 Run B 44425517304); it is not a row here.
const A = profile(process.env.RC55_AI_PROFILE ?? mkdtempSync(path.join(TMP, 'unvibe-rc0155-ai-')), process.env.RC55_AI_ID ?? `qa-rc0155-ai-local-${Date.now()}`, { loginPromptAsked: true });
const env = { ...process.env, UNVIBE_USER_DATA: A };
for (const key of Object.keys(env)) {
  if (/^(UNVIBE_ADMIN_STATS_TOKEN|UNVIBE_QA_FLAG_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_.*)$/.test(key)) delete env[key];
}
const appArgs = [...(appDir ? [appDir] : []), ...(os === 'linux' ? ['--use-mock-keychain'] : [])];
const netlogs = [];
let app = null;
let companion = null;
async function start() {
  const file = path.join(netDir, `netlog-ai-${os}-${netlogs.length + 1}.json`);
  netlogs.push(file);
  app = await launchApp({ exe, userData: A, env, timeout: 90000, args: [...appArgs, netLogArg(file)] });
  companion = await app.windowWith('companion.html', 60000);
  if (!companion) throw new Error('the main window did not open');
  await companion.waitForLoadState('domcontentloaded');
}
const reviews = (from, to = Infinity) => apiRequests(netlogs.at(-1), host).filter((r) => r.method === 'POST' && r.path === '/api/v1/reviews' && r.t >= from && r.t <= to);
const panelWindow = () => app.windows().find((w) => w.url().includes('widget.html') && !w.isClosed());

const CODE = [
  'function pickRoute(routes, path, ...params) {',
  '  const hit = routes.find((r) => r.match(path, ...params));',
  '  if (hit) return hit.handler;',
  "  if (path === '') return pickRoute(routes, '/', ...params);",
  '  return fallback;',
  '}',
].join('\n');
const CODE_RETRY = 'function clampPage(page, total, size = 20) {\n  const last = Math.max(1, Math.ceil(total / size));\n  return Math.min(Math.max(1, page), last);\n}';
function setClipboard(text) {
  if (os === 'mac') execFileSync('pbcopy', { input: text });
  else if (os === 'windows') {
    const file = path.join(TMP, 'unvibe-rc0155-clip.txt');
    writeFileSync(file, text);
    execFileSync('powershell', ['-NoProfile', '-Command', `Get-Content -Raw -LiteralPath '${file}' | Set-Clipboard`], { timeout: 30000 });
  } else return companion.evaluate((t) => navigator.clipboard.writeText(t), text);
  return null;
}
/**
 * The editor bridge's link, delivered as real-device.mjs does it (proven in the ai=true walks): macOS asks Launch
 * Services for the registered unvibe:// handler (`open`), which hands the link to the running app (open-url);
 * Windows gets the handler setAsDefaultProtocolClient writes, pointed at this run's profile, and `start`s the link,
 * so the second start hands it to the running app (second-instance) and exits. A local Linux run starts the second
 * instance itself.
 * Windows: `start` runs with this run's app env (UNVIBE_USER_DATA = the profile), which the handler's copy inherits,
 * as real-device.mjs's does. Without it that copy did not hand over: probe 44660771135 (rc0155=link) saw a second
 * Unvibe start and no overlay, on 0.1.54 and on the RC alike, and the overlay in ~300 ms with it. The handler is
 * written before every link, because the app writes its own ("exe" "%1") each time it starts.
 */
async function openLink() {
  const url = 'unvibe://review?source=ide';
  if (os === 'mac') execFileSync('open', [url], { timeout: 15000 });
  else if (os === 'windows') {
    const key = 'HKCU\\Software\\Classes\\unvibe\\shell\\open\\command';
    execFileSync('reg', ['add', key, '/ve', '/t', 'REG_SZ', '/d', `"${exe}" --user-data-dir=${A} "%1"`, '/f']);
    if (!execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8' }).includes(`--user-data-dir=${A}`)) throw new Error('the unvibe:// handler was not registered');
    execFileSync('cmd', ['/c', 'start', '', url], { env });
  } else spawn(exe, [...appArgs, url], { env, stdio: 'ignore', detached: true }).unref();
}
/** Unvibe main processes (not its renderer/GPU/utility children), each with its parent and command line; null where
 *  not listed (a local Linux run). */
const mainList = () => {
  try {
    if (os === 'mac') {
      const pids = execFileSync('pgrep', ['-x', 'Unvibe'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
      return execFileSync('ps', ['-o', 'pid=,ppid=,command=', '-p', pids.join(',')], { encoding: 'utf8' }).trim().split('\n')
        .map((l) => { const [, pid, ppid, cmd] = l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/) ?? []; return { pid: Number(pid), ppid: Number(ppid), cmd }; });
    }
    if (os === 'windows') {
      const json = execFileSync('powershell', ['-NoProfile', '-Command',
        "@(Get-CimInstance Win32_Process -Filter \"Name='Unvibe.exe'\" | Where-Object { $_.CommandLine -notmatch '--type=' } | ForEach-Object { [pscustomobject]@{ pid = $_.ProcessId; ppid = $_.ParentProcessId; cmd = $_.CommandLine } }) | ConvertTo-Json -Compress"],
        { encoding: 'utf8', timeout: 30000 }).trim();
      if (!json) return [];
      const v = JSON.parse(json);
      return Array.isArray(v) ? v : [v];
    }
  } catch { return []; }
  return null;
};
const mainProcesses = () => mainList()?.length ?? null;
/**
 * The link's own copy should hand the link over and quit (requestSingleInstanceLock() false → 'second-instance' in the
 * running app → quit). Run 44835707720 counted 2 main processes as soon as the overlay showed, so the list is now read
 * every 250 ms until one is left or 3 s after the link (the lead), and every reading is kept: a copy that is gone by
 * then was the hand-off caught midway; one still there is a second Unvibe, reported with both command lines.
 */
async function mainAfterLink(linkAt, ms = 3000) {
  const seen = [];
  for (;;) {
    const list = mainList();
    if (list === null) return { left: null, seen: 'not listed on this system' };
    const at = Date.now() - linkAt;
    seen.push(`+${at} ms: ${list.length} [${list.map((p) => `pid ${p.pid} (parent ${p.ppid}) ${String(p.cmd ?? '').split(exe).join('<exe>')}`).join('; ')}]`);
    if (list.length <= 1 || at >= ms) return { left: list.length, seen: seen.join(' → ') };
    await sleep(250);
  }
}
const noOverlay = () => {
  const m = mainProcesses();
  return new Error(`the overlay did not open for the link${m !== null && m > 1 ? ` (${m} Unvibe main processes: a second Unvibe started instead of handing the link over)` : ''}`);
};
/**
 * #375 (RC3): the link's own copy hands the link over and quits without making a window. The 3 s process check can't
 * show that (unvibe-app: the losing copy lives about 1.2 s with or without the fix), so a PowerShell watcher, started
 * just before the link, lists every 100 ms for 4 s each Unvibe main process other than the running app (`appPid`) with
 * its top-level windows (EnumWindows: class, visible or hidden, title). Chromium's BrowserWindows are class
 * Chrome_WidgetWin_1: unvibe-app's Linux probe saw RC2's losing copy make three (Island, companion, panel) and #375's
 * none. Windows only; null elsewhere. Nothing here touches the app.
 */
function watchLinkCopy(appPid) {
  if (os !== 'windows') return null;
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -TypeDefinition @'",
    'using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;',
    'public static class QaWin {',
    '  public delegate bool Cb(IntPtr h, IntPtr l);',
    '  [DllImport("user32.dll")] static extern bool EnumWindows(Cb f, IntPtr l);',
    '  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
    '  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);',
    '  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);',
    '  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);',
    '  public static string Of(uint want) {',
    '    var r = new List<string>();',
    '    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == want) { var c = new StringBuilder(256); GetClassName(h, c, 256); var t = new StringBuilder(256); GetWindowText(h, t, 256); r.Add(c + (IsWindowVisible(h) ? " visible" : " hidden") + (t.Length > 0 ? " \\"" + t + "\\"" : "")); } return true; }, IntPtr.Zero);',
    '    return string.Join("; ", r);',
    '  }',
    '}',
    "'@",
    "'ready'",
    '$t0 = [DateTime]::UtcNow',
    'while (([DateTime]::UtcNow - $t0).TotalMilliseconds -lt 4000) {',
    '  $ms = [int]([DateTime]::UtcNow - $t0).TotalMilliseconds',
    `  foreach ($p in @(Get-CimInstance Win32_Process -Filter "Name='Unvibe.exe'" | Where-Object { $_.CommandLine -notmatch '--type=' -and $_.ProcessId -ne ${Number(appPid)} })) {`,
    "    'seen ' + $ms + ' ' + $p.ProcessId + ' ' + [QaWin]::Of([uint32]$p.ProcessId)",
    '  }',
    '  Start-Sleep -Milliseconds 100',
    '}',
    "'end'",
  ].join('\n');
  const child = spawn('powershell', ['-NoProfile', '-Command', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  const done = new Promise((r) => child.on('close', () => r({ out, err })));
  return { ready: () => waitFor(async () => out.includes('ready'), 30000, 100), done, stop: () => child.kill() };
}
/** The watcher's lines, per process: when it was seen and the most BrowserWindows (Chrome_WidgetWin_1) it had. */
function linkCopyRow(res) {
  const seen = new Map();
  for (const l of res.out.split(/\r?\n/)) {
    const m = l.match(/^seen (\d+) (\d+) ?(.*)$/);
    if (!m) continue;
    const s = seen.get(m[2]) ?? { first: Number(m[1]), last: 0, most: 0, windows: new Set() };
    s.last = Number(m[1]);
    const wins = m[3] ? m[3].split('; ') : [];
    s.most = Math.max(s.most, wins.filter((w) => w.startsWith('Chrome_WidgetWin_1')).length);
    for (const w of wins) s.windows.add(w);
    seen.set(m[2], s);
  }
  const detail = [...seen].map(([pid, s]) => `pid ${pid} seen +${s.first}..+${s.last} ms, at most ${s.most} BrowserWindow(s); its windows: ${[...s.windows].join('; ') || 'none'}`).join(' | ');
  return { seen: seen.size, most: Math.max(0, ...[...seen.values()].map((s) => s.most)), detail, ended: res.out.includes('end') };
}
/** Two clicks on the same button in one task; returns how many reached it. */
const pressTwice = (panel, phaseClass, label) => panel.evaluate(({ phaseClass, label }) => {
  const button = [...document.querySelectorAll(`.ob.${phaseClass} .ob-actions button`)].find((b) => b.textContent.trim() === label);
  if (!button) return -1;
  let reached = 0;
  button.addEventListener('click', () => { reached += 1; }, true);
  button.click();
  button.click();
  return reached;
}, { phaseClass, label });
async function explanationDone(panel, ms = 120000) {
  await panel.locator('.ob.ob--done').waitFor({ timeout: ms });
  await panel.locator('.ob-answer .cursor').waitFor({ state: 'detached', timeout: 60000 });
  await panel.locator('button.ob-question:not([disabled])').first().waitFor({ timeout: 30000 });
  return (await panel.locator('.ob-answer').first().innerText()).trim();
}
const tables = (panel) => panel.evaluate(() => ({
  width: innerWidth,
  theme: document.documentElement.dataset.theme ?? 'unset',
  tables: [...document.querySelectorAll('.rich-table')].map((t) => ({
    columns: t.querySelector('tr')?.children.length ?? 0, scrollWidth: t.scrollWidth, clientWidth: t.clientWidth,
    cue: Boolean(t.parentElement?.querySelector('.rich-table__cue')),
  })),
}));

line(`NOTE  mode: AI run on ${os} (at most ${BUDGET} hosted calls; each is listed as CALL n/${BUDGET})`);
if (hostsHasMark()) unblock();
try { await start(); } catch (e) { log(false, 'The RC opens', short(e)); stop('the RC did not open'); }
const info = app ? await companion.evaluate(() => window.unvibe.appInfo()) : { version: '?' };
line(`NOTE  Unvibe ${info.version}, install id ${readStore(A).installId}`);
// Only the RC under test may send. A local run against the mock may name another build (LOCAL_VERSION), to show that
// the checks fail on a build without the fixes.
const WANT = os === 'linux' && process.env.LOCAL_VERSION ? process.env.LOCAL_VERSION : '0.1.55';
if (info.version !== WANT) { log(false, `The AI run needs the ${WANT} RC`, `this build is ${info.version}; nothing was sent`); stop(`not the ${WANT} RC`); }
if (!stopped) try {
  await companion.locator('.onboard__count').first().waitFor({ timeout: 20000 });
  await companion.getByPlaceholder('Your name').fill('Sam Test');
  await companion.getByRole('button', { name: "Let's go", exact: true }).click();
  for (const next of ['3 /', null]) {
    await companion.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 8000 });
    if (next) await companion.locator('.onboard__count').filter({ hasText: next }).waitFor({ timeout: 8000 });
  }
  await companion.locator('.onboard').waitFor({ state: 'detached', timeout: 10000 });
  await companion.locator('.topbar__title').filter({ hasText: 'Today' }).waitFor({ timeout: 15000 });
  await companion.evaluate(() => window.unvibe.setSettings({ theme: 'light' }));
} catch (e) { log(false, 'Setup skipped to Today', short(e)); await shot(companion, 'setup-stuck'); stop('setup failed'); }

// --- CALL 1, #353: Explain pressed twice on the confirm sheet -----------------------------------------------------
let panel = null;
const t1 = {};
if (!stopped) try {
  await setClipboard(CODE);
  const watch = watchLinkCopy(app.process.pid);
  const watchReady = watch ? await watch.ready() : false;
  const linkAt = Date.now();
  await openLink();
  panel = await waitFor(async () => panelWindow(), 20000, 250);
  if (!panel) throw noOverlay();
  const panelMs = Date.now() - linkAt;
  const after = await mainAfterLink(linkAt);
  note('#353: Unvibe main processes after the link', after.seen);
  if (after.left !== null && after.left !== 1) throw new Error(`${after.left} Unvibe main processes 3 s after the link (expected the one running): ${after.seen}`);
  // #375 (the lead): the running app still opens the panel for the link; no "shortcut is in use" notice (notify() shows
  // it only on an Island, notify.ts:39-47: the running app's is read here, and a link copy with no window has none);
  // the link copy makes no window. Read ≥ 3 s after the link, inside the notice's 9 s on the Island.
  log(true, '#375: the running app opens the panel for the link', `${panelMs} ms after the link, in the running app (pid ${app.process.pid})`);
  const island = app.windows().find((w) => w.url().includes('bar.html') && !w.isClosed());
  const islandText = island ? ((await island.evaluate(() => document.body.innerText).catch(() => '')) ?? '').replace(/\s+/g, ' ').trim() : null;
  if (islandText === null) note('#375: the running app\'s Island', 'no Island page to read');
  else log(!/in use by another app/i.test(islandText), '#375: no "That shortcut is in use" notice on the running app\'s Island after the link', `Island text: "${islandText.slice(0, 120)}"`);
  if (watch) {
    const res = await Promise.race([watch.done, sleep(15000).then(() => null)]);
    if (!res) { watch.stop(); note('#375: the link\'s own copy', 'the window watcher did not finish in 15 s'); }
    else if (!watchReady || !res.out.includes('ready')) note('#375: the link\'s own copy', `the window watcher did not start: ${short(res.err) || 'no output'}`);
    else {
      const r = linkCopyRow(res);
      if (!r.seen) note('#375: the link\'s own copy', 'not caught: no second Unvibe main process in any 100 ms reading over 4 s');
      else log(r.most === 0, '#375: the link\'s own copy hands the link over and quits without a window (0 BrowserWindows, so no Island of its own and no shortcut notice)', r.detail);
    }
  }
  const consent = panel.locator('.ob.ob--aiConsent .consent-form');
  await consent.waitFor({ timeout: 20000 });
  const boxes = consent.locator('input[type="checkbox"]');
  if ((await boxes.count()) !== 3) throw new Error('the agreement form does not have three boxes');
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  await consent.getByRole('button', { name: 'Continue', exact: true }).click();
  await panel.locator('.ob.ob--confirm').waitFor({ timeout: 20000 });
  const sheet = await panel.evaluate(() => ({ title: document.querySelector('#confirm-title')?.textContent, preview: document.querySelector('.ob-preview code')?.textContent ?? '' }));
  if (!sheet.preview.includes('pickRoute')) throw new Error(`the confirm sheet does not show the clipboard's code ("${sheet.title}")`);
  await shot(panel, 'call1-confirm-sheet');
  if (reviews(0).length) throw new Error('an explanation was sent before Explain');
  spend('#353: Explain pressed twice on the confirm sheet (one explanation expected)');
  t1.press = Date.now();
  t1.reached = await pressTwice(panel, 'ob--confirm', 'Explain');
  if (t1.reached !== 2) throw new Error(`the presses that reached Explain: ${t1.reached}`);
  const text = await explanationDone(panel);
  t1.done = Date.now();
  t1.answers = await panel.locator('.ob-answer').count();
  t1.chars = text.length;
  t1.tables = await tables(panel);
  await shot(panel, 'call1-done');
  await sleep(3000);
} catch (e) {
  log(false, '#353: Explain pressed twice on the confirm sheet', short(e));
  if (panel && !panel.isClosed()) await shot(panel, 'call1-stuck');
  stop('call 1 failed');
}

// --- CALL 2, #358: a table answer in the 320 px overlay ------------------------------------------------------------
const t2 = {};
async function capture(label) {
  const size = await panel.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const cdp = await panel.context().newCDPSession(panel);
  const got = [];
  try {
    for (const scale of [1, 2]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: scale, mobile: false });
      await sleep(500);
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const png = Buffer.from(data, 'base64');
      writeFileSync(path.join(out, `${String(++n).padStart(2, '0')}-${label}-${scale}x.png`), png);
      // A PNG's width and height are the IHDR chunk's first two 4-byte fields (bytes 16-23).
      got.push({ scale, w: png.readUInt32BE(16), h: png.readUInt32BE(20) });
    }
  } finally {
    await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await cdp.detach().catch(() => {});
  }
  return { size, got, sized: got.every((g) => g.w === size.w * g.scale && g.h === size.h * g.scale) };
}
// RC55_SKIP_TABLE=1 (the workflow sets it for ai-windows; the lead's option 3, requests/unvibe/20261119-1753-…): the
// server tells the model "No markdown tables" (web/src/ai/prompt.ts:54), so Run A Mac 44656303317's ask got none and a
// second ask would most likely spend a call to show nothing. #358 then stays NOT SHOWN by a hosted answer.
const SKIP_TABLE = process.env.RC55_SKIP_TABLE === '1';
if (SKIP_TABLE && !stopped) note('#358: CALL 2 not sent (NOT SHOWN by a hosted answer)', 'the server prompt forbids markdown tables (web/src/ai/prompt.ts:54); Run A Mac 44656303317 asked for one and got none; skipped by the lead\'s choice (requests/unvibe/20261119-1753-unvibe-qa-rc0155-358-table.md)');
if (!stopped && !SKIP_TABLE) try {
  const box = panel.locator('input.ob-ask__input');
  await box.waitFor({ timeout: 10000 });
  await box.fill('Show the cases pickRoute handles as a small markdown table with three columns: Case, Code (the exact expression from the function, in backticks) and What it returns.');
  spend('#358: one Ask question for a table');
  t2.sent = Date.now();
  await box.press('Enter');
  await panel.locator('.ob-thread__turn').first().waitFor({ timeout: 20000 });
  await waitFor(async () => (await panel.locator('.ob-thread__turn .cursor').count()) === 0 && (await panel.locator('input.ob-ask__input:not([disabled])').count()) > 0
    && (await panel.locator('.ob-thread__turn .ob-answer').last().innerText()).trim().length > 0, 120000, 500);
  t2.done = Date.now();
  await sleep(800);
  t2.fit = await tables(panel);
  t2.error = await panel.locator('.ob-thread__turn [role="alert"]').count();
  await panel.evaluate(() => document.querySelector('.ob-thread__turn .rich-table')?.scrollIntoView({ block: 'center' }));
  t2.stills = await capture('call2-table');
} catch (e) {
  log(false, '#358: a table answer in the 320 px overlay', short(e));
  if (panel && !panel.isClosed()) await shot(panel, 'call2-stuck');
  stop('call 2 failed');
}
const tableLines = () => (app ? app.output.join('').split('\n').filter((l) => l.startsWith('[table] ')) : []);
t2.logLines = tableLines();

// --- CALL 3, #353: Retry pressed twice on the error view -----------------------------------------------------------
const t3 = {};
if (!stopped) try {
  await app.close();
  block();
  t3.runner = await apiAnswers();
  if (os !== 'linux' && !t3.runner.startsWith('no answer')) throw new Error(`the API still answers this runner with the hosts line in (${t3.runner}); nothing pressed`);
  await start();
  await companion.locator('.topbar__title, .onboard--welcome').first().waitFor({ timeout: 20000 });
  await setClipboard(CODE_RETRY);
  t3.blockedFrom = Date.now();
  await openLink();
  panel = await waitFor(async () => panelWindow(), 20000, 250);
  if (!panel) throw noOverlay();
  const after3 = await mainAfterLink(t3.blockedFrom);
  note('#353 Retry: Unvibe main processes after the link', after3.seen);
  if (after3.left !== null && after3.left !== 1) throw new Error(`${after3.left} Unvibe main processes 3 s after the link (expected the one running): ${after3.seen}`);
  await panel.locator('.ob.ob--confirm').waitFor({ timeout: 20000 });
  // Explain while blocked: nothing can reach the API, so this is not a call (checked below from the net log).
  await panel.evaluate(() => [...document.querySelectorAll('.ob.ob--confirm .ob-actions button')].find((b) => b.textContent.trim() === 'Explain')?.click());
  const ended = await waitFor(async () => (await panel.locator('.ob.ob--error, .ob.ob--done').count()) > 0, 90000, 250);
  if (!ended) throw new Error('neither the error view nor an answer after Explain while blocked');
  if (await panel.locator('.ob.ob--done').count()) {
    line(`CALL  ${spent + 1}/${BUDGET}: NOT PLANNED: Explain while blocked reached the API and was answered`);
    spent += 1;
    throw new Error('Explain while blocked was answered: the block did not hold; Retry not pressed');
  }
  t3.error = (await panel.locator('.ob.ob--error .ob-sub').first().innerText()).trim();
  await shot(panel, 'call3-error');
  unblock();
  t3.unblocked = Date.now();
  // The app keeps a DNS answer up to 60 s (Chromium's host cache): wait it out, then check the runner reaches the API.
  if (os !== 'linux') await sleep(65000);
  t3.runnerAfter = await apiAnswers();
  if (os !== 'linux' && t3.runnerAfter.startsWith('no answer')) throw new Error(`the API does not answer after the hosts line was removed (${t3.runnerAfter}); Retry not pressed`);
  spend('#353: Retry pressed twice on the error view (one explanation expected)');
  t3.press = Date.now();
  t3.reached = await pressTwice(panel, 'ob--error', 'Retry');
  if (t3.reached !== 2) throw new Error(`the presses that reached Retry: ${t3.reached}`);
  await explanationDone(panel);
  t3.done = Date.now();
  await shot(panel, 'call3-done');
  await sleep(3000);
} catch (e) {
  log(false, '#353: Retry pressed twice on the error view', short(e));
  if (panel && !panel.isClosed()) await shot(panel, 'call3-stuck');
  stop('call 3 failed');
} finally {
  if (hostsHasMark() || (os === 'linux' && existsSync(process.env.MOCK_DOWN_FILE))) unblock();
}

// --- Verdicts, from the whole net logs once the app has quit ---------------------------------------------------------
t2.logLines = [...t2.logLines, ...tableLines().filter((l) => !t2.logLines.includes(l))];
if (app) writeFileSync(path.join(out, 'main-process-table-lines.txt'), `${tableLines().join('\n')}\n`);
await app?.close().catch(() => {});
const logs = netlogs.map((file, i) => keepSummaryAndDrop(file, host, path.join(out, `netlog-ai-${os}-${i + 1}.txt`)));
line(`NOTE  net logs: ${logs.map((l, i) => `#${i + 1} ${l.length} request(s)`).join(', ')} to ${host}, kept as time, method, path and status; the raw logs are deleted`);
const posts = (requests, from, to) => requests.filter((r) => r.method === 'POST' && r.path === '/api/v1/reviews' && r.t >= from && r.t <= to);

if (t1.done) {
  const p = posts(logs[0], t1.press - 500, t1.done + 3000);
  log(p.length === 1 && t1.answers >= 1, '#353: Explain pressed twice on the confirm sheet sends one explanation',
    `${t1.reached} presses reached Explain; POST /api/v1/reviews ${p.length} time(s) (status ${p.map((r) => r.status || '-').join('/') || '-'}); answer ${t1.chars} characters`);
  if (t1.tables.tables.length) note('#358: tables in the explanation itself', JSON.stringify(t1.tables));
}
if (t2.done) {
  const fit = t2.fit.tables;
  const ok = fit.length > 0 && fit.every((t) => t.scrollWidth <= t.clientWidth + 1 && !t.cue);
  const detail = `overlay ${t2.fit.width} CSS px wide, theme ${t2.fit.theme}; ${fit.length} table(s): ${fit.map((t) => `${t.columns} columns ${t.scrollWidth} of ${t.clientWidth} px${t.cue ? ' (scroll cue shown)' : ''}`).join('; ') || 'none'}; stills ${t2.stills?.got.map((g) => `${g.scale}x ${g.w}x${g.h}`).join(', ')} (size checked ${t2.stills?.sized}); main-process [table] lines: ${t2.logLines.length ? t2.logLines.join(' | ') : 'none (the app reports explanation tables only)'}`;
  if (!fit.length) note('#358: the answer had no table, so this run does not show the 320 px fit (not a pass)', detail);
  else log(ok && t2.fit.width === 320 && t2.stills?.sized, '#358: a table answer fits the 320 px overlay (no sideways scroll, no scroll cue)', detail);
  if (t2.error) log(false, '#358: the Ask answer', 'the turn shows an error');
}
if (t3.done) {
  const blocked = posts(logs[1], t3.blockedFrom, t3.unblocked);
  const p = posts(logs[1], t3.unblocked, t3.done + 3000);
  // Blocked means no answer from the API at all; a local run's mock answers 503 instead.
  const unanswered = (r) => (os === 'linux' ? r.status === 503 : !r.status);
  log(p.length === 1 && blocked.every(unanswered), '#353: Retry pressed twice on the error view sends one explanation',
    `while blocked: the runner's own request ${t3.runner}; the app's POSTs ${blocked.length}, status ${blocked.map((r) => r.status || 'none').join('/') || '-'}; error "${t3.error}". After the hosts line was removed (runner: ${t3.runnerAfter}): ${t3.reached} presses reached Retry; POST /api/v1/reviews ${p.length} time(s) (status ${p.map((r) => r.status || '-').join('/') || '-'})`);
}
line(`NOTE  hosted calls sent by this run: ${spent} of ${BUDGET}${stopped ? ` (stopped: ${stopped})` : ''}; the lead's meter should move by the same number`);
writeFileSync(path.join(out, 'report-ai.txt'), `Unvibe 0.1.55 RC rows, AI run (${os})\n\n${report.join('\n')}\n`);
process.exit(report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
