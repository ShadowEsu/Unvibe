// Startup time and memory of the installed Unvibe app (1.0 budgets, QA checklist B6), on CI runners or
// on a Mac with E2E_LOCAL=1. Throwaway profiles only, each with a seeded qa-prefixed install id.
//
// Per round, on a new profile:
//   cold     = spawn → first contentful paint of the bar (island) and of the companion window
//   first    = spawn → the first-run sample explanation finished (hello → Let's go → Explain this code)
//   warm     = the same profile started again after a full exit, spawn → first paint
// On the last round only: total RSS of every app process while idle (each minute up to IDLE_S), then
// after each of EXPLANATIONS re-explanations of the sample at another depth (growth across them).
// Paint times come from the window's own Performance timeline (performance.timeOrigin + paint entry),
// so the debug-port connection delay is not counted.
//
//   UNVIBE_EXE=<app binary> UNVIBE_OS=mac|windows OUT=<dir> PERF_PROFILES=<dir> PERF_ID_PREFIX=qa-perf-x \
//   ROUNDS=5 IDLE_S=300 EXPLANATIONS=10 node perf.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { launchApp, readStore } from './cdp-launch.mjs';

const exe = process.env.UNVIBE_EXE;
if (!exe) throw new Error('UNVIBE_EXE is required');
const os = process.env.UNVIBE_OS || (process.platform === 'win32' ? 'windows' : 'mac');
const out = process.env.OUT || path.join(tmpdir(), 'unvibe-perf'); mkdirSync(out, { recursive: true });
const profiles = process.env.PERF_PROFILES || path.join(tmpdir(), `unvibe-perf-profiles-${Date.now()}`);
const prefix = process.env.PERF_ID_PREFIX || `qa-perf-local-${Date.now()}`;
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const IDLE_S = Number(process.env.IDLE_S ?? 300);
const EXPLANATIONS = Number(process.env.EXPLANATIONS ?? 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => { const v = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
const appDir = os === 'mac' ? exe.replace(/\/Contents\/MacOS\/[^/]+$/, '') : path.dirname(exe);

/** Which Electron process a command line belongs to: main, gpu, utility:<sub-type>, renderer:<client id>. */
function kind(cmd) {
  const type = cmd.match(/--type=([\w-]+)/)?.[1];
  if (!type) return 'main';
  if (type === 'renderer') return `renderer:${cmd.match(/--renderer-client-id=(\d+)/)?.[1] ?? '?'}`;
  if (type === 'gpu-process') return 'gpu';
  if (type === 'utility') return `utility:${cmd.match(/--utility-sub-type=([\w.]+)/)?.[1] ?? '?'}`;
  return type;
}

/**
 * Memory of every process started from this app's folder, in MB, in total and per process.
 * `mb` sums resident memory (RSS / working set), which counts pages shared between Electron's
 * processes once per process. `footprintMb` is what Activity Monitor / Task Manager show:
 * macOS phys_footprint, Windows private bytes.
 */
function memory() {
  let procs;
  if (os === 'mac') {
    const rows = execFileSync('ps', ['-axww', '-o', 'pid=,rss=,command=']).toString().split('\n').filter((l) => l.includes(appDir));
    procs = rows.map((l) => { const m = l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/); return { pid: m[1], rssMb: Math.round(Number(m[2]) / 1024), kind: kind(m[3]) }; });
    try {
      const text = execFileSync('footprint', ['-f', 'bytes', ...procs.flatMap((p) => ['-p', p.pid])], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const m of text.matchAll(/\[(\d+)\]:.*?Footprint: (\d+) B/g)) {
        const p = procs.find((x) => x.pid === m[1]); if (p) p.footprintMb = Math.round(Number(m[2]) / 1048576);
      }
    } catch { /* footprint unavailable: RSS only */ }
  } else {
    // Single-quoted PowerShell literal (backslashes stay as they are), passed as -EncodedCommand so no
    // command-line quoting can change it.
    const ps = `Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith('${appDir.replace(/'/g, "''")}', 'OrdinalIgnoreCase') } | ForEach-Object { "$($_.ProcessId)\`t$($_.WorkingSetSize)\`t$($_.PrivatePageCount)\`t$($_.CommandLine)" }`;
    procs = execFileSync('powershell', ['-NoProfile', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean).map((l) => {
      const [pid, ws, priv, ...cmd] = l.split('\t');
      return { pid, rssMb: Math.round(Number(ws) / 1048576), footprintMb: Math.round(Number(priv) / 1048576), kind: kind(cmd.join('\t')) };
    });
  }
  const sum = (k) => (procs.every((p) => typeof p[k] === 'number') ? procs.reduce((s, p) => s + p[k], 0) : null);
  return { mb: sum('rssMb'), footprintMb: sum('footprintMb'), processes: procs.length, perProcess: procs.map(({ kind: k, rssMb, footprintMb }) => ({ kind: k, rssMb, footprintMb })) };
}

/** JS heap in use per app window (Chromium's performance.memory), to tell which window grows. */
async function heaps(app) {
  const out = {};
  for (const w of app.windows()) {
    const name = w.url().split('/').pop()?.split('?')[0];
    out[name] = await w.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576)).catch(() => null);
  }
  return out;
}

/** Epoch ms of a window's first contentful paint, or null if it hasn't painted (hidden) within `wait`. */
async function paintedAt(page, wait = 30000) {
  if (!page) return null;
  return page.evaluate(async (w) => {
    const t = Date.now();
    while (Date.now() - t < w) {
      const fcp = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint');
      if (fcp) return Math.round(performance.timeOrigin + fcp.startTime);
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }, wait).catch(() => null);
}

async function start(userData) {
  const spawnedAt = Date.now();
  const app = await launchApp({ exe, userData, timeout: 90000 });
  const companion = await app.windowWith('companion.html', 60000);
  const bar = await app.windowWith('bar.html', 10000);
  const [companionAt, barAt] = await Promise.all([paintedAt(companion), paintedAt(bar, 10000)]);
  return { app, companion, spawnedAt, companionMs: companionAt && companionAt - spawnedAt, barMs: barAt && barAt - spawnedAt };
}

/** Waits until the panel's current explanation has finished streaming. */
async function finished(app, timeout = 120000) {
  const t = Date.now();
  while (Date.now() - t < timeout) {
    const panel = await app.windowWith('widget.html', 20000);
    if (panel) {
      if (await panel.getByText("Couldn't explain that").count()) throw new Error(`explanation failed: ${await panel.locator('.state').first().innerText()}`);
      const done = await panel.locator('.card--done .local-save-note').count() && !(await panel.locator('.body .cursor').count());
      if (done) return panel;
    }
    await sleep(250);
  }
  throw new Error(`explanation did not finish in ${timeout / 1000}s`);
}

const steps = os === 'windows' ? 3 : 4;
const rounds = [];
let idle = null; let explanations = null; let version = null;
const failures = [];
for (let r = 1; r <= ROUNDS; r++) {
  const userData = path.join(profiles, `perf-${r}`);
  rmSync(userData, { recursive: true, force: true }); mkdirSync(userData, { recursive: true });
  // Launch at login already answered: this measures startup, and a native sheet would only get in the way.
  writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId: `${prefix}-${r}`, loginPromptAsked: true }));
  const round = { round: r, installId: `${prefix}-${r}` };
  try {
    const a = await start(userData);
    version ??= (await a.companion.evaluate(() => window.unvibe.appInfo())).version;
    round.coldBarMs = a.barMs; round.coldCompanionMs = a.companionMs; round.coldMemMb = memory().mb;
    // First run at a brisk human pace, as the walkthrough's 60 s promise measures it.
    await a.companion.locator('.ob2__count').filter({ hasText: `1 / ${steps}` }).waitFor({ timeout: 20000 });
    await a.companion.getByPlaceholder('Your name').fill('Sam');
    await a.companion.getByRole('button', { name: "Let's go", exact: true }).first().click();
    await a.companion.locator('.ob2__count').filter({ hasText: `2 / ${steps}` }).waitFor({ timeout: 8000 });
    await a.companion.getByRole('button', { name: 'Explain this code', exact: true }).first().click();
    let panel = await finished(a.app);
    round.firstExplanationS = Math.round((Date.now() - a.spawnedAt) / 100) / 10;
    if (r === ROUNDS) {
      idle = [];
      for (let s = 60; s <= IDLE_S; s += 60) { await sleep(60000); idle.push({ s, ...memory(), heapMb: await heaps(a.app) }); }
      explanations = [{ n: 0, ...memory(), heapMb: await heaps(a.app) }];
      const levels = ['new', 'beginner', 'intermediate', 'advanced'];
      for (let n = 1; n <= EXPLANATIONS; n++) {
        const current = await panel.locator('.lvl.on').getAttribute('data-level').catch(() => null);
        const next = levels[(levels.indexOf(current) + 1) % levels.length];
        await panel.locator(`.lvl[data-level="${next}"]`).click();
        await panel.locator('.body .cursor').waitFor({ timeout: 15000 }).catch(() => {});
        panel = await finished(a.app);
        explanations.push({ n, level: next, ...memory(), heapMb: await heaps(a.app) });
      }
    }
    await a.app.close();
    await sleep(2000);
    const b = await start(userData);
    await sleep(3000);
    round.warmBarMs = b.barMs; round.warmCompanionMs = b.companionMs; round.warmMemMb = memory().mb;
    await b.app.close();
    round.installIdOnDisk = readStore(userData).installId;
  } catch (e) {
    round.error = e.message.split('\n')[0];
    failures.push(`round ${r}: ${round.error}`);
  }
  rounds.push(round);
  console.log(`round ${r}: ${JSON.stringify(round)}`);
  await sleep(2000);
}

const pick = (k) => rounds.map((x) => x[k]);
const result = {
  os, version, exe, rounds,
  median: {
    coldBarMs: median(pick('coldBarMs')), coldCompanionMs: median(pick('coldCompanionMs')),
    warmBarMs: median(pick('warmBarMs')), warmCompanionMs: median(pick('warmCompanionMs')),
    firstExplanationS: median(pick('firstExplanationS')),
  },
  idle, explanations,
  growthPct: explanations && explanations[0].mb ? Math.round(((explanations.at(-1).mb - explanations[0].mb) / explanations[0].mb) * 1000) / 10 : null,
  footprintGrowthPct: explanations && explanations[0].footprintMb ? Math.round(((explanations.at(-1).footprintMb - explanations[0].footprintMb) / explanations[0].footprintMb) * 1000) / 10 : null,
  failures,
};
writeFileSync(path.join(out, 'perf.json'), JSON.stringify(result, null, 1));
console.log(`median ${JSON.stringify(result.median)}`);
console.log(`idle rss ${JSON.stringify(idle?.map((e) => e.mb))} footprint ${JSON.stringify(idle?.map((e) => e.footprintMb))}`);
console.log(`explanations rss ${JSON.stringify(explanations?.map((e) => e.mb))} footprint ${JSON.stringify(explanations?.map((e) => e.footprintMb))} growth rss ${result.growthPct}% footprint ${result.footprintGrowthPct}%`);
for (const [label, e] of [['idle 1 min', idle?.[0]], ['idle 5 min', idle?.at(-1)], ['after explanations', explanations?.at(-1)]]) {
  if (e) console.log(`${label}: ${e.perProcess.map((p) => `${p.kind} ${p.rssMb}/${p.footprintMb ?? '?'}`).join(', ')} | heap ${JSON.stringify(e.heapMb)}`);
}
console.log(`install ids: ${rounds.map((x) => x.installId).join(', ')}`);
process.exit(failures.length ? 1 : 0);
