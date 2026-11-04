// The 0.1.50 motion checks (boss-handoff agents/unvibe/v0.1.50-qa-plan.md, M1-M7) on the INSTALLED app, driven
// over Chromium's debug port (cdp-launch.mjs: renderer pages only, no main-process access). CI only: it activates
// apps, writes the clipboard and opens unvibe:// links, so it never runs on a Mac someone is using.
//
//   MOTION_PASS=mock  M3 errors, M4 reduced motion, M7 keyboard, M5 loops focused/blurred and M6 CPU/GPU before
//                     and after. Every explanation comes from motion-mock.mjs (MOTION_BACKEND, a name that resolves
//                     to the runner; the workflow blocks api.unvibe.site meanwhile), so no production call is made.
//                     BASELINE_EXE is the release M6 compares against. STATE_S seconds per loop state (default 30).
//   MOTION_PASS=real  M1 waiting -> first sentence -> done, and M2 code spans and bold, on 3 real explanations:
//                     the first-run sample, a long selection and one meant to come back "Not sure:", on one fresh
//                     profile (MOTION_PROFILE) with MOTION_INSTALL_ID (qa-...), which the workflow flags as QA.
//
//   UNVIBE_EXE=<app binary> OUT=<dir> MOTION_PASS=mock|real ... node motion-qa.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { launchApp } from './cdp-launch.mjs';

const PASS = process.env.MOTION_PASS;
if (!['mock', 'real'].includes(PASS)) throw new Error('MOTION_PASS must be mock or real');
const EXE = process.env.UNVIBE_EXE;
const OUT = process.env.OUT;
if (!EXE || !OUT) throw new Error('UNVIBE_EXE and OUT are required');
mkdirSync(OUT, { recursive: true });
const STATE_S = Number(process.env.STATE_S ?? 30);
// The mock's control routes live on the same origin the app uses (NODE_EXTRA_CA_CERTS trusts its CI cert).
const MOCK = process.env.MOTION_BACKEND ?? 'http://127.0.0.1:8787';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bundleOf = (exe) => exe.replace(/\/Contents\/MacOS\/[^/]+$/, '');

const report = [];
let failed = 0;
const say = (line) => { report.push(line); console.log(line); };
const check = (ok, name, detail = '') => { if (!ok) failed++; say(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`); };
const note = (text) => say(`NOTE  ${text}`);
const shot = (page, name) => page?.screenshot({ path: path.join(OUT, `${name}.png`) }).catch(() => {});

// ---- the app ------------------------------------------------------------------------------------------------
const baseEnv = { ...process.env };
delete baseEnv.UNVIBE_BACKEND; delete baseEnv.UNVIBE_CI_MOCK;
async function launch(exe, name, installId, env = {}) {
  const userData = name.startsWith('/') ? name : path.join(process.env.MOTION_PROFILES ?? path.join(OUT, 'profiles'), name);
  rmSync(userData, { recursive: true, force: true }); mkdirSync(userData, { recursive: true });
  // Launch at login already answered: a native sheet would only get in the way.
  writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId, loginPromptAsked: true }));
  const app = await launchApp({ exe, userData, env: { ...baseEnv, ...env }, timeout: 90000 });
  const companion = await app.windowWith('companion.html', 60000);
  if (!companion) { await app.close(); throw new Error('the companion window did not open'); }
  const { version } = await companion.evaluate(() => window.unvibe.appInfo());
  return { app, companion, version, bundle: bundleOf(exe), userData };
}
// UNVIBE_CI_MOCK=1: release builds from 0.1.50 accept https://unvibe-mock.test only with it (backendUrl.ts).
const mockEnv = () => ({ UNVIBE_BACKEND: process.env.MOTION_BACKEND, UNVIBE_CI_MOCK: '1' });
async function setMode(mode) {
  for (let i = 0; ; i++) {
    try { const r = await fetch(`${MOCK}/__qa/mode`, { method: 'POST', body: JSON.stringify({ mode }) }); if (r.ok) return; throw new Error(`mode ${mode}: ${r.status}`); } catch (e) { if (i === 2) throw e; await sleep(300); }
  }
}
const mockStats = () => fetch(`${MOCK}/__qa/stats`).then((r) => r.json());

/** Onboarding step 1 -> the first-run sample in the panel (the same labels on 0.1.47 and 0.1.50). */
async function firstRunSample(s) {
  await s.companion.locator('.ob2__count').first().waitFor({ timeout: 30000 });
  await s.companion.getByPlaceholder('Your name').fill('Sam');
  await s.companion.getByRole('button', { name: "Let's go", exact: true }).first().click();
  await s.companion.getByRole('button', { name: 'Explain this code', exact: true }).first().click();
  const panel = await s.app.windowWith('widget.html', 30000);
  if (!panel) throw new Error('the panel did not open for the sample');
  return panel;
}
/** Done = the card says done and no typing cursor is left (full answers type in with one). */
async function finished(panel, timeout = 90000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    const st = await panel.evaluate(() => ({ done: !!document.querySelector('.card--done'), cursor: !!document.querySelector('.body .cursor'), error: document.querySelector('.state[role="alert"]')?.innerText ?? null })).catch(() => ({}));
    if (st.error) throw new Error(`the explanation failed: ${st.error.replace(/\s+/g, ' ').slice(0, 160)}`);
    if (st.done && !st.cursor) return;
    await sleep(200);
  }
  throw new Error(`the explanation did not finish in ${timeout / 1000} s`);
}
/** Onboarding after the sample: Next, then "Skip for now" on the paste step, lands on home (Mac). */
async function finishSetup(s) {
  await s.companion.getByRole('button', { name: 'Next', exact: true }).click({ timeout: 10000 });
  await s.companion.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 10000 });
  await accountMenu(s).waitFor({ timeout: 20000 });
}
// `.acct-trigger` on 0.1.50; `[aria-haspopup="menu"]` also matches the chat's AI menu, so only as a fallback.
const accountMenu = (s) => s.companion.locator('.acct-trigger').or(s.companion.locator('[aria-haspopup="menu"]').first()).first();

// The runner's own windows: activate the app, or hand focus to Finder. Each sample records document.hasFocus()
// so a state that did not take is visible instead of silently measured.
const focusApp = async (s) => { execFileSync('open', ['-a', s.bundle]); await sleep(1500); };
const blurApp = async () => { execFileSync('open', ['-a', 'Finder']); await sleep(1500); };
/**
 * Playwright (1.48 here) turns on CDP focus emulation for every page it attaches to, so document.hasFocus() is
 * always true and the app never sees a blur (run 41786725662: every "blurred" state read focused=true). For the
 * loop states, switch it off on every window, including ones opened later, so focus follows the real OS focus.
 * Each CDP session keeps its own on/off state and ignores a call that matches it, so a fresh session's plain
 * `false` is a no-op (run 41789594818). Turning it on and then off from our session makes the page-level flag,
 * which the last change sets, end up off.
 */
function realFocus(s) {
  s.app.onWindow((page) => {
    void s.app.context.newCDPSession(page)
      .then(async (cdp) => {
        await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
        await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
      })
      .catch((e) => console.log(`focus emulation not switched off on ${page.url()}: ${String(e).slice(0, 100)}`));
  });
}

// ---- measuring ----------------------------------------------------------------------------------------------
function kind(cmd) {
  const type = cmd.match(/--type=([\w-]+)/)?.[1];
  if (!type) return 'main';
  if (type === 'renderer') return `renderer:${cmd.match(/--renderer-client-id=(\d+)/)?.[1] ?? '?'}`;
  if (type === 'gpu-process') return 'gpu';
  if (type === 'utility') return `utility:${cmd.match(/--utility-sub-type=([\w.]+)/)?.[1] ?? '?'}`;
  return type;
}
/** Every process of this app bundle: kind, mean %CPU of 5 reads 1 s apart, phys_footprint MB. */
async function processes(bundle) {
  const rows = () => execFileSync('ps', ['-axww', '-o', 'pid=,%cpu=,command=']).toString().split('\n')
    .map((l) => l.trim().match(/^(\d+)\s+([\d.]+)\s+(.*)$/)).filter((m) => m && m[3].startsWith(`${bundle}/`));
  const acc = {};
  for (let i = 0; i < 5; i++) {
    for (const m of rows()) (acc[m[1]] ??= { kind: kind(m[3]), cpu: [] }).cpu.push(Number(m[2]));
    if (i < 4) await sleep(1000);
  }
  const out = Object.entries(acc).map(([pid, p]) => ({ pid, kind: p.kind, cpu: Math.round((p.cpu.reduce((a, b) => a + b, 0) / p.cpu.length) * 10) / 10 }));
  try {
    const text = execFileSync('footprint', ['-f', 'bytes', ...out.flatMap((p) => ['-p', p.pid])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    for (const m of text.matchAll(/\[(\d+)\]:.*?Footprint: (\d+) B/g)) { const p = out.find((x) => x.pid === m[1]); if (p) p.footprintMb = Math.round(Number(m[2]) / 1048576); }
  } catch { /* footprint unavailable: CPU only */ }
  return out;
}
/** Per window: focus, reduced motion, and every repeating animation (infinite, or 2+ iterations) with its state. */
async function loops(app) {
  const out = {};
  for (const p of app.windows()) {
    const name = p.url().split('/').pop().split('?')[0];
    out[name] = await p.evaluate(() => ({
      focused: document.hasFocus(),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      running: document.getAnimations().filter((a) => a.playState === 'running').length,
      loops: document.getAnimations()
        .filter((a) => { const n = a.effect?.getComputedTiming().iterations; return n === Infinity || n >= 2; })
        .map((a) => {
          const t = a.effect.target; const el = t?.nodeType === 1 ? t : null; const c = a.effect.getComputedTiming();
          return { name: a.animationName ?? 'anim', target: `${el ? `.${String(el.className?.baseVal ?? el.className).trim().split(/\s+/).slice(0, 2).join('.')}` : ''}${a.effect.pseudoElement ?? ''}`, state: a.playState, iteration: c.currentIteration, iterations: c.iterations, away: !!el?.closest('.buddy--away') };
        }),
    })).catch((e) => ({ error: String(e).slice(0, 120), loops: [] }));
  }
  return out;
}
async function sample(s, label) {
  const anim = await loops(s.app);
  const procs = await processes(s.bundle);
  const row = { label, version: s.version, at: new Date().toISOString(), windows: anim, processes: procs };
  const running = Object.entries(anim).map(([w, a]) => `${w}[${a.focused ? 'focused' : 'unfocused'}${a.reducedMotion ? ',reduced' : ''}] ${a.error ?? (a.loops.filter((l) => l.state === 'running').map((l) => `${l.name}${l.target} ${l.iteration}/${l.iterations}`).join(' | ') || 'no loop running')}`).join('; ');
  console.log(`${s.version} ${label}: ${procs.map((p) => `${p.kind} ${p.cpu}% ${p.footprintMb ?? '?'}MB`).join(', ')}\n    ${running}`);
  return row;
}
const gpuOf = (row) => row.processes.find((p) => p.kind === 'gpu');
const renderersOf = (row) => row.processes.filter((p) => p.kind.startsWith('renderer'));
const runningLoops = (row, test = () => true) => Object.entries(row.windows).flatMap(([w, a]) => (a.loops ?? []).filter((l) => l.state === 'running' && test(l, w)).map((l) => `${w}:${l.name}${l.target}`));

// ---- MOTION_PASS=mock ---------------------------------------------------------------------------------------
async function m3() {
  const cases = [
    ['500', /temporarily unavailable/i, '.state[role="alert"]'],
    ['drop', /could not reach its explanation service|appear to be offline/i, '.state[role="alert"]'],
    // 0.1.50 turns a used-up trial into the "Session paused" view (.state--limit); older builds show the server's
    // message as an error. Either replaces the skeleton.
    ['429', /paused|limit|used all of your free explanations/i, '.state[role="alert"], .state--limit'],
  ];
  for (const [mode, message, selector] of cases) {
    let s;
    try {
      await setMode(mode);
      s = await launch(EXE, `m3-${mode}`, `qa-motion-mock-m3-${mode}-${Date.now()}`, mockEnv());
      const panel = await firstRunSample(s);
      const names = new Set(); let shownAt = 0; let st = {};
      for (const t = Date.now(); Date.now() - t < 30000;) {
        st = await panel.evaluate((sel) => ({ error: !!document.querySelector(sel), skeleton: !!document.querySelector('.answer-wait'), text: document.querySelector('.card .state')?.innerText ?? '', names: document.getAnimations().map((a) => a.animationName ?? '?') }), selector).catch(() => st);
        (st.names ?? []).forEach((n) => names.add(n));
        if (st.error && !shownAt) shownAt = Date.now();
        if (shownAt && Date.now() - shownAt > 1500) break;
        await sleep(50);
      }
      await shot(panel, `m3-${mode}`);
      const text = (st.text ?? '').replace(/\s+/g, ' ').trim();
      check(st.error && !st.skeleton, `M3 ${mode}: the error takes the skeleton's place`, `error shown ${!!st.error}, skeleton left ${!!st.skeleton}`);
      check(message.test(text), `M3 ${mode}: the message says what happened`, text.slice(0, 140));
      check(![...names].some((n) => /shake/i.test(n)), `M3 ${mode}: no shake`, `animations seen: ${[...names].join(', ') || 'none'}`);
    } catch (e) { check(false, `M3 ${mode}`, e.message.split('\n')[0]); } finally { await s?.app.close(); }
  }
  await setMode('stream');
}
/**
 * REG-83 (0.1.49+): a selected-code explanation that fails gives its credit back; one that explains keeps it.
 * Trial builds count these on the computer (main.ts takeSelectionCredit); a link-started capture is counted when
 * Explain is pressed. Read through the app's own usage:get (window.unvibe.usageGet → data.selections.used). A build
 * that doesn't count moves neither way, which is a note, not a fail.
 */
async function m3credit() {
  let s;
  const usage = () => s.companion.evaluate(async () => (typeof window.unvibe.usageGet === 'function' ? { has: true, r: await window.unvibe.usageGet() } : { has: false }));
  const used = async () => {
    const u = await usage();
    if (!u.has) return null;
    if (!u.r?.ok) throw new Error(`usage:get failed: ${u.r?.error ?? 'no answer'}`);
    return u.r.data?.selections?.used ?? null;
  };
  try {
    await setMode('stream');
    s = await launch(EXE, 'm3-credit', `qa-motion-mock-m3credit-${Date.now()}`, mockEnv());
    await finished(await firstRunSample(s));
    await focusApp(s);
    await finishSetup(s);
    const before = await used();
    if (before === null) { note('M3 REG-83: this build has no selected-code counter (pre-0.1.49)'); return; }
    await setMode('500');
    const fail = await ownCode(s, LONG, true);
    await shot(fail.panel, 'm3-credit-500');
    await setMode('stream');
    const afterFail = await used(); // the refund settles when the run ends; read it back with the mock healthy again
    const ok = await ownCode(s, UNSURE, false);
    const afterOk = await used();
    const failedShown = !!fail.frames.at(-1)?.error;
    const okLast = ok.frames.at(-1) ?? {};
    const explained = /card--done/.test(okLast.card ?? '') && !okLast.error;
    if (afterFail === before && afterOk === before) { note(`M3 REG-83: this build doesn't count selected-code prompts (used stayed ${before}); refund not testable here`); return; }
    check(failedShown && afterFail === before, 'M3 REG-83: a selected-code explanation that fails (mock 500) gives its credit back', `used ${before} → ${afterFail}; error shown ${failedShown}`);
    check(explained && afterOk === before + 1, 'M3 REG-83: one that explains keeps its credit', `used ${afterFail} → ${afterOk}; explained ${explained}`);
  } catch (e) { check(false, 'M3 REG-83 credit refund', e.message.split('\n')[0]); } finally { await s?.app.close(); await setMode('stream'); }
}

async function m4() {
  let s;
  try {
    await setMode('hold');
    s = await launch(EXE, 'm4', `qa-motion-mock-m4-${Date.now()}`, mockEnv());
    const reduce = (p) => p.emulateMedia({ reducedMotion: 'reduce' }).catch(() => {});
    s.app.onWindow(reduce);
    const panel = await firstRunSample(s);
    await reduce(panel);
    check(await panel.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'M4: the panel reports reduced motion');
    // 0.1.50 shows the skeleton (.answer-wait) while waiting; older builds only mark the card streaming.
    await panel.locator('.answer-wait, .card--streaming').first().waitFor({ timeout: 20000 });
    note(`M4: waiting shows ${await panel.locator('.answer-wait').count() ? 'the skeleton' : 'no skeleton (pre-0.1.50 build)'}`);
    const frames = [];
    const frame = () => panel.evaluate(() => ({ running: document.getAnimations().filter((a) => a.playState === 'running').map((a) => `${a.animationName}`), leaving: !!document.querySelector('.answer-wait--leaving'), sentences: document.querySelectorAll('.short-answer__sentence').length, done: !!document.querySelector('.card--done') }));
    for (let i = 0; i < 15; i++) { frames.push({ phase: 'waiting', ...(await frame()) }); await sleep(100); }
    await shot(panel, 'm4-waiting');
    await setMode('stream');
    for (const t = Date.now(); Date.now() - t < 30000;) { const f = await frame(); frames.push({ phase: 'streaming', ...f }); if (f.done) break; await sleep(100); }
    const moving = [...new Set(frames.flatMap((f) => f.running))];
    check(moving.length === 0, 'M4: 0 running animations while waiting and streaming', moving.join(', ') || `${frames.length} frames`);
    check(!frames.some((f) => f.leaving), 'M4: the skeleton leaves without its exit animation');
    // More detail: the reveal jumps (no tween) and focus stays on the toggle.
    const toggle = panel.locator('.more-detail__toggle');
    if (await toggle.count()) {
      await toggle.click();
      const tops = [];
      for (const t = Date.now(); Date.now() - t < 8000;) {
        const f = await panel.evaluate(() => ({ top: document.querySelector('.body')?.scrollTop ?? 0, text: document.querySelector('.more-detail__body')?.innerText.length ?? 0, focus: document.activeElement?.className ?? '' }));
        tops.push(f); if (f.text > 200 && tops.length > 40) break; await sleep(16);
      }
      const values = [...new Set(tops.map((f) => Math.round(f.top)))];
      check(values.length <= 2, 'M4: More detail jumps to its place (no smooth scroll)', `scrollTop values ${values.join(' -> ')}`);
      check(tops.every((f) => f.focus.includes('more-detail__toggle')), 'M4: focus stays on the toggle', tops.at(-1)?.focus || 'no focus');
      await shot(panel, 'm4-more-detail');
    } else note('M4: no More detail toggle in this build (0.1.47 has none); reveal check skipped');
  } catch (e) { check(false, 'M4', e.message.split('\n')[0]); } finally { await s?.app.close(); await setMode('stream'); }
}

async function m7() {
  let s;
  try {
    await setMode('stream');
    s = await launch(EXE, 'm7', `qa-motion-mock-m7-${Date.now()}`, mockEnv());
    const panel = await firstRunSample(s);
    await finished(panel);
    const toggle = panel.locator('.more-detail__toggle');
    if (!(await toggle.count())) { note('M7: no More detail toggle in this build; skipped'); return; }
    const state = () => panel.evaluate(() => { const b = document.querySelector('.more-detail__toggle'); return { focused: document.activeElement === b, expanded: b?.getAttribute('aria-expanded'), label: b?.innerText.trim() }; });
    await toggle.focus();
    await panel.keyboard.press('Enter');
    await panel.locator('.more-detail__body .codeblock').waitFor({ timeout: 20000 });
    await finished(panel);
    const open = await state();
    check(open.focused && open.expanded === 'true' && open.label === 'Less detail', 'M7: Enter opens More detail and focus stays on the toggle', JSON.stringify(open));
    await panel.keyboard.press('Enter'); await sleep(400);
    const closed = await state();
    check(closed.focused && closed.expanded === 'false' && closed.label === 'More detail', 'M7: Enter again closes it, focus still on the toggle', JSON.stringify(closed));
    await panel.keyboard.press('Enter');
    const copy = panel.locator('.codeblock .cb-head button').first();
    await copy.waitFor({ timeout: 20000 });
    await finished(panel);
    // Keyboard only: Tab from the toggle to the code block's Copy button.
    let onCopy = false;
    for (let i = 0; i < 15 && !onCopy; i++) { await panel.keyboard.press('Tab'); onCopy = await copy.evaluate((b) => document.activeElement === b); }
    check(onCopy, 'M7: Tab reaches the code block Copy button');
    if (onCopy) {
      const nameOf = () => copy.evaluate((b) => b.getAttribute('aria-label') ?? b.innerText.trim());
      const before = await nameOf();
      const t0 = Date.now();
      await panel.keyboard.press('Enter');
      const marks = [];
      for (; Date.now() - t0 < 2400; await sleep(50)) marks.push({ ms: Date.now() - t0, ...(await copy.evaluate((b) => ({ copied: !!b.querySelector('.copy-label--done'), check: !!b.querySelector('.copy-label--done svg'), name: b.getAttribute('aria-label') ?? b.innerText.trim(), focused: document.activeElement === b }))) });
      const shown = marks.filter((m) => m.copied);
      const heldMs = shown.length ? shown.at(-1).ms - shown[0].ms : 0;
      check(shown.length > 0 && shown.every((m) => m.check), 'M7: "Copied" with a check appears', `${shown.length} frames`);
      check(heldMs >= 1400 && heldMs <= 1800, 'M7: "Copied" holds for about 1.6 s', `${heldMs} ms`);
      check(marks.every((m) => m.focused), 'M7: focus stays on Copy');
      const names = [...new Set(marks.map((m) => m.name))];
      check(names.length === 1 && names[0] === before, 'M7: the accessible name stays the same', `${before} -> ${names.join(' / ')}`);
    }
    await shot(panel, 'm7');
  } catch (e) { check(false, 'M7', e.message.split('\n')[0]); } finally { await s?.app.close(); }
}

/** M5 states for one version: onboarding, home and login, each focused then blurred; then reduced motion. */
async function loopStates(exe, label) {
  const rows = [];
  let s;
  const hold = async (state, focused) => {
    if (focused) await focusApp(s); else await blurApp();
    await sleep(STATE_S * 1000);
    rows.push(await sample(s, `${state} ${focused ? 'focused' : 'blurred'}`));
  };
  try {
    await setMode('stream');
    s = await launch(exe, `loops-${label}`, `qa-motion-mock-loops-${label}-${Date.now()}`, mockEnv());
    realFocus(s);
    await sleep(500);
    await s.companion.locator('.ob2__count').first().waitFor({ timeout: 30000 });
    await hold('onboarding', true); await hold('onboarding', false);
    await focusApp(s);
    const panel = await firstRunSample(s);
    await finished(panel);
    await sleep(3000);
    rows.push(await sample(s, 'panel done'));
    await shot(panel, `m5-${label}-panel-done`);
    await focusApp(s);
    await finishSetup(s);
    await shot(s.companion, `m5-${label}-home`);
    await hold('home', true); await hold('home', false);
    await focusApp(s);
    await accountMenu(s).click();
    await s.companion.getByRole('menuitem', { name: 'Sign in to sync' }).click();
    await s.companion.locator('.login').waitFor({ timeout: 15000 });
    await shot(s.companion, `m5-${label}-login`);
    await hold('login', true); await hold('login', false);
    for (const p of s.app.windows()) await p.emulateMedia({ reducedMotion: 'reduce' }).catch(() => {});
    await hold('login (reduced motion)', true);
    await s.companion.locator('.login__local').click({ timeout: 5000 });
    await hold('home (reduced motion)', true);
  } catch (e) { check(false, `M5/M6 ${label} states`, e.message.split('\n')[0]); } finally { await s?.app.close(); }
  return rows;
}

function m5(rows) {
  const by = (l) => rows.find((r) => r.label === l);
  const focusTook = rows.every((r) => { const c = r.windows['companion.html']; return !c || c.error || c.focused === /focused/.test(r.label) || r.label === 'panel done'; });
  check(focusTook, 'M5: every focused/blurred state took (companion document.hasFocus matched)', rows.map((r) => `${r.label}=${r.windows['companion.html']?.focused}`).join(', '));
  const done = by('panel done');
  if (done) check(runningLoops(done, (l, w) => w === 'widget.html').length === 0, 'M5 widget: no repeating loop once done', runningLoops(done, (l, w) => w === 'widget.html').join(', ') || 'none');
  check(rows.every((r) => runningLoops(r, (l) => l.away).length === 0), 'M5 buddy: no loop runs while buddy--away', rows.flatMap((r) => runningLoops(r, (l) => l.away).map((x) => `${r.label}: ${x}`)).join('; ') || 'none');
  const bobs = rows.flatMap((r) => Object.values(r.windows).flatMap((a) => (a.loops ?? []).filter((l) => l.name === 'vibeBob').map((l) => ({ ...l, label: r.label }))));
  check(bobs.every((b) => b.iterations <= 3), 'M5 vibeBob: at most 3 iterations', bobs.map((b) => `${b.label} ${b.state} ${b.iteration}/${b.iterations}`).join(', ') || 'not seen');
  check(bobs.filter((b) => /blurred/.test(b.label)).every((b) => b.state !== 'running'), 'M5 vibeBob: 0 running while blurred');
  const rm = rows.filter((r) => /reduced motion/.test(r.label));
  check(rm.length === 2 && rm.every((r) => Object.values(r.windows).every((a) => a.error || a.running === 0)), 'M5 reduced motion: no running animation at all', rm.map((r) => `${r.label}: ${Object.entries(r.windows).map(([w, a]) => `${w} ${a.running}`).join(', ')}`).join('; '));
}

function m6(before, after) {
  const lines = ['| State | GPU %CPU before -> after | GPU MB before -> after | Busiest renderer %CPU before -> after | Renderers MB before -> after |', '|---|---|---|---|---|'];
  const sum = (xs) => xs.reduce((a, b) => a + (b ?? 0), 0);
  const worse = [];
  for (const a of after) {
    const b = before.find((r) => r.label === a.label);
    if (!b) continue;
    const g = (r) => gpuOf(r) ?? {};
    const busiest = (r) => Math.max(0, ...renderersOf(r).map((p) => p.cpu));
    lines.push(`| ${a.label} | ${g(b).cpu ?? '?'} -> ${g(a).cpu ?? '?'} | ${g(b).footprintMb ?? '?'} -> ${g(a).footprintMb ?? '?'} | ${busiest(b)} -> ${busiest(a)} | ${sum(renderersOf(b).map((p) => p.footprintMb))} -> ${sum(renderersOf(a).map((p) => p.footprintMb))} |`);
    // Plan M6: blurred, the new GPU %CPU is no higher than the old one (0.5 points of ps noise allowed) and no
    // renderer is busy (under 1% each).
    if (/blurred/.test(a.label)) {
      if ((g(a).cpu ?? 0) > (g(b).cpu ?? 0) + 0.5) worse.push(`${a.label}: GPU ${g(b).cpu}% -> ${g(a).cpu}%`);
      if (busiest(a) >= 1) worse.push(`${a.label}: a renderer at ${busiest(a)}%`);
    }
  }
  writeFileSync(path.join(OUT, 'm6-table.md'), `${before[0]?.version ?? '?'} -> ${after[0]?.version ?? '?'}, ${STATE_S} s per state, mean of 5 ps reads\n\n${lines.join('\n')}\n`);
  say(lines.join('\n'));
  check(after.length > 0 && before.length > 0 && worse.length === 0, 'M6: blurred, GPU no busier than the baseline and every renderer under 1%', worse.join('; ') || 'within limits');
}

// ---- MOTION_PASS=real ---------------------------------------------------------------------------------------
const LONG = `async function fetchWithRetry(url, { attempts = 3, backoffMs = 250, timeoutMs = 8000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.status >= 500) throw new Error(\`server error \${res.status}\`);
      if (!res.ok) return { ok: false, status: res.status };
      return { ok: true, data: await res.json() };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((r) => setTimeout(r, backoffMs * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}`;
const UNSURE = 'const out = svc.apply(cfg, ctx);';

/** Frames every 100 ms from the request to done: what the panel shows while waiting and streaming. */
async function watch(panel) {
  const frames = [];
  for (const t = Date.now(); Date.now() - t < 120000;) {
    const f = await panel.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const sa = q('.body .short-answer');
      return {
        card: q('.card')?.className ?? '',
        skeleton: !!q('.answer-wait'),
        status: q('.answer-wait__status')?.textContent?.trim() ?? null,
        spinner: document.querySelectorAll('[class*="spinner"], [class*="loader"]').length,
        sentences: [...document.querySelectorAll('.short-answer__sentence')].map((e) => e.textContent),
        src: q('.src b')?.textContent?.trim() ?? null,
        short: sa ? sa.innerText : null,
        buddy: q('.head__mark .buddy')?.className ?? '',
        more: !!q('.more-detail__toggle'),
        cursor: !!q('.body .cursor'),
        error: q('.state[role="alert"]')?.innerText ?? null,
      };
    }).catch(() => null);
    if (f) { frames.push(f); if (f.error || (/card--done/.test(f.card) && !f.cursor)) break; }
    await sleep(100);
  }
  return frames;
}
/** `lines`: how many lines were selected, so the header and the wait status must say exactly "1 line" / "N lines". */
function m1m2(label, frames, lines = null) {
  const last = frames.at(-1) ?? {};
  if (last.error) { check(false, `M1 ${label}: explained`, last.error.replace(/\s+/g, ' ').slice(0, 140)); return; }
  if (!/card--done/.test(last.card ?? '')) { check(false, `M1 ${label}: finished`, `${frames.length} frames, last card ${last.card}`); return; }
  const want = lines === null ? null : `${lines} ${lines === 1 ? 'line' : 'lines'}`;
  if (want) {
    const shown = [...new Set(frames.map((f) => f.src).filter((x) => /^\d+ lines?$/.test(x ?? '')))]; // "Ready" before the count is known
    check(shown.length > 0 && shown.every((x) => x === want), `M1 ${label}: the panel header says "${want}"`, shown.join(' / ') || 'no line count seen in the header');
  }
  if (last.short === null) { note(`M1/M2 ${label}: a full answer, not a short one; the sentence checks apply to short answers only`); return; }
  const waiting = frames.filter((f) => f.skeleton);
  const status = want ? new RegExp(`^Reading ${want} of .+\u2026$`) : /^Reading (\d+ lines?|your request) of .+\u2026$|^Reading your request\u2026$/;
  if (!waiting.length && !frames.some((f) => f.status)) note(`M1 ${label}: no skeleton in this build (pre-0.1.50)`);
  else check(waiting.some((f) => status.test(f.status ?? '')), `M1 ${label}: waiting shows the skeleton and "Reading ${want ?? 'N lines'} of <language>\u2026"`, [...new Set(waiting.map((f) => f.status))].join(' / ') || 'no waiting frame caught');
  check(frames.every((f) => f.spinner === 0), `M1 ${label}: no spinner`);
  const streaming = frames.filter((f) => /card--streaming/.test(f.card));
  // Complete = ends at . ! ? (plus closing quotes/brackets), or a colon (a sentence also ends at a blank line).
  const partial = streaming.flatMap((f) => f.sentences.filter((x) => !/[.!?:]["')\]\u2019\u201d]*\s*$/.test(x.trim())));
  check(partial.length === 0, `M1 ${label}: never a partial sentence on screen (${streaming.length} streaming frames, 100 ms apart)`, partial.slice(0, 2).join(' | '));
  const rewritten = streaming.some((f, i) => i && f.sentences.slice(0, streaming[i - 1].sentences.length).some((x, j) => x !== streaming[i - 1].sentences[j]));
  check(!rewritten, `M1 ${label}: a shown sentence never changes`);
  const broken = frames.filter((f) => f.short && /`|\*\*/.test(f.short));
  check(broken.length === 0, `M2 ${label}: no code span or bold split on screen`, broken[0]?.short.slice(0, 140) ?? `${frames.filter((f) => f.short).length} frames`);
  const unsure = /(^|[.!?]\s+)Not sure:/.test(last.short);
  check(unsure ? /buddy--unsure/.test(last.buddy) && last.more : /buddy--done/.test(last.buddy), `M1 ${label}: done shows ${unsure ? 'buddy--unsure and More detail' : 'buddy--done'}`, `${last.buddy}${last.more ? ', More detail' : ''}`);
  if (!unsure && label === 'not sure') note('M1: the model did not answer "Not sure:" this time; the unsure path is covered by the mock pass');
}
async function ownCode(s, code, first) {
  execFileSync('pbcopy', { input: code });
  // Plain `open` asks macOS for the registered unvibe:// handler, as an editor does (the installed app on CI).
  execFileSync('open', ['unvibe://review?source=ide']);
  const panel = await s.app.windowWith('widget.html', 20000);
  if (!panel) throw new Error('the panel did not open');
  const consent = panel.locator('.consent-form');
  await consent.or(panel.locator('#confirm-title')).first().waitFor({ timeout: 30000 });
  if (first && await consent.count()) {
    const boxes = consent.locator('input[type="checkbox"]');
    for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
    await consent.getByRole('button', { name: 'Continue', exact: true }).click();
  }
  await panel.locator('#confirm-title').waitFor({ timeout: 30000 });
  await panel.locator('[aria-labelledby="confirm-title"]').getByRole('button', { name: 'Explain', exact: true }).click();
  return { panel, frames: await watch(panel) };
}

// ---- run ----------------------------------------------------------------------------------------------------
const result = { pass: PASS };
if (PASS === 'mock') {
  if (!process.env.MOTION_BACKEND) throw new Error('MOTION_BACKEND is required for the mock pass');
  // Production must be unreachable for this whole pass (the workflow blocks it): if the app ever ignored
  // MOTION_BACKEND, its calls fail instead of creating installs nobody flags.
  const blocked = await fetch('https://api.unvibe.site/api/v1/health', { signal: AbortSignal.timeout(5000) }).then(() => false, () => true);
  if (!blocked) throw new Error('api.unvibe.site is reachable: refusing the mock pass');
  note(`api.unvibe.site unreachable for this pass; explanations come from ${process.env.MOTION_BACKEND}`);
  await m3();
  await m3credit();
  await m4();
  await m7();
  // A mock-only unsure answer, so the unsure state is checked even when the model doesn't oblige.
  { let s; try { await setMode('unsure'); s = await launch(EXE, 'unsure', `qa-motion-mock-unsure-${Date.now()}`, mockEnv()); const panel = await firstRunSample(s); m1m2('mock unsure', await watch(panel)); await shot(panel, 'm1-mock-unsure'); } catch (e) { check(false, 'M1 mock unsure', e.message.split('\n')[0]); } finally { await s?.app.close(); await setMode('stream'); } }
  const after = await loopStates(EXE, 'tested');
  m5(after);
  const before = process.env.BASELINE_EXE ? await loopStates(process.env.BASELINE_EXE, 'baseline') : [];
  if (before.length) m6(before, after); else check(false, 'M6: the baseline ran', 'no BASELINE_EXE or no rows');
  result.loops = { before, after };
  result.mock = await mockStats();
  check((result.mock['POST /api/v1/reviews'] ?? 0) > 0, 'The app used the mock for its explanations', JSON.stringify(result.mock));
} else {
  const installId = process.env.MOTION_INSTALL_ID ?? '';
  if (!installId.startsWith('qa-') || !process.env.MOTION_PROFILE) throw new Error('MOTION_INSTALL_ID (qa-...) and MOTION_PROFILE are required for the real pass');
  let s;
  try {
    s = await launch(EXE, process.env.MOTION_PROFILE, installId);
    note(`Unvibe ${s.version}, install ${installId} (3 real explanations; the workflow flags it as QA)`);
    const panel = await firstRunSample(s);
    m1m2('first-run sample', await watch(panel)); await shot(panel, 'm1-sample');
    await focusApp(s);
    await finishSetup(s);
    const long = await ownCode(s, LONG, true); m1m2('long selection', long.frames, LONG.split('\n').length); await shot(long.panel, 'm1-long');
    const unsure = await ownCode(s, UNSURE, false); m1m2('not sure', unsure.frames, 1); await shot(unsure.panel, 'm1-unsure');
  } catch (e) { check(false, 'M1/M2 real explanations', e.message.split('\n')[0]); } finally { await s?.app.close(); }
}
writeFileSync(path.join(OUT, `motion-${PASS}.json`), JSON.stringify(result, null, 1));
writeFileSync(path.join(OUT, `motion-${PASS}-report.txt`), `${report.join('\n')}\n`);
say(`${failed ? `${failed} FAILED` : 'all passed'} (${PASS} pass)`);
process.exit(failed ? 1 : 0);
