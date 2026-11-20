// Probe: does an unvibe:// link reach the running Unvibe on Windows? Run A Windows 44658289654 (rc-0155-ai.mjs on the
// 0.1.55 RC) saw no overlay within 20 s of `cmd /c start "" unvibe://review?source=ide`, before any call. The lead's
// question: the harness or the app? Run by real-device-test.yml (input rc0155=link, ai off) on Windows, on Unvibe 0.1.54
// (RC_PHASE=release, installed first, digest-pinned) and then on the RC (RC_PHASE=rc) in the same job.
//
// Each build, two ways to start the link, each on a fresh launch of the app (so no overlay exists before the link):
//   A  as Run A: the registered handler `"<exe>" --user-data-dir=<profile> "%1"`, started by `cmd /c start` from a
//      process WITHOUT UNVIBE_USER_DATA (rc-0155-ai.mjs gives that variable only to the app it launches);
//   B  as real-device.mjs (its editor-bridge row passes on Windows): the same, from a process WITH UNVIBE_USER_DATA.
// Recorded per way: whether the overlay opened in the app this script drives (the widget page appears, on its
// agreement form), the Unvibe.exe processes before and after (all, and the main ones: no --type=), the command line
// of any extra main process (a second Unvibe that did not hand the link over), and the default profile folder's
// files. Extra main processes are stopped before the next way.
//
// NO hosted-AI call: the profiles never hold the send agreement (checked: no unvibe-consent.json), nothing is pressed
// on the overlay (it opens on the agreement form and is left there), the clipboard is not set, and the app's net log
// is checked for AI paths (a PASS row). The hosts file is not touched.
//
// Env: UNVIBE_EXE, SHOTS_DIR, UNVIBE_OS (windows; linux for a local run), RC_PHASE (release | rc), RC55_LINK_PROFILE
//      + RC55_LINK_ID (a qa- id the workflow pre-flags and flags again after), NETLOG_DIR (outside SHOTS_DIR),
//      API_HOST (default api.unvibe.site), UNVIBE_APP_DIR (local run only), DEFAULT_PROFILE (the app's default
//      profile folder; the workflow seeds it with a pre-flagged qa- id in case a second Unvibe uses it).
import { launchApp, readStore } from './cdp-launch.mjs';
import { apiRequests, keepSummaryAndDrop, netLogArg } from './netlog.mjs';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
const appDir = process.env.UNVIBE_APP_DIR;
const os = process.env.UNVIBE_OS ?? (process.platform === 'win32' ? 'windows' : 'linux');
const phase = process.env.RC_PHASE;
const out = path.resolve(process.env.SHOTS_DIR ?? 'rc-0155-link');
const host = process.env.API_HOST ?? 'api.unvibe.site';
const netDir = path.resolve(process.env.NETLOG_DIR ?? mkdtempSync(path.join(tmpdir(), 'unvibe-rc0155-netlog-')));
const defaultProfile = process.env.DEFAULT_PROFILE ?? '';
if (!exe) throw new Error('Set UNVIBE_EXE');
if (phase !== 'release' && phase !== 'rc') throw new Error('RC_PHASE must be release or rc');
if (os === 'mac') throw new Error('rc-0155-link.mjs is for Windows (and a local Linux run)');
if (process.env.QA_AI_OK === '1') throw new Error('rc-0155-link.mjs makes no hosted-AI call: run it with ai off');
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
async function waitFor(fn, ms = 5000, every = 250) {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v || Date.now() - t > ms) return v;
    await sleep(every);
  }
}
function desktop(label) {
  const file = path.join(out, `link-${phase}-${String(++n).padStart(2, '0')}-desktop-${label}.png`);
  try {
    if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-Command',
      `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; $g=[System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${file}')`]);
    else execFileSync('import', ['-window', 'root', file]);
  } catch (e) { note(`desktop still ${label}`, `not taken (${short(e)})`); }
}

// --- Processes ----------------------------------------------------------------------------------------------------
/** Every Unvibe process: { pid, main (no --type=, i.e. not a renderer/GPU/utility child), args (after the exe) }. */
function processes() {
  if (os === 'windows') {
    const raw = execFileSync('powershell', ['-NoProfile', '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='Unvibe.exe'\" | ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }"], { encoding: 'utf8', timeout: 30000 });
    return raw.split(/\r?\n/).filter(Boolean).map((l) => {
      const [pid, ...rest] = l.split('\t');
      const cmd = rest.join('\t');
      return { pid: Number(pid), main: !/--type=/.test(cmd), args: cmd.replace(/^"[^"]*"\s*|^\S+\s*/, '') };
    });
  }
  // A local run: only this probe's app (its folder is on every main process's command line), never another Electron.
  const raw = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
  return raw.split('\n').map((l) => l.trim()).filter((l) => l.includes(exe) && appDir && l.includes(appDir)).map((l) => {
    const [pid, ...rest] = l.split(/\s+/);
    const cmd = rest.join(' ');
    return { pid: Number(pid), main: !/--type=/.test(cmd), args: cmd.slice(cmd.indexOf(exe) + exe.length).trim() };
  });
}
/** tasklist's own count of Unvibe.exe (Windows), as Security asked. */
function tasklistCount() {
  if (os !== 'windows') return null;
  const raw = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Unvibe.exe', '/NH'], { encoding: 'utf8' });
  return raw.split(/\r?\n/).filter((l) => /^Unvibe\.exe\s/i.test(l.trim())).length;
}
function stop(pid) {
  try {
    if (os === 'windows') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(pid, 'SIGKILL');
  } catch { /* gone */ }
}
const files = (dir) => (dir && existsSync(dir) ? readdirSync(dir).sort() : []);

// --- The profiles and the handler -----------------------------------------------------------------------------------
// One new profile per way (<RC55_LINK_PROFILE>-A, -B), so each starts the same: a first launch, setup skipped to Today.
const base = process.env.RC55_LINK_PROFILE ?? mkdtempSync(path.join(tmpdir(), 'unvibe-rc0155-link-'));
const installId = process.env.RC55_LINK_ID ?? `qa-rc0155-link-local-${Date.now()}`;
function profileFor(way) {
  const dir = `${base}-${way}`;
  mkdirSync(dir, { recursive: true });
  if (!existsSync(path.join(dir, 'unvibe-store.json'))) writeFileSync(path.join(dir, 'unvibe-store.json'), JSON.stringify({ installId, loginPromptAsked: true }));
  return dir;
}
// The app under test never gets a token this process might hold.
const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) {
  if (/^(UNVIBE_ADMIN_STATS_TOKEN|UNVIBE_QA_FLAG_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_.*|UNVIBE_USER_DATA)$/.test(key)) delete baseEnv[key];
}
const appArgs = [...(appDir ? [appDir] : []), ...(os === 'linux' ? ['--use-mock-keychain'] : [])];
const URL = 'unvibe://review?source=ide';
/** The handler rc-0155-ai.mjs and real-device.mjs both register (what setAsDefaultProtocolClient writes, pointed at the profile), byte for byte. */
function register(P) {
  if (os !== 'windows') return;
  const key = 'HKCU\\Software\\Classes\\unvibe\\shell\\open\\command';
  execFileSync('reg', ['add', key, '/ve', '/t', 'REG_SZ', '/d', `"${exe}" --user-data-dir=${P} "%1"`, '/f']);
  const value = execFileSync('reg', ['query', key, '/ve'], { encoding: 'utf8' });
  note('unvibe:// handler', value.split(/\r?\n/).find((l) => l.includes('REG_SZ'))?.trim() ?? 'not read');
}
/** The link, delivered the way a registered handler gets it, from an env with or without UNVIBE_USER_DATA. */
function deliver(P, env) {
  if (os === 'windows') execFileSync('cmd', ['/c', 'start', '', URL], { env, timeout: 30000 });
  else spawn(exe, [...appArgs, `--user-data-dir=${P}`, URL], { env, stdio: 'ignore', detached: true }).unref();
}
const profiles = [];

// --- The two ways --------------------------------------------------------------------------------------------------
const results = [];
const netlogs = [];
let version = '?';
for (const way of ['A', 'B']) {
  const label = way === 'A' ? 'A (from a process without UNVIBE_USER_DATA, as Run A)' : 'B (from a process with UNVIBE_USER_DATA, as real-device.mjs)';
  const r = { way, label };
  let app = null;
  const P = profileFor(way);
  profiles.push(P);
  try {
    register(P);
    const file = path.join(netDir, `netlog-link-${phase}-${way}.json`);
    netlogs.push(file);
    app = await launchApp({ exe, userData: P, env: { ...baseEnv, UNVIBE_USER_DATA: P }, timeout: 90000, args: [...appArgs, netLogArg(file)] });
    const companion = await app.windowWith('companion.html', 60000);
    if (!companion) throw new Error('the main window did not open');
    await companion.waitForLoadState('domcontentloaded');
    version = (await companion.evaluate(() => window.unvibe.appInfo())).version;
    // Setup on the new profile (first launch only): a name, both steps skipped (nothing is explained), then Today.
    await companion.locator('.onboard__count, .topbar__title').first().waitFor({ timeout: 20000 });
    if (await companion.locator('.onboard__count').count()) {
      await companion.getByPlaceholder('Your name').fill('Sam Link');
      await companion.getByRole('button', { name: "Let's go", exact: true }).click();
      for (const next of ['3 /', null]) {
        await companion.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 8000 });
        if (next) await companion.locator('.onboard__count').filter({ hasText: next }).waitFor({ timeout: 8000 });
      }
      await companion.locator('.onboard').waitFor({ state: 'detached', timeout: 10000 });
    }
    await companion.locator('.topbar__title').waitFor({ timeout: 10000 });
    await sleep(1500);
    const widget = () => app.windows().find((w) => w.url().includes('widget.html') && !w.isClosed());
    r.widgetBefore = Boolean(widget());
    const before = processes();
    r.before = { all: before.length, main: before.filter((p) => p.main).length, tasklist: tasklistCount() };
    r.defaultBefore = files(defaultProfile);
    const own = new Set(before.filter((p) => p.main).map((p) => p.pid));
    const env = way === 'A' ? baseEnv : { ...baseEnv, UNVIBE_USER_DATA: P };
    r.sent = Date.now();
    deliver(P, env);
    const panel = await waitFor(async () => widget(), 20000);
    r.opened = Boolean(panel);
    if (panel) {
      r.openedMs = Date.now() - r.sent;
      await panel.locator('.ob').first().waitFor({ timeout: 10000 }).catch(() => {});
      r.view = await panel.evaluate(() => [...(document.querySelector('.ob')?.classList ?? [])].filter((c) => c.startsWith('ob--')).join(' ')).catch(() => '?');
    }
    await sleep(5000); // a second Unvibe that did not hand over would be up by now
    desktop(`way-${way}`);
    const after = processes();
    r.after = { all: after.length, main: after.filter((p) => p.main).length, tasklist: tasklistCount() };
    r.extra = after.filter((p) => p.main && !own.has(p.pid));
    r.defaultAfter = files(defaultProfile);
    for (const p of r.extra) stop(p.pid);
    if (r.extra.length) await sleep(2000);
  } catch (e) {
    r.error = short(e);
  } finally {
    await app?.close().catch(() => {});
    // Anything left (the app's own children, or a second Unvibe) is stopped before the next way.
    for (const p of processes().filter((x) => x.main)) stop(p.pid);
    await sleep(2000);
  }
  results.push(r);
  const extra = r.extra?.length ? r.extra.map((p) => `pid ${p.pid} args ${JSON.stringify(p.args)}`).join('; ') : 'none';
  const defaults = `default profile ${defaultProfile ? `files ${r.defaultBefore?.length ?? '?'} → ${r.defaultAfter?.length ?? '?'}${r.defaultAfter && r.defaultBefore && r.defaultAfter.length !== r.defaultBefore.length ? ` (${r.defaultAfter.filter((f) => !r.defaultBefore.includes(f)).join(', ')} added)` : ''}` : 'not given'}`;
  note(`Link ${label} on ${version} (${phase})`, r.error
    ? `not run to the end: ${r.error}`
    : `overlay opened in the running app ${r.opened}${r.opened ? ` after ${r.openedMs} ms, view "${r.view}"` : ' (none within 20 s)'}; widget page before the link ${r.widgetBefore}; Unvibe.exe all ${r.before.all} → ${r.after.all}, main ${r.before.main} → ${r.after.main}${r.before.tasklist !== null ? `, tasklist ${r.before.tasklist} → ${r.after.tasklist}` : ''}; extra main processes ${extra}; ${defaults}`);
}

// --- No hosted-AI path -------------------------------------------------------------------------------------------
const requests = netlogs.flatMap((file, i) => keepSummaryAndDrop(file, host, path.join(out, `netlog-link-${phase}-${os}-${'AB'[i]}.txt`)));
const ai = requests.filter((q) => q.method === 'POST' && /^\/api\/v1\/(reviews|comprehension|previews)\b/.test(q.path));
const consent = [...profiles, defaultProfile].filter(Boolean).filter((d) => existsSync(path.join(d, 'unvibe-consent.json')));
log(ai.length === 0 && consent.length === 0, 'No hosted-AI path: nothing explained, asked or quizzed',
  `the app's net logs: ${requests.length} request(s) to ${host}, ${ai.length} to /reviews, /comprehension or /previews; send agreement (unvibe-consent.json) in the probe profiles or the default profile: ${consent.length ? consent.join(', ') : 'none'}; nothing was pressed on the overlay and the clipboard was not set`);
note('Readout', results.map((r) => `${r.way}: ${r.error ? 'not run' : r.opened ? 'reached' : 'not reached'}${r.extra?.length ? `, ${r.extra.length} extra Unvibe` : ''}`).join('; '));
writeFileSync(path.join(out, `report-link-${phase}.txt`), `Unvibe ${version}: unvibe:// link probe (${phase}, ${os})\n\n${report.join('\n')}\n`);
process.exit(report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
