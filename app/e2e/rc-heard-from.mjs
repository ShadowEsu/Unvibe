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
// The first-run footer (Back/forward row) must be fully in view without scrolling at the default window
// (1024x674 on the Mac): step 1 in every case and on the Intel build; case a also walks every step (Mac 4,
// Windows 3) and checks each one, plus whether the step's body fits without scrolling.
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

// --- First-run footer in view (the lead and Design, after df9c5497) --------------------------------
// The Back/forward row (`.ob2 .ob__actions`) and each of its buttons must be fully in view with nothing
// scrolled: inside the window and the card, not clipped by any overflow ancestor, and on top at its centre.
// Measured once the row has held still for 1.5 s (the step's entrance and Vibe's typewriter are done).
// Playwright's click scrolls first and its visibility ignores clipping, so neither proves this.
async function footerInView(page, forwardName) {
  const row = page.locator('.ob2 .ob__actions').first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  if (forwardName) await row.getByRole('button', { name: forwardName, exact: true }).first().waitFor({ state: 'attached', timeout: 10000 });
  let last = '';
  let since = Date.now();
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const box = await row.evaluate((el) => [...el.querySelectorAll('button'), el].map((e) => {
      const r = e.getBoundingClientRect();
      return [r.top, r.left, r.bottom, r.right].map(Math.round).join(',');
    }).join(';'));
    if (box !== last) { last = box; since = Date.now(); } else if (Date.now() - since >= 1500) break;
    await sleep(250);
  }
  return row.evaluate((rowEl, name) => {
    const round = (r) => ({ top: Math.round(r.top), left: Math.round(r.left), bottom: Math.round(r.bottom), right: Math.round(r.right) });
    const tagOf = (a) => `${a.tagName.toLowerCase()}${typeof a.className === 'string' && a.className.trim() ? `.${a.className.trim().split(/\s+/).join('.')}` : ''}`;
    const card = rowEl.closest('.ob2__card');
    const cardRect = card?.getBoundingClientRect();
    const measure = (el) => {
      const b = el.getBoundingClientRect();
      const within = (o) => b.top >= o.top - 0.5 && b.left >= o.left - 0.5 && b.bottom <= o.bottom + 0.5 && b.right <= o.right + 0.5;
      const clippedBy = [];
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const r = a.getBoundingClientRect();
        const inner = { top: r.top + a.clientTop, left: r.left + a.clientLeft, bottom: r.top + a.clientTop + a.clientHeight, right: r.left + a.clientLeft + a.clientWidth };
        if (!within(inner)) clippedBy.push(tagOf(a));
      }
      const hit = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
      return {
        what: el === rowEl ? 'footer row' : `button "${el.innerText.trim()}"`,
        rect: round(b),
        inWindow: within({ top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth }),
        inCard: !!cardRect && within(cardRect),
        clippedBy,
        onTop: !!hit && (hit === el || el.contains(hit)),
      };
    };
    const buttons = [...rowEl.querySelectorAll('button')];
    const forward = name ? buttons.find((b) => b.innerText.trim() === name) : buttons.at(-1);
    const scrolled = [];
    for (let a = rowEl; a; a = a.parentElement) if (a.scrollTop > 0 || a.scrollLeft > 0) scrolled.push(`${tagOf(a)} ${a.scrollTop}`);
    const body = rowEl.closest('.ob2')?.querySelector('.ob2__body');
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      forward: forward ? forward.innerText.trim() : null,
      card: cardRect ? round(cardRect) : null,
      parts: [rowEl, ...buttons].map(measure),
      scrolled,
      bodyOverflow: body ? Math.max(0, body.scrollHeight - body.clientHeight) : null,
    };
  }, forwardName);
}

async function checkFooter(page, label, forwardName, size = null) {
  const m = await footerInView(page, forwardName).catch((e) => ({ error: e.message.split('\n')[0] }));
  if (m.error) { log(false, `${label}: footer measured`, m.error); return; }
  const bad = m.parts.filter((p) => !p.inWindow || !p.inCard || p.clippedBy.length || !p.onTop);
  const fwd = m.parts.find((p) => p.what === `button "${m.forward}"`);
  log(!!m.forward && !bad.length && !m.scrolled.length, `${label}: "${m.forward}" and the footer row fully in view without scrolling (${m.viewport})`,
    JSON.stringify({ forward: fwd?.rect, card: m.card, bad, scrolled: m.scrolled }));
  log(m.bodyOverflow === 0, `${label}: the step fits whole (its body needs no scrolling)`, `body overflow ${m.bodyOverflow}px`);
  if (size) log(m.viewport === size, `${label}: measured at the default Mac window ${size}`, m.viewport);
}

// Case a goes on through every first-run step and checks the footer on each: step 2 before and after the
// sample is explained, step 3, and on a Mac step 4, which comes only after the person's own code is
// explained (a small function pasted on step 3's target; the first own code shows the send agreement).
async function walkSteps(app, companion, name) {
  const still = (label) => companion.screenshot({ path: path.join(out, `steps-${label}.png`) }).catch(() => {});
  try {
    await checkFooter(companion, `${name}: step 2 before explaining`, 'Skip for now');
    await companion.getByRole('button', { name: 'Explain this code', exact: true }).first().click({ timeout: 8000 });
    await companion.locator('.ob2 .ob__actions').getByRole('button', { name: 'Next', exact: true }).waitFor({ timeout: 90000 });
    await checkFooter(companion, `${name}: step 2 explained`, 'Next');
    await still('2-explained');
    await companion.locator('.ob2 .ob__actions').getByRole('button', { name: 'Next', exact: true }).click({ timeout: 8000 });
    await companion.locator('.ob2__count').filter({ hasText: `3 / ${setupSteps}` }).waitFor({ timeout: 10000 });
    await checkFooter(companion, `${name}: step 3`, osName === 'windows' ? 'Start using Unvibe' : 'Skip for now');
    await still('3');
    if (osName !== 'mac') return;
    const box = companion.locator('.paste-target__box');
    await box.waitFor({ timeout: 8000 });
    await box.evaluate((el, code) => {
      el.focus();
      const data = new DataTransfer();
      data.setData('text/plain', code);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, 'function add(a, b) {\n  return a + b;\n}');
    const panel = await app.windowWith('widget.html', 20000);
    if (!panel) throw new Error('the review panel did not open after the paste');
    const four = companion.locator('.ob2__count').filter({ hasText: `4 / ${setupSteps}` });
    let agreed = false;
    let explainClicked = false;
    const t0 = Date.now();
    while (!(await four.count()) && Date.now() - t0 < 120000) {
      const consent = panel.locator('.consent-form');
      if (!agreed && await consent.count()) {
        const boxes = consent.locator('input[type="checkbox"]');
        for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
        await consent.getByRole('button', { name: 'Continue', exact: true }).click({ timeout: 8000 });
        agreed = true;
        note(`${name}: first own code: send agreement shown, boxes ticked, Continue`);
      }
      if (!explainClicked && await panel.locator('#confirm-title').count()) {
        await panel.getByRole('button', { name: 'Explain', exact: true }).first().click({ timeout: 8000 }).catch(() => {});
        explainClicked = true;
      }
      await sleep(500);
    }
    await four.waitFor({ timeout: 1000 });
    await checkFooter(companion, `${name}: step 4`, null);
    await still('4');
  } catch (e) {
    log(false, `${name}: walk every first-run step`, e.message.split('\n')[0]);
    await still('stuck');
  }
}

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
    // Measured on first sight, before typing or any click.
    await checkFooter(companion, `${name}: step 1`, "Let's go", osName === 'mac' && id === 'a' ? '1024x674' : null);
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
    if (id === 'a') await walkSteps(app, companion, name);
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
    await checkFooter(companion, 'Intel (x64) build: step 1', "Let's go");
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
