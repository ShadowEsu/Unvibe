// 0.1.50 RC gates on a real Mac or Windows runner (Unvibe QA, 5 Nov), run after the standard walkthrough:
//
// heard_from, the optional first-run answer to "Where did you hear about Unvibe?". Each case is a fresh,
// qa-prefixed install (the workflow flags it as QA) whose traffic goes through a pass-through forwarder on
// this runner, so the test counts exactly what the app sends while production stores it for real:
//   a  blank answer, "Let's go"                         → 0 heard_from sends, also after a relaunch
//   b  plain answer, "Let's go", setup progress off      → exactly 1 send, answered 204, kept 1 after a relaunch
//   c  answer with an email address and a phone number   → exactly 1 send; the server stores it with both removed
// Across all cases no other setup-progress step is sent, since "Send setup progress" stays off. The stored
// values are read back afterwards with the SQL this script prints (the lead, read-only).
//
// On a Mac with X64_EXE set: the Intel build opens under Rosetta (GitHub's Mac runner is Apple silicon).
//
// The forwarder: a release build ignores a localhost UNVIBE_BACKEND, so it listens on this runner's own
// network address. It forwards every request unchanged to https://api.unvibe.site and keeps only method,
// path, status and, for trial/progress, the step and the answer the app sent. Never headers.
//
// env: UNVIBE_EXE, UNVIBE_OS (mac|windows), SHOTS_DIR, PROFILES_DIR, RUN_TAG (<run id>-<attempt>), X64_EXE (Mac)
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { launchApp, readStore } from './cdp-launch.mjs';

const exe = process.env.UNVIBE_EXE;
const osName = process.env.UNVIBE_OS;
const out = process.env.SHOTS_DIR;
const profiles = process.env.PROFILES_DIR;
const tag = process.env.RUN_TAG || `local-${Date.now()}`;
if (!exe || !osName || !out || !profiles) throw new Error('UNVIBE_EXE, UNVIBE_OS, SHOTS_DIR and PROFILES_DIR are required');
mkdirSync(out, { recursive: true });

// Setup has 4 steps on a Mac and 3 on Windows (real-device.mjs).
const setupSteps = osName === 'windows' ? 3 : 4;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];
let failures = 0;
const log = (ok, name, detail = '') => {
  if (!ok) failures++;
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`;
  report.push(line);
  console.log(line);
};
const note = (text) => { report.push(`NOTE  ${text}`); console.log(`NOTE  ${text}`); };

// --- The forwarder ---------------------------------------------------------------------------------
const UPSTREAM = 'api.unvibe.site';
const hits = [];
let current = 'none';
const address = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
if (!address) throw new Error('no non-loopback IPv4 address for the forwarder');
const HOP = ['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer'];
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const route = req.url.split('?')[0];
    const hit = { at: new Date().toISOString(), case: current, method: req.method, path: route, status: null };
    if (req.method === 'POST' && route === '/api/v1/trial/progress') {
      try {
        const sent = JSON.parse(body.toString('utf8'));
        hit.step = sent?.step ?? null;
        if (sent?.step === 'heard_from') hit.answer = sent.answer;
      } catch { hit.step = 'unparsable'; }
    }
    hits.push(hit);
    const headers = { ...req.headers, host: UPSTREAM };
    for (const h of HOP) delete headers[h];
    if (body.length) headers['content-length'] = String(body.length);
    else delete headers['content-length'];
    const up = https.request({ host: UPSTREAM, port: 443, method: req.method, path: req.url, headers }, (upRes) => {
      hit.status = upRes.statusCode;
      const back = { ...upRes.headers };
      for (const h of HOP) delete back[h];
      res.writeHead(upRes.statusCode, back);
      upRes.pipe(res);
    });
    up.on('error', (e) => {
      hit.status = `error ${e.code || e.message}`;
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    up.end(body);
  });
});
await new Promise((resolve) => server.listen(0, address, resolve));
const backend = `http://${address}:${server.address().port}`;
// The forwarder must reach production before any case runs, or every count below means nothing.
current = 'self-check';
const health = await fetch(`${backend}/api/v1/health`).then((r) => r.status).catch((e) => `error ${e.message}`);
log(health === 200, `forwarder ${backend} reaches ${UPSTREAM} (GET /api/v1/health)`, `status ${health}`);

// --- heard_from cases ------------------------------------------------------------------------------
const CASES = [
  { id: 'a', answer: '' },
  { id: 'b', answer: 'QA heard-from B: a friend on r/webdev' },
  { id: 'c', answer: 'QA heard-from C: Sam (qa.heardfrom@example.com, +1 (415) 555-0100) at a meetup' },
];
const installIds = [];
const appEnv = { ...process.env, UNVIBE_BACKEND: backend };
for (const k of ['UNVIBE_ADMIN_STATS_TOKEN', 'UNVIBE_QA_FLAG_TOKEN', 'GITHUB_TOKEN']) delete appEnv[k];

const heardSends = (id) => hits.filter((h) => h.case.startsWith(`${id}:`) && h.step === 'heard_from');
const settingOn = (userData) => {
  const file = path.join(userData, 'unvibe-settings.json');
  return existsSync(file) && JSON.parse(readFileSync(file, 'utf8')).shareSetupProgress === true;
};

let casesRan = 0;
for (const { id, answer } of CASES) {
  const name = `heard_from ${id} (${answer ? 'answer typed' : 'blank'})`;
  const userData = path.join(profiles, `heard-${id}-profile`);
  rmSync(userData, { recursive: true, force: true });
  mkdirSync(userData, { recursive: true });
  const installId = `qa-heard-${tag}-${osName}-${id}`;
  installIds.push(installId);
  // No settings file: "Send setup progress" stays at its default, off.
  writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId }));
  let app = null;
  let firstOk = false;
  let relaunchOk = false;
  try {
    current = `${id}:first`;
    app = await launchApp({ exe, userData, env: appEnv, timeout: 90000 });
    const companion = await app.windowWith('companion.html', 60000);
    if (!companion) throw new Error('no companion window');
    await companion.locator('.ob2__count').filter({ hasText: `1 / ${setupSteps}` }).waitFor({ timeout: 30000 });
    const field = companion.locator('input[aria-describedby="heard-from-note"]');
    const labelShown = await companion.getByText('Where did you hear about Unvibe?').first().isVisible().catch(() => false);
    const fieldShown = await field.isVisible().catch(() => false);
    const noteText = (await companion.locator('#heard-from-note').innerText().catch(() => '')).trim();
    log(labelShown && fieldShown && noteText === "Sent once to Unvibe with this install's random ID. Leave it blank to send nothing.",
      `${name}: the first-run question shows (label, field, note)`, `label ${labelShown}, field ${fieldShown}, note "${noteText}"`);
    if (answer) await field.fill(answer);
    await companion.screenshot({ path: path.join(out, `heard-${id}-step1.png`) });
    await companion.getByRole('button', { name: "Let's go", exact: true }).first().click({ timeout: 8000 });
    await companion.locator('.ob2__count').filter({ hasText: `2 / ${setupSteps}` }).waitFor({ timeout: 15000 });
    // The send is fire and forget: wait for the store to mark it sent (typed) or a fixed 15 s (blank).
    const t = Date.now();
    while (Date.now() - t < (answer ? 30000 : 15000)) {
      if (answer && readStore(userData).progressSent?.heard_from) break;
      await sleep(500);
    }
    await sleep(2000);
    await companion.screenshot({ path: path.join(out, `heard-${id}-step2.png`) });
    firstOk = true;
  } catch (e) {
    log(false, `${name}: first launch through step 1`, e.message.split('\n')[0]);
  } finally {
    await app?.close();
  }
  const afterFirst = heardSends(id).map(({ status, answer: sent }) => ({ status, sent }));
  const storeFirst = readStore(userData);

  // Relaunch the same install: a sent answer must not go again; a blank one must still send nothing.
  app = null;
  try {
    current = `${id}:relaunch`;
    app = await launchApp({ exe, userData, env: appEnv, timeout: 90000 });
    if (!(await app.windowWith('companion.html', 60000))) throw new Error('no companion window');
    await sleep(15000);
    relaunchOk = true;
  } catch (e) {
    log(false, `${name}: relaunch`, e.message.split('\n')[0]);
  } finally {
    await app?.close();
  }
  const all = heardSends(id).map(({ status, answer: sent }) => ({ status, sent }));
  const storeLast = readStore(userData);
  // Every count below is only evidence if this install's requests really went through the forwarder.
  const routed = hits.filter((h) => h.case.startsWith(`${id}:`));
  log(routed.length > 0, `${name}: the app's requests go through the forwarder`,
    `${routed.length}: ${[...new Set(routed.map((h) => `${h.method} ${h.path} ${h.status}`))].join(', ')}`);
  const ran = firstOk && relaunchOk && routed.length > 0;
  if (ran) casesRan++;

  if (!answer) {
    log(ran && afterFirst.length === 0 && all.length === 0, `${name}: nothing sent, also after a relaunch`, JSON.stringify(all));
    log(ran && !storeLast.heardFrom && !storeLast.progressSent?.heard_from, `${name}: nothing kept or marked sent locally`,
      JSON.stringify({ heardFrom: storeLast.heardFrom ?? null, sent: storeLast.progressSent?.heard_from ?? null }));
  } else {
    log(afterFirst.length === 1 && afterFirst[0].status === 204, `${name}: sent exactly once on "Let's go", answered 204`, JSON.stringify(afterFirst));
    log(afterFirst[0]?.sent === answer, `${name}: the app sent the typed answer as typed (removal is the server's)`, JSON.stringify(afterFirst[0]?.sent ?? null));
    log(storeFirst.progressSent?.heard_from === true && !storeFirst.heardFrom, `${name}: marked sent and the local copy deleted`,
      JSON.stringify({ heardFrom: storeFirst.heardFrom ?? null, sent: storeFirst.progressSent?.heard_from ?? null }));
    log(ran && all.length === 1, `${name}: still exactly 1 send after a relaunch`, `${all.length} sends: ${JSON.stringify(all)}`);
  }
  log(firstOk && !settingOn(userData), `${name}: "Send setup progress" is off for this install`);
}
const otherSteps = hits.filter((h) => h.step && h.step !== 'heard_from');
log(casesRan === CASES.length && otherSteps.length === 0, 'setup progress off: no other progress step was sent by any case',
  `${casesRan}/${CASES.length} cases ran; ${JSON.stringify(otherSteps.map((h) => `${h.case} ${h.step} ${h.status}`))}`);

// --- The Intel Mac build, under Rosetta ------------------------------------------------------------
if (osName === 'mac' && process.env.X64_EXE) {
  const x64 = process.env.X64_EXE;
  const userData = path.join(profiles, 'x64-profile');
  rmSync(userData, { recursive: true, force: true });
  mkdirSync(userData, { recursive: true });
  const installId = `qa-x64-${tag}`;
  installIds.push(installId);
  writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId }));
  const archs = execFileSync('lipo', ['-archs', x64]).toString().trim();
  const machine = execFileSync('uname', ['-m']).toString().trim();
  note(`Intel build: binary archs "${archs}", runner ${machine}`);
  let app = null;
  try {
    current = 'x64';
    const env = { ...process.env };
    for (const k of ['UNVIBE_ADMIN_STATS_TOKEN', 'UNVIBE_QA_FLAG_TOKEN', 'GITHUB_TOKEN', 'UNVIBE_BACKEND']) delete env[k];
    app = await launchApp({ exe: '/usr/bin/arch', args: ['-x86_64', x64], userData, env, timeout: 120000 });
    const companion = await app.windowWith('companion.html', 90000);
    if (!companion) throw new Error('no companion window');
    await companion.locator('.ob2__count').filter({ hasText: `1 / ${setupSteps}` }).waitFor({ timeout: 30000 });
    await sleep(10000);
    const alive = app.process.exitCode === null && app.process.signalCode === null;
    await companion.screenshot({ path: path.join(out, 'x64-first-launch.png') });
    log(archs === 'x86_64' && machine === 'arm64' && alive, 'Intel (x64) Mac build opens under Rosetta and stays open 10 s (first-run step 1 shown)',
      `archs ${archs}, runner ${machine}, alive ${alive}`);
  } catch (e) {
    log(false, 'Intel (x64) Mac build opens under Rosetta', e.message.split('\n')[0]);
  } finally {
    await app?.close();
  }
}

server.close();
const sql = [
  '-- Read-only: the stored first-run answer for every install this run made.',
  'with ids(install_id) as (values',
  installIds.map((i) => `  ('${i}')`).join(',\n'),
  ')',
  'select ids.install_id, i.platform, i.first_version, i.qa, i.heard_from',
  'from ids left join public.trial_installs i',
  "  on i.install_key = encode(sha256(convert_to('unvibe-trial-install:' || ids.install_id, 'UTF8')), 'hex')",
  'order by 1;',
].join('\n');
writeFileSync(path.join(out, 'rc-0150-forwarder-hits.json'), JSON.stringify(hits, null, 1));
writeFileSync(path.join(out, 'rc-0150-report.txt'),
  `Unvibe 0.1.50 RC: heard_from${osName === 'mac' ? ' and the Intel build' : ''} (${osName})\n\n${report.join('\n')}\n\ninstall ids: ${installIds.join(', ')}\n\n${sql}\n`);
console.log(`\n${failures} FAIL\ninstall ids: ${installIds.join(', ')}`);
process.exit(failures ? 1 : 0);
