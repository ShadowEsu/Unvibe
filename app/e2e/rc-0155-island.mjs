// Unvibe 0.1.55 RC2 Island rows with no hosted-AI call (RC2 app/rc-0155 9b93b329 = 601fc29d + #374, Security
// SHOULD-372c; QA setup-0157 still mac-11: the Island kept saying Reading after ⌃U → the agreement → Not now). Run by
// real-device-test.yml (input rc0155=island, with build_run and ai off) on GitHub's macOS and Windows machines.
//
// The whole launch runs with api.unvibe.site pointed at addresses nothing answers from (TEST-NET-1 192.0.2.1 and the
// discard-only 100::1, marked lines in the hosts file; the file's own bytes are saved first and written back, checked
// by sha256). A request there hangs and then fails: no byte reaches the API. Fail-closed probes (Security MUST-D5a's
// shape) stop the run before anything is pressed:
//   before the launch: the runner's own GET /api/v1/health gets no answer, getaddrinfo gives only 192.0.2.1 / 100::1,
//                      and on the Mac dscacheutil shows 192.0.2.1;
//   before any press:  the app's net log so far has no request to the API with an answer.
// Rows:
//   I1 fresh profile, no agreement: the shortcut (⌃U / Ctrl+Alt+U, an OS key event) opens the panel on the agreement;
//      the Island never says Reading, Checking or Writing; Not now; the Island stays idle (nothing was read).
//   I2 the agreement given (the editor link with a line on the clipboard: the form, then the confirm sheet), then
//      Explain: the Island says Reading, then Checking while the request hangs; the panel is closed (its Close button);
//      the Island goes idle within 2 s and stays idle for 10 s. The request never reaches the API (the hosts lines).
// The Island's phase is read from its page (bar.html: the island--phase-<phase> class and the status word), logged
// with times by a MutationObserver (read only).
//
// Env: UNVIBE_EXE, SHOTS_DIR, UNVIBE_OS (mac | windows), RC55_ISLAND_PROFILE + RC55_ISLAND_ID (a qa- id the workflow
//      pre-flags and flags again after), NETLOG_DIR (outside SHOTS_DIR), API_HOST (default api.unvibe.site).
import { launchApp, readStore } from './cdp-launch.mjs';
import { apiRequests, keepSummaryAndDrop, netLogArg } from './netlog.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
const appDir = process.env.UNVIBE_APP_DIR;
const os = process.env.UNVIBE_OS ?? (process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'mac' : 'linux');
const out = path.resolve(process.env.SHOTS_DIR ?? 'rc-0155-island');
const host = process.env.API_HOST ?? 'api.unvibe.site';
const TMP = process.env.RUNNER_TEMP ?? tmpdir();
const netDir = path.resolve(process.env.NETLOG_DIR ?? mkdtempSync(path.join(TMP, 'unvibe-rc0155-netlog-')));
if (!exe) throw new Error('Set UNVIBE_EXE');
// A local Linux run (UNVIBE_APP_DIR, UNVIBE_BACKEND = a local server that never answers) stands in for the hosts lines.
if (os === 'linux' && (!appDir || !process.env.UNVIBE_BACKEND?.startsWith('http://127.0.0.1:'))) throw new Error('A local Linux run needs UNVIBE_APP_DIR and UNVIBE_BACKEND=http://127.0.0.1:<a port that never answers>');
if (!['mac', 'windows', 'linux'].includes(os)) throw new Error('UNVIBE_OS must be mac or windows (linux: a local run)');
if (process.env.QA_AI_OK === '1') throw new Error('rc-0155-island.mjs makes no hosted-AI call: run it with ai off');
if (`${netDir}${path.sep}`.startsWith(`${out}${path.sep}`)) throw new Error('NETLOG_DIR must be outside SHOTS_DIR: the raw net log is never uploaded');
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
    const v = await fn().catch(() => null);
    if (v || Date.now() - t > ms) return v;
    await sleep(every);
  }
}
async function shot(page, label) {
  const file = `${os}-${String(++n).padStart(2, '0')}-${label}.png`;
  try { await page.screenshot({ path: path.join(out, file), animations: 'disabled' }); } catch (e) { note(`still ${label}`, `not taken (${short(e)})`); }
}

// --- api.unvibe.site pointed at addresses nothing answers from ----------------------------------------------------
// The same marker and saved copy as rc-0155-ai.mjs, so the workflow's always() put-back steps cover this file too.
const MARK = '# unvibe-qa-rc0155';
const HOSTS = os === 'windows' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts';
const SINK = ['192.0.2.1', '100::1'];
const HOSTS_ORIG = path.join(TMP, 'hosts.orig');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
function flushDns() {
  if (os === 'mac') { execFileSync('sudo', ['-n', 'dscacheutil', '-flushcache']); execFileSync('sudo', ['-n', 'killall', '-HUP', 'mDNSResponder']); }
  else execFileSync('ipconfig', ['/flushdns'], { stdio: 'ignore' });
}
let hostsBefore = null;
function block() {
  if (os === 'linux') { note('The API host', `a local run: UNVIBE_BACKEND ${process.env.UNVIBE_BACKEND} never answers (the stand-in for the hosts lines)`); return; }
  const orig = readFileSync(HOSTS);
  if (orig.includes(MARK)) throw new Error('the hosts file already holds a marked line; nothing was changed');
  hostsBefore = sha256(orig);
  writeFileSync(HOSTS_ORIG, orig);
  const eol = os === 'windows' ? '\r\n' : '\n';
  const add = `${eol}${SINK.map((a) => `${a} ${host} ${MARK}`).join(eol)}${eol}`;
  if (os === 'mac') execFileSync('sudo', ['-n', 'tee', '-a', HOSTS], { input: add, stdio: ['pipe', 'ignore', 'inherit'] });
  else writeFileSync(HOSTS, add, { flag: 'a' });
  flushDns();
  note('The API host pointed at addresses nothing answers from', `${host} → ${SINK.join(' and ')} in ${HOSTS} (marked "${MARK}"); sha256 before ${hostsBefore}, saved as $RUNNER_TEMP/hosts.orig`);
}
function unblock() {
  if (!hostsBefore) return;
  const orig = readFileSync(HOSTS_ORIG);
  if (os === 'mac') execFileSync('sudo', ['-n', 'tee', HOSTS], { input: orig, stdio: ['pipe', 'ignore', 'inherit'] });
  else writeFileSync(HOSTS, orig);
  flushDns();
  const now = sha256(readFileSync(HOSTS));
  log(now === hostsBefore && !readFileSync(HOSTS, 'utf8').includes(MARK), 'The hosts file is back byte for byte', `sha256 before ${hostsBefore}, now ${now}`);
  hostsBefore = null;
}
/** Before the launch (Security MUST-D5a's shape): the runner can't reach the API, and the name resolves only to SINK. */
async function runnerBlocked() {
  let runner;
  try {
    const res = await fetch(`${os === 'linux' ? 'http' : 'https'}://${host}/api/v1/health`, { signal: AbortSignal.timeout(10000) });
    runner = `HTTP ${res.status}`;
  } catch (e) { runner = `no answer (${short(e.cause ?? e)})`; }
  const addrs = os === 'linux' ? ['not looked up (a local run)'] : await lookup(host, { all: true }).then((a) => a.map((x) => x.address)).catch((e) => [`lookup failed (${short(e)})`]);
  const resolverOk = os === 'linux' || (addrs.length > 0 && addrs.every((a) => SINK.includes(a)));
  let dns = '';
  let dnsOk = true;
  if (os === 'mac') {
    try { dns = execFileSync('dscacheutil', ['-q', 'host', '-a', 'name', host], { encoding: 'utf8', timeout: 15000 }).trim().replace(/\s+/g, ' '); } catch (e) { dns = `dscacheutil failed (${short(e)})`; }
    const v4 = [...dns.matchAll(/ip_address: (\S+)/g)].map((m) => m[1]);
    dnsOk = v4.length > 0 && v4.every((a) => a === SINK[0]);
  }
  const ok = runner.startsWith('no answer') && resolverOk && dnsOk;
  log(ok, 'Blocked before the launch: the runner gets no answer from the API and the name resolves only to the sink addresses',
    `the runner's own GET /api/v1/health: ${runner}; getaddrinfo: ${addrs.join(', ')}${os === 'mac' ? `; dscacheutil: ${dns}` : ''}`);
  return ok;
}

// --- The app ------------------------------------------------------------------------------------------------------
const P = process.env.RC55_ISLAND_PROFILE ?? mkdtempSync(path.join(TMP, 'unvibe-rc0155-island-'));
mkdirSync(P, { recursive: true });
// The launch-at-login question is seeded as already asked (store.ts loginPromptAsked), so no native dialog sits over
// the panel (0.1.54 Run B 44425517304).
if (!existsSync(path.join(P, 'unvibe-store.json'))) writeFileSync(path.join(P, 'unvibe-store.json'), JSON.stringify({ installId: process.env.RC55_ISLAND_ID ?? `qa-rc0155-island-local-${Date.now()}`, loginPromptAsked: true }));
const env = { ...process.env, UNVIBE_USER_DATA: P };
for (const key of Object.keys(env)) {
  if (/^(UNVIBE_ADMIN_STATS_TOKEN|UNVIBE_QA_FLAG_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_.*|MOUSE)$/.test(key)) delete env[key];
}
const netlog = path.join(netDir, `netlog-island-${os}.json`);
const requests = () => apiRequests(netlog, host);
const AI = /^\/api\/v1\/(reviews|comprehension|previews)\b/;
const panelWindow = (app) => app.windows().find((w) => w.url().includes('widget.html') && !w.isClosed());
const barWindow = (app) => app.windows().find((w) => w.url().includes('bar.html') && !w.isClosed());

/** The shortcut as a person presses it: an OS key event (System Events on a Mac, SendKeys on Windows). */
function shortcut() {
  if (os === 'mac') execFileSync('osascript', ['-e', 'tell application "System Events" to keystroke "u" using control down'], { timeout: 15000 });
  else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-Command', "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^%u')"], { timeout: 30000 });
  else execFileSync('xdotool', ['key', 'ctrl+alt+u']);
}
async function setClipboard(companion, text) {
  if (os === 'mac') execFileSync('pbcopy', { input: text });
  else if (os === 'windows') {
    const file = path.join(TMP, 'unvibe-rc0155-island-clip.txt');
    writeFileSync(file, text);
    execFileSync('powershell', ['-NoProfile', '-Command', `Get-Content -Raw -LiteralPath '${file}' | Set-Clipboard`], { timeout: 30000 });
  } else await companion.evaluate((t) => navigator.clipboard.writeText(t), text);
}
/** The editor bridge's link, as rc-0155-ai.mjs delivers it (Windows: the handler pointed at this profile, `start`ed
 * with the app's env so the second start hands the link over; run 44660771135). A local run starts the second
 * instance itself. */
function openLink() {
  const url = 'unvibe://review?source=ide';
  if (os === 'mac') { execFileSync('open', [url], { timeout: 15000 }); return; }
  if (os === 'linux') { spawn(exe, [appDir, '--use-mock-keychain', url], { env, stdio: 'ignore', detached: true }).unref(); return; }
  const key = 'HKCU\\Software\\Classes\\unvibe\\shell\\open\\command';
  execFileSync('reg', ['add', key, '/ve', '/t', 'REG_SZ', '/d', `"${exe}" --user-data-dir=${P} "%1"`, '/f']);
  if (!execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8' }).includes(`--user-data-dir=${P}`)) throw new Error('the unvibe:// handler was not registered');
  execFileSync('cmd', ['/c', 'start', '', url], { env });
}

// --- The Island's phase, logged in its page (read only) -------------------------------------------------------------
const WORKING = ['loading', 'working', 'contextualizing', 'searching', 'analyzing', 'thinking', 'generating', 'finalizing'];
async function watchIsland(bar) {
  await bar.evaluate(() => {
    if (window.__qaIsland) return;
    window.__qaIsland = [];
    const read = () => {
      const el = document.querySelector('.island');
      const phase = [...(el?.classList ?? [])].find((c) => c.startsWith('island--phase-'))?.slice('island--phase-'.length) ?? 'none';
      const word = (document.querySelector('.island__status')?.textContent ?? '').trim();
      const l = window.__qaIsland;
      const last = l[l.length - 1];
      if (!last || last.phase !== phase || last.word !== word) l.push({ phase, word, t: Date.now() });
    };
    new MutationObserver(read).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    read();
  });
}
const islandLog = (bar) => bar.evaluate(() => window.__qaIsland ?? []);
const since = (entries, t) => {
  // The state at t (the last entry before it) and every change after.
  const before = entries.filter((e) => e.t < t).at(-1);
  return [...(before ? [{ ...before, t }] : []), ...entries.filter((e) => e.t >= t)];
};
const fmt = (entries, t0) => entries.map((e) => `${e.phase}${e.word ? ` "${e.word}"` : ''} @${((e.t - t0) / 1000).toFixed(1)}s`).join(' → ') || 'none';

// --- The run ------------------------------------------------------------------------------------------------------
const CODE = 'function clampPage(page, total, size = 20) {\n  const last = Math.max(1, Math.ceil(total / size));\n  return Math.min(Math.max(1, page), last);\n}';
let app = null;
let stopped = '';
const stop = (why) => { if (!stopped) { stopped = why; note('Every later row is skipped', why); } };
try {
  block();
  if (!(await runnerBlocked())) stop('the block did not hold before the launch: nothing launched or pressed');
  if (!stopped) {
    app = await launchApp({ exe, userData: P, env, timeout: 90000, args: [...(os === 'linux' ? [appDir, '--use-mock-keychain'] : []), netLogArg(netlog)] });
    const companion = await app.windowWith('companion.html', 60000);
    if (!companion) throw new Error('the main window did not open');
    await companion.waitForLoadState('domcontentloaded');
    const info = await companion.evaluate(() => window.unvibe.appInfo());
    note('Launch', `Unvibe ${info.version}, install id ${readStore(P).installId}`);
    // Setup skipped as a person does: a name, Let's go, Skip for now twice; nothing explained.
    await companion.locator('.onboard__count').first().waitFor({ timeout: 20000 });
    await companion.getByPlaceholder('Your name').fill('Sam Test');
    await companion.getByRole('button', { name: "Let's go", exact: true }).click();
    for (const next of ['3 /', null]) {
      await companion.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 8000 });
      if (next) await companion.locator('.onboard__count').filter({ hasText: next }).waitFor({ timeout: 8000 });
    }
    await companion.locator('.onboard').waitFor({ state: 'detached', timeout: 10000 });
    await companion.evaluate(() => window.unvibe.setSettings({ theme: 'light' }));
    // Before any press: the app's own requests so far got no answer (Security MUST-D5a (b)).
    await sleep(3000);
    const seen = requests();
    const answered = seen.filter((q) => q.status);
    log(answered.length === 0, 'Blocked before any press: the app\'s requests to the API so far got no answer',
      `${seen.length} request(s) (${seen.map((q) => `${q.method} ${q.path} ${q.status || 'no answer'}`).join(', ') || 'none'}), with an answer ${answered.length}`);
    if (answered.length) stop('the app reached the API: nothing pressed');
    const bar = await waitFor(async () => barWindow(app), 20000, 250);
    if (!bar) { log(false, 'The Island\'s page', 'bar.html did not open in 20 s'); stop('no Island page'); }
    else await watchIsland(bar);

    // I1: no agreement; the shortcut; Not now.
    if (!stopped) try {
      const t0 = Date.now();
      shortcut();
      const panel = await waitFor(async () => panelWindow(app), 20000, 200);
      if (!panel) throw new Error('the shortcut opened no panel');
      await panel.locator('.ob.ob--aiConsent .consent-form').waitFor({ timeout: 30000 });
      await shot(bar, 'i1-island-over-the-agreement');
      await shot(panel, 'i1-panel-agreement');
      const tNot = Date.now();
      await panel.locator('.consent-form__actions button.ghost').click({ timeout: 5000 });
      await sleep(3000);
      const entries = since(await islandLog(bar), t0);
      const after = since(await islandLog(bar), tNot);
      const working = entries.filter((e) => WORKING.includes(e.phase) || /Reading|Checking|Writing/.test(e.word));
      const end = entries.at(-1);
      await shot(bar, 'i1-island-after-not-now');
      log(working.length === 0 && end?.phase === 'idle' && !requests().some((q) => q.method === 'POST' && AI.test(q.path)),
        'I1 no agreement: the shortcut opens the agreement, the Island never says Reading, and after Not now it is idle',
        `Island from the shortcut: ${fmt(entries, t0)}; after Not now: ${fmt(after, tNot)}; panel closed ${panelWindow(app) ? 'no' : 'yes'}; AI POSTs ${requests().filter((q) => q.method === 'POST' && AI.test(q.path)).length}`);
    } catch (e) { log(false, 'I1 no agreement: the shortcut, then Not now', short(e)); if (bar) await shot(bar, 'i1-island-stuck'); }

    // I2: the agreement, Explain, the panel closed while the request hangs.
    if (!stopped) try {
      await setClipboard(companion, CODE);
      const tLink = Date.now();
      openLink();
      // The usage call hangs at the sink before the panel opens (startReview awaits it), so this waits long.
      const panel = await waitFor(async () => panelWindow(app), 60000, 250);
      if (!panel) throw new Error('the link opened no panel');
      const consent = panel.locator('.ob.ob--aiConsent .consent-form');
      await consent.waitFor({ timeout: 60000 });
      const boxes = consent.locator('input[type="checkbox"]');
      const boxCount = await boxes.count();
      for (let i = 0; i < boxCount; i++) await boxes.nth(i).check();
      await consent.getByRole('button', { name: 'Continue', exact: true }).click();
      await panel.locator('.ob.ob--confirm').waitFor({ timeout: 60000 });
      const preview = await panel.evaluate(() => document.querySelector('.ob-preview code')?.textContent ?? '');
      if (!preview.includes('clampPage')) throw new Error('the confirm sheet does not show the clipboard\'s line');
      note('I2 the agreement given', `the link's form (${boxCount} boxes) → Continue → the confirm sheet ("${preview.split('\n')[0]}"), ${((Date.now() - tLink) / 1000).toFixed(1)} s after the link`);
      const tExplain = Date.now();
      await panel.locator('.ob.ob--confirm .ob-actions button').filter({ hasText: /^Explain$/ }).first().click();
      // Reading, then Checking once the usage call gives up; closed while the request itself hangs.
      const checking = await waitFor(async () => {
        const l = since(await islandLog(bar), tExplain);
        return l.some((e) => e.phase === 'analyzing') && WORKING.includes(l.at(-1).phase) ? l : null;
      }, 60000, 250);
      await shot(bar, 'i2-island-working');
      if (!checking) throw new Error(`the Island did not reach Checking in 60 s after Explain: ${fmt(since(await islandLog(bar), tExplain), tExplain)}`);
      await sleep(1500);
      const answeredNow = requests().filter((q) => q.status && AI.test(q.path));
      if (answeredNow.length) throw new Error('an AI request got an answer');
      const tClose = Date.now();
      await panel.locator('button.ob-head__close').click({ timeout: 5000 });
      const idle = await waitFor(async () => (since(await islandLog(bar), tClose).at(-1)?.phase === 'idle' ? Date.now() : null), 2000, 50);
      await sleep(10000);
      const afterClose = since(await islandLog(bar), tClose);
      await shot(bar, 'i2-island-10s-after-close');
      const posts = requests().filter((q) => q.method === 'POST' && AI.test(q.path));
      log(Boolean(idle) && afterClose.at(-1)?.phase === 'idle' && !afterClose.slice(1).some((e) => WORKING.includes(e.phase)) && posts.every((q) => !q.status),
        'I2 agreed: Explain → the Island says Reading, then Checking; the panel closed mid-request → idle within 2 s, and idle 10 s later',
        `Island from Explain: ${fmt(since(await islandLog(bar), tExplain), tExplain)}; after the close: ${fmt(afterClose, tClose)}${idle ? ` (idle ${idle - tClose} ms after the click)` : ''}; panel closed ${panelWindow(app) ? 'no' : 'yes'}; AI POST attempts ${posts.length}, answered ${posts.filter((q) => q.status).length}`);
    } catch (e) { log(false, 'I2 agreed: Explain, then the panel closed mid-request', short(e)); if (bar) await shot(bar, 'i2-island-stuck'); const p = panelWindow(app); if (p) await shot(p, 'i2-panel-stuck'); }
  }
} catch (e) {
  log(false, 'The Island rows', `stopped: ${short(e)}`);
} finally {
  await app?.close().catch(() => {});
  await sleep(2000);
  try { unblock(); } catch (e) { log(false, 'The hosts file back', short(e)); }
}

const all = existsSync(netlog) ? keepSummaryAndDrop(netlog, host, path.join(out, `netlog-island-${os}.txt`)) : [];
const ai = all.filter((q) => q.method === 'POST' && AI.test(q.path));
log(all.every((q) => !q.status), 'No hosted-AI call: nothing reached the server',
  `the app's net log: ${all.length} request(s) to ${host}, every one without an answer: ${all.every((q) => !q.status)}; AI POST attempts ${ai.length} (I2's Explain, held at the sink), answered ${ai.filter((q) => q.status).length}`);
writeFileSync(path.join(out, `report-island-${os}.txt`), `Unvibe 0.1.55 RC2 Island rows (${os}), no hosted AI\n\n${report.join('\n')}\n`);
process.exit(report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
