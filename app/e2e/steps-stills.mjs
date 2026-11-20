// The site's three Steps stills (unvibe-site, Design's requests/unvibe-site/20261119-1656-design-s1-option-a-r2.md
// SHOULD 2 and its answers; BOSS: 2 hosted calls on 0.1.54, captions "Real screen, sample code · Unvibe 0.1.54"):
//   1. the sample code selected with the mouse in VS Code (Light+, window.zoomLevel 3.8, about 200 %), captured at 1x
//      and cropped to the editor and its tab, so the site can show it at half size (Design's option C);
//   2. the overlay at Beginner with the real explanation of that selection (CALL 1, the global shortcut, as a person
//      does it), captured at 2x through CDP;
//   3. the overlay's Test me with its real question (CALL 2), captured at 2x, nothing answered.
// Run by real-device-test.yml with rc0154=steps (Mac only, ai on, a published version). Nothing is edited after
// capture; the stills keep the panel's or the editor's own bounds.
//
// Hosted calls, counted: spend() refuses a 3rd, and the first failed call step stops the other. The agreement form
// (before the first explanation) sends nothing.
//
// Env: UNVIBE_EXE, SHOTS_DIR, QA_AI_OK=1, RC_STEPS_PROFILE + RC_STEPS_ID (a qa- id the workflow pre-flags and flags
//      again after), MOUSE (mouse.swift), VSCODE_CLI (VS Code's `code`), VSCODE_DATA (a fresh VS Code profile folder).
import { launchApp, readStore } from './cdp-launch.mjs';
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
const out = path.resolve(process.env.SHOTS_DIR ?? 'steps-stills');
const dir = process.env.RC_STEPS_PROFILE;
const installId = process.env.RC_STEPS_ID;
const code = process.env.VSCODE_CLI;
const codeData = process.env.VSCODE_DATA;
const TMP = process.env.RUNNER_TEMP ?? tmpdir();
if (!exe || !dir || !installId || !code || !codeData || !process.env.MOUSE) throw new Error('Set UNVIBE_EXE, RC_STEPS_PROFILE, RC_STEPS_ID, VSCODE_CLI, VSCODE_DATA and MOUSE');
if (process.platform !== 'darwin') throw new Error('steps-stills.mjs runs on a Mac only (the stills are Mac stills)');
if (process.env.QA_AI_OK !== '1') throw new Error('steps-stills.mjs sends 2 hosted calls: it needs QA_AI_OK=1 (workflow input ai=true)');
mkdirSync(out, { recursive: true });

const report = [];
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
const BUDGET = 2;
let spent = 0;
let stopped = '';
function spend(what) {
  if (stopped) throw new Error(`not sent: an earlier call step failed (${stopped})`);
  if (spent + 1 > BUDGET) throw new Error(`not sent: ${what} would be call ${spent + 1} of ${BUDGET}`);
  spent += 1;
  line(`CALL  ${spent}/${BUDGET}: ${what}`);
}
const stop = (why) => { if (!stopped) { stopped = why; note('Every later call step is skipped', why); } };
const osa = (script) => execFileSync('osascript', ['-e', script], { encoding: 'utf8', timeout: 20000 }).trim();
const pngSize = (file) => { const b = execFileSync('head', ['-c', '24', file]); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

// The app's own setup sample (renderer/companion SAMPLE_LINES), as a file in the editor.
const SAMPLE = 'function debounce(fn, wait) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}\n';
const sampleDir = path.join(TMP, 'steps-sample');
mkdirSync(sampleDir, { recursive: true });
const sampleFile = path.join(sampleDir, 'debounce.js');
writeFileSync(sampleFile, SAMPLE);

// --- Unvibe: the released app on a new qa- profile, setup skipped, light, sharks off, Beginner ---------------------
mkdirSync(dir, { recursive: true });
if (!existsSync(path.join(dir, 'unvibe-store.json'))) writeFileSync(path.join(dir, 'unvibe-store.json'), JSON.stringify({ installId, loginPromptAsked: true }));
const env = { ...process.env, UNVIBE_USER_DATA: dir };
for (const key of Object.keys(env)) {
  if (/^(UNVIBE_ADMIN_STATS_TOKEN|UNVIBE_QA_FLAG_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_.*)$/.test(key)) delete env[key];
}
const app = await launchApp({ exe, userData: dir, env, timeout: 90000 });
const companion = await app.windowWith('companion.html', 60000);
if (!companion) throw new Error('the main window did not open');
await companion.waitForLoadState('domcontentloaded');
const version = (await companion.evaluate(() => window.unvibe.appInfo())).version;
line(`NOTE  Unvibe ${version}, install id ${readStore(dir).installId}`);
if (version !== '0.1.54') { log(false, 'The Steps stills are of Unvibe 0.1.54', `this build is ${version}; nothing was sent`); stop('not 0.1.54'); }
if (!stopped) try {
  await companion.locator('.onboard__count').first().waitFor({ timeout: 20000 });
  await companion.getByPlaceholder('Your name').fill('Sam');
  await companion.getByRole('button', { name: "Let's go", exact: true }).click();
  for (const next of ['3 /', null]) {
    await companion.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 8000 });
    if (next) await companion.locator('.onboard__count').filter({ hasText: next }).waitFor({ timeout: 8000 });
  }
  await companion.locator('.onboard').waitFor({ state: 'detached', timeout: 10000 });
  await companion.evaluate(() => window.unvibe.setSettings({ theme: 'light', startAnimation: false, defaultExplanationLevel: 'beginner' }));
  await sleep(800);
} catch (e) { log(false, 'Setup skipped, light, sharks off, Beginner', short(e)); stop('setup failed'); }

// --- Still 1: the selection in VS Code ----------------------------------------------------------------------------
// A fresh VS Code profile (Design: Light+, window.zoomLevel 3.8; no welcome page, no trust prompt, no extensions),
// opened on the sample file with Chromium's debug port, which only measures where the lines are: the selection is made
// with the real pointer (mouse.swift), and the still is the screen itself (screencapture -R, 1x).
const settingsFile = path.join(codeData, 'User', 'settings.json');
mkdirSync(path.dirname(settingsFile), { recursive: true });
writeFileSync(settingsFile, JSON.stringify({
  'window.zoomLevel': 3.8,
  'workbench.colorTheme': 'Default Light+',
  'workbench.startupEditor': 'none',
  'workbench.tips.enabled': false,
  'workbench.enableExperiments': false,
  'security.workspace.trust.enabled': false,
  'telemetry.telemetryLevel': 'off',
  'update.mode': 'none',
  'extensions.ignoreRecommendations': true,
  'chat.commandCenter.enabled': false,
  'chat.disableAIFeatures': true,
  'workbench.secondarySideBar.defaultVisibility': 'hidden',
  'workbench.welcomePage.walkthroughs.openOnInstall': false,
  'editor.minimap.enabled': false,
  // No path above the code: the breadcrumbs would show the runner's folders in still 1 (Security SHOULD-ST1).
  'breadcrumbs.enabled': false,
  'window.restoreWindows': 'none',
}, null, 2));
let editor = null;
let selectionOk = false; // the calls go only on a real selection, so a failed still 1 sends nothing
let browser = null;
const PORT = 9339;
try {
  spawn(code, ['--user-data-dir', codeData, '--extensions-dir', path.join(codeData, 'extensions'), '--disable-extensions', '--new-window', `--remote-debugging-port=${PORT}`, sampleFile], { stdio: 'ignore', detached: true }).unref();
  browser = await waitFor(() => chromium.connectOverCDP(`http://127.0.0.1:${PORT}`).catch(() => null), 60000, 1000);
  if (!browser) throw new Error('VS Code did not open its debug port');
  editor = await waitFor(() => browser.contexts().flatMap((c) => c.pages()).find((p) => /workbench/.test(p.url())), 30000, 500);
  if (!editor) throw new Error('no VS Code window');
  await editor.locator('.monaco-editor .view-line').first().waitFor({ timeout: 30000 });
  await sleep(1500);
  osa('tell application "Visual Studio Code" to activate');
  await sleep(800);
  // The side bar is shown on a first start: hidden as a person does it (⌘B), so the editor has the width; the same
  // for a secondary side bar (⌥⌘B) if this VS Code opens one.
  if (await editor.locator('.part.sidebar:visible').count()) { osa('tell application "System Events" to keystroke "b" using command down'); await sleep(800); }
  if (await editor.locator('.part.auxiliarybar:visible').count()) { osa('tell application "System Events" to keystroke "b" using {command down, option down}'); await sleep(800); }
  const hidden = await editor.evaluate(() => ({ side: Boolean(document.querySelector('.part.sidebar')?.offsetWidth), aux: Boolean(document.querySelector('.part.auxiliarybar')?.offsetWidth), toasts: document.querySelectorAll('.notification-toast').length }));
  if (hidden.toasts) note('VS Code notifications on screen', `${hidden.toasts} (they may show in still 1)`);
  const geo = await editor.evaluate(() => {
    const lines = [...document.querySelectorAll('.monaco-editor .view-lines .view-line')].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const text = (el) => { const spans = [...el.querySelectorAll('span > span')]; const a = spans[0]?.getBoundingClientRect(); const z = spans.at(-1)?.getBoundingClientRect(); return a && z ? { left: a.left, right: z.right } : null; };
    return {
      dpr: devicePixelRatio, iw: innerWidth, ih: innerHeight,
      part: box(document.querySelector('.part.editor')),
      theme: document.querySelector('.monaco-workbench')?.classList.contains('vs') ? 'light' : document.querySelector('.monaco-workbench')?.className,
      lines: lines.map((l) => ({ ...box(l), text: text(l), content: l.textContent })),
      font: getComputedStyle(document.querySelector('.monaco-editor .view-line')).fontSize,
    };
  });
  const rows = geo.lines.filter((l) => l.content.trim());
  if (rows.length < 7) throw new Error(`the editor shows ${rows.length} code lines, not the sample's 7`);
  // Screen points = the window's frame (CGWindowList, via mouse.swift) + CSS px × the zoom (window width ÷ CSS width;
  // VS Code's Mac window has no system title bar, so its content fills the frame).
  const frameOf = (owner) => { try { return execFileSync(process.env.MOUSE, ['frame', owner], { encoding: 'utf8' }).trim(); } catch { return ''; } };
  const owner = ['Code', 'Visual Studio Code', 'Electron'].find((o) => frameOf(o));
  if (!owner) throw new Error('no on-screen VS Code window (owner Code, Visual Studio Code or Electron)');
  const [fx, fy, fw, fh] = frameOf(owner).split(/\s+/).map(Number);
  const k = fw / geo.iw;
  if (Math.abs(fh / geo.ih - k) > 0.05) throw new Error(`the window ${fw}x${fh} does not match the page ${geo.iw}x${geo.ih} at one zoom`);
  const P = (x, y) => [Math.round(fx + x * k), Math.round(fy + y * k)];
  const [x1, y1] = P(rows[0].text.left - 1, rows[0].y + rows[0].h / 2);
  const [x2, y2] = P(rows[6].text.right + 2, rows[6].y + rows[6].h / 2);
  execFileSync(process.env.MOUSE, ['drag', String(x1), String(y1), String(x2), String(y2)]);
  await sleep(600);
  const selected = await editor.evaluate(() => document.querySelectorAll('.monaco-editor .selected-text').length);
  selectionOk = selected > 0;
  // The pointer leaves the editor (below the window), so the still shows no cursor hover.
  execFileSync(process.env.MOUSE, ['move', String(x2), String(Math.round(fy + fh + 40))]);
  await sleep(500);
  const [cx, cy] = P(geo.part.x, geo.part.y);
  const cw = Math.round(geo.part.w * k);
  const ch = Math.round(geo.part.h * k);
  const file = path.join(out, '1-selection-vscode-1x.png');
  execFileSync('screencapture', ['-x', `-R${cx},${cy},${cw},${ch}`, file]);
  const size = pngSize(file);
  log(selected > 0 && geo.theme === 'light' && Math.abs(k - 2) < 0.1, 'Still 1: the sample selected with the mouse in VS Code (Light+, zoom 3.8), editor and tab, 1x',
    `${size.w}x${size.h} px; zoom ${k.toFixed(2)} (devicePixelRatio ${geo.dpr}); editor font ${geo.font} CSS; selection boxes ${selected}; side bar shown ${hidden.side}, secondary ${hidden.aux}; window (${owner}) ${fx},${fy} ${fw}x${fh}; drag ${x1},${y1} → ${x2},${y2}`);
} catch (e) { log(false, 'Still 1: the selection in VS Code', short(e)); }

// --- Calls: the shortcut on that selection, then Test me --------------------------------------------------------------
const panelWindow = () => app.windows().find((w) => w.url().includes('widget.html') && !w.isClosed());
async function capture2x(page, file) {
  const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: size.w, height: size.h, deviceScaleFactor: 2, mobile: false });
    await sleep(600);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(data, 'base64'));
  } finally {
    await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await cdp.detach().catch(() => {});
  }
  const got = pngSize(file);
  return { size, got, sized: got.w === size.w * 2 && got.h === size.h * 2 };
}
const shortcutInEditor = async () => {
  osa('tell application "Visual Studio Code" to activate');
  await sleep(800);
  osa('tell application "System Events" to keystroke "u" using control down');
};
let panel = null;
if (!stopped) try {
  if (!editor || !selectionOk) throw new Error('no selection in VS Code (still 1 failed); nothing sent');
  await shortcutInEditor();
  panel = await waitFor(async () => panelWindow(), 20000, 250);
  if (!panel) throw new Error('the overlay did not open');
  const consent = panel.locator('.ob.ob--aiConsent .consent-form');
  await consent.waitFor({ timeout: 20000 });
  const boxes = consent.locator('input[type="checkbox"]');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
  await consent.getByRole('button', { name: 'Continue', exact: true }).click();
  await panel.locator('.ob.ob--empty').waitFor({ timeout: 20000 });
  note('The agreement form', 'shown on the first press, every box ticked, Continue; nothing sent');
  spend('the explanation of the selection at Beginner (Control+U in VS Code)');
  await shortcutInEditor();
  await panel.locator('.ob.ob--done').waitFor({ timeout: 120000 });
  await panel.locator('.ob-answer .cursor').waitFor({ state: 'detached', timeout: 60000 });
  await sleep(1200);
  const s = await panel.evaluate(() => ({
    level: document.querySelector('.ob-depth [role="radio"][aria-checked="true"]')?.getAttribute('data-level') ?? null,
    head: document.querySelector('.ob-head')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80),
    answer: document.querySelector('.ob-answer')?.textContent?.length ?? 0,
    font: getComputedStyle(document.querySelector('.ob-answer') ?? document.body).fontSize,
    theme: document.documentElement.dataset.theme ?? 'light (unset)',
  }));
  const shot = await capture2x(panel, path.join(out, '2-overlay-beginner-2x.png'));
  log(s.answer > 80 && shot.sized && s.theme !== 'dark' && s.level === 'beginner', 'Still 2: the overlay at Beginner with the real explanation, 2x',
    `${shot.got.w}x${shot.got.h} px for ${shot.size.w}x${shot.size.h} CSS; answer ${s.answer} characters at ${s.font}; depth shown ${s.level}; head "${s.head}"; theme ${s.theme}`);
} catch (e) { log(false, 'Still 2: the overlay at Beginner', short(e)); stop('the explanation failed'); }

if (!stopped) try {
  const tab = panel.locator('#ob-tab-test[role="tab"]');
  await tab.waitFor({ timeout: 10000 });
  spend('the Test me question on that explanation');
  await tab.click();
  await panel.locator('.ob-quiz .ob-quiz__q').waitFor({ timeout: 90000 });
  await waitFor(async () => (await panel.locator('.ob-quiz__opts .ob-opt').count()) >= 2, 30000, 500);
  await sleep(1200);
  const q = await panel.evaluate(() => ({
    options: document.querySelectorAll('.ob-quiz__opts .ob-opt').length,
    picked: document.querySelectorAll('.ob-quiz__opts .ob-opt.is-picked').length,
    text: (document.querySelector('.ob-quiz__q')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
  }));
  const shot = await capture2x(panel, path.join(out, '3-test-me-2x.png'));
  log(q.options >= 2 && q.picked === 0 && shot.sized, 'Still 3: Test me with its real question, nothing answered, 2x',
    `${shot.got.w}x${shot.got.h} px for ${shot.size.w}x${shot.size.h} CSS; ${q.options} options, ${q.picked} picked; "${q.text}…"`);
} catch (e) { log(false, 'Still 3: Test me', short(e)); stop('Test me failed'); }

line(`NOTE  hosted calls sent by this run: ${spent} of ${BUDGET}${stopped ? ` (stopped: ${stopped})` : ''}; the lead's meter should move by the same number`);
line('NOTE  captions (BOSS): each still "Real screen, sample code · Unvibe 0.1.54"; the stills are not edited');
await browser?.close().catch(() => {});
try { execFileSync('pkill', ['-x', 'Code'], { stdio: 'ignore' }); } catch { /* gone */ }
try { execFileSync('pkill', ['-f', 'Visual Studio Code.app'], { stdio: 'ignore' }); } catch { /* gone */ }
await app.close();
writeFileSync(path.join(out, 'report-steps.txt'), `Unvibe ${version}: the site's Steps stills (Mac)\n\n${report.join('\n')}\n`);
process.exit(report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
