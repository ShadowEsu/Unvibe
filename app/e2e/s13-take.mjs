// S13 "Did you ask what it exposes?" (Studio's concept; Marketing's take ask requests/unvibe-helper/20261117-2210;
// sample Security S-2 GO 20261117-2209; BOSS GO: exactly 1 hosted call, one attempt): lines 8-14 of Marketing's
// messages.js selected in TextEdit on the released app, Control+U, one Beginner explanation.
//
// The profile is set up the way a returning person's is, without the onboarding's sample: a first launch (it explains
// nothing) writes the app's own settings; onboarded, own code explained, Beginner and the light theme are merged into
// them, and the store says the launch-at-login question was asked. Before Control+U the selection is checked by
// copying it (Command+C, pbpaste): it must be exactly the 7 lines (sha256 48d7a3d7…; one trailing newline allowed and
// recorded). A wrong selection stops the take before Control+U, so it costs no call.
//
// S13_TAKE=dry sends nothing: the send agreement is NOT given, so Control+U only opens the panel's agreement form
// (checked: 3 unticked boxes, nothing streams), which proves the install, the setup, the selection, the shortcut and
// the panel stills on the runner. S13_TAKE=take gives the agreement through the app's own IPC (consentAgree, as
// consent-fixture.mjs and the S8 take) and presses Control+U once: the one hosted call. Nothing is retried.
//
// MEDIA_DIR/shots: s13-textedit-selected.png (the desktop with TextEdit's highlight, screencapture at the runner's 1x);
// the panel stills from panel-take.mjs at 2x and 3x (still A, the hook: header, depth row with Beginner lit, the whole
// selected code; still B: the whole answer, "Not sure:" line included, in parts if it can't show at once);
// s13-with-panel.png (the desktop with the panel). take.json: version, the selection's sha256, the code the panel
// received, the depth, the answer word for word, every still's size and sha256, and each check.
// Env: UNVIBE_EXE, MEDIA_DIR, MEDIA_INSTALL_ID (qa-, flagged by the workflow), S13_TAKE (dry | take).
import { launchApp } from './cdp-launch.mjs';
import { shot } from './media-window.mjs';
import { captureStills, finishedPanel, panelState, wake } from './panel-take.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

if (process.platform !== 'darwin') throw new Error('s13-take.mjs runs on macOS (TextEdit, Control+U)');
const mode = process.env.S13_TAKE;
if (mode !== 'dry' && mode !== 'take') throw new Error('S13_TAKE must be dry or take');
const dry = mode === 'dry';
const exe = process.env.UNVIBE_EXE;
if (!exe) throw new Error('Set UNVIBE_EXE to an installed release build');
const out = path.resolve(process.env.MEDIA_DIR ?? 'media');
const shots = path.join(out, 'shots');
mkdirSync(shots, { recursive: true });

const sha = (b) => createHash('sha256').update(b).digest('hex');
const FILE_SHA = '047e2c30d064ba8afd0c563d45fb2e87ebade7cb9d6587a3b89ae52327c6e321';
const SELECTION_SHA = '48d7a3d7ac5d4db3092d5dbf3d81f736143dd1b2f008f2e1b515ea0932f6574d';
const source = readFileSync(new URL('./media-samples/s13/messages.js', import.meta.url));
if (sha(source) !== FILE_SHA) throw new Error(`messages.js hashes to ${sha(source).slice(0, 16)}, not ${FILE_SHA.slice(0, 16)}`);
// Lines 8-14, joined by \n with no final newline: 212 characters.
const selection = source.toString('utf8').split('\n').slice(7, 14).join('\n');
if (selection.length !== 212 || sha(Buffer.from(selection, 'utf8')) !== SELECTION_SHA) throw new Error('lines 8-14 are not the 212-character selection Marketing named');

const report = [];
const log = (ok, what, why = '') => {
  const line = `${ok === null ? 'NOTE' : ok ? 'PASS' : 'FAIL'}  ${what}${why ? ` (${why})` : ''}`;
  report.push(line);
  console.log(line);
};
log(true, 'the selection is lines 8-14 of messages.js', `${selection.length} chars, sha256 ${SELECTION_SHA}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const osa = (...script) => execFileSync('osascript', script.flatMap((l) => ['-e', l]), { encoding: 'utf8', timeout: 30000 }).trim();
const keystroke = (key, mods) => osa(`tell application "System Events" to keystroke "${key}" using {${mods}}`);
const frontmost = () => osa('tell application "System Events" to get name of first process whose frontmost is true');
const grab = (name) => execFileSync('screencapture', ['-x', path.join(shots, `${name}.png`)]);
const result = { version: '', mode, sample: { file: 'media-samples/s13/messages.js', sha256: FILE_SHA, lines: '8-14', selectionSha256: SELECTION_SHA } };
const finish = (code) => {
  result.report = report;
  writeFileSync(path.join(out, 'take.json'), JSON.stringify(result, null, 2));
  writeFileSync(path.join(out, 'report.txt'), `${report.join('\n')}\n`);
  process.exit(code ?? (report.some((l) => l.startsWith('FAIL')) ? 1 : 0));
};

// --- The app, set up as a returning person's ---------------------------------------------------------------------
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-s13-'));
const installId = process.env.MEDIA_INSTALL_ID ?? `qa-s13-local-${Date.now()}`;
writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId, loginPromptAsked: true }));
console.log(`install id ${installId}`);
let app = await launchApp({ exe, userData, timeout: 90000 });
const first = await app.windowWith('companion.html', 60000);
if (!first) throw new Error('the companion did not open on the first launch');
await first.waitForLoadState('domcontentloaded');
result.version = (await first.evaluate(() => window.unvibe.appInfo())).version;
await sleep(3000);
await app.close();
const settingsFile = path.join(userData, 'unvibe-settings.json');
if (!existsSync(settingsFile)) throw new Error('the first launch wrote no settings');
const settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
Object.assign(settings, { onboarded: true, ownCodeExplained: true, defaultExplanationLevel: 'beginner', theme: 'light' });
writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
app = await launchApp({ exe, userData, args: ['--force-device-scale-factor=2'], timeout: 90000 });
const companion = await app.windowWith('companion.html', 60000);
if (!companion) throw new Error('the companion did not open on the second launch');
await companion.waitForLoadState('domcontentloaded');
const status = await companion.evaluate(() => window.unvibe.consentStatus());
if (status.allowed) throw new Error('a fresh profile already holds the send agreement');
if (!dry) {
  const answer = await companion.evaluate((provider) => window.unvibe.consentAgree({ aiSend: true, terms: true, age18: true, provider }), status.provider);
  if (answer?.ok !== true) throw new Error(`consentAgree: ${answer?.error ?? 'no answer'}`);
}
const kept = JSON.parse(readFileSync(settingsFile, 'utf8'));
if (kept.onboarded !== true || kept.defaultExplanationLevel !== 'beginner' || kept.theme !== 'light') throw new Error('the app did not keep onboarded / Beginner / light');
if (kept.shortcut !== 'Control+U') throw new Error(`the shortcut is ${kept.shortcut}, not Control+U`);
const agreed = (await companion.evaluate(() => window.unvibe.consentStatus())).allowed;
if (agreed !== !dry) throw new Error(`send agreement ${agreed ? 'given' : 'not given'} in a ${mode} run`);
log(true, `Unvibe ${result.version} set up: onboarded, Beginner, light, launch-at-login asked, shortcut Control+U, send agreement ${dry ? 'NOT given (dry: Control+U can only open the agreement form)' : `given (provider ${status.provider})`}`);
const panelPage = () => app.windows().find((w) => w.url().includes('widget.html') && !w.isClosed()) ?? null;

// --- TextEdit: the file holds only the 7 lines; Command+A, then the copy check ------------------------------------
const dir = mkdtempSync(path.join(tmpdir(), 's13-'));
const file = path.join(dir, 'messages.js');
writeFileSync(file, selection);
execFileSync('open', ['-a', 'TextEdit', file]);
await sleep(3000);
// Only `activate` and System Events, as real-device.mjs and the S8 take do (an Apple Event that scripts TextEdit
// itself timed out on the runner, dry run 43206019385).
osa('tell application "TextEdit" to activate', 'delay 1', 'tell application "System Events" to keystroke "a" using command down');
await sleep(800);
// The copy the way 0.1.52's own capture makes it (selection.ts): key code 8 (physical C) with Command, then the
// pasteboard polled, here for up to 3 s. Dry run 44251372380 read an empty pasteboard 600 ms after one character
// keystroke "c", with TextEdit in front and the 7 lines highlighted, so the check now makes up to 3 copies, says
// what each one found, and selects all again before a retry. Copies send nothing; Control+U is still pressed once.
const judge = (text) => {
  const exact = sha(Buffer.from(text, 'utf8')) === SELECTION_SHA;
  const newline = !exact && text.endsWith('\n') && sha(Buffer.from(text.slice(0, -1), 'utf8')) === SELECTION_SHA;
  return { ok: exact || newline, how: exact ? 'exact' : newline ? 'the 7 lines + one trailing newline' : `${text.length} chars, sha ${sha(Buffer.from(text, 'utf8')).slice(0, 12)}` };
};
let copy = { ok: false, how: 'no copy made' };
for (let attempt = 1; attempt <= 3 && !copy.ok; attempt++) {
  if (attempt > 1) {
    osa('tell application "TextEdit" to activate', 'delay 0.5', 'tell application "System Events" to keystroke "a" using command down');
    await sleep(800);
  }
  execFileSync('pbcopy', { input: '' });
  await sleep(150);
  osa('tell application "System Events" to key code 8 using {command down}');
  let copied = '';
  for (let i = 0; i < 15 && !copied; i++) {
    await sleep(200);
    copied = execFileSync('pbpaste', { encoding: 'utf8' });
  }
  copy = judge(copied);
  if (!copy.ok) {
    let info = '';
    try { info = osa('clipboard info'); } catch (e) { info = `clipboard info failed: ${String(e.message).split('\n')[0]}`; }
    log(null, `TextEdit copy ${attempt} of 3 found ${copy.how}`, `front: ${frontmost()}; pasteboard: ${info || 'empty'}`);
  }
}
result.selection = copy.how;
log(copy.ok, 'TextEdit: the selection is exactly lines 8-14', copy.how);
if (!copy.ok) { try { grab('s13-not-selected'); } catch {} await app.close(); finish(1); }
const front = frontmost();
if (front !== 'TextEdit') { log(false, 'TextEdit is in front before Control+U', `front: ${front}`); await app.close(); finish(1); }
grab('s13-textedit-selected');

// --- Control+U ----------------------------------------------------------------------------------------------------
if (dry) {
  keystroke('u', 'control down');
  log(null, 'dry run: Control+U pressed with no send agreement on file');
  try {
    let page = null;
    for (let i = 0; i < 80 && !page; i++) { page = panelPage(); if (!page) await sleep(250); }
    if (!page) throw new Error('the panel did not open');
    const consent = page.locator('.consent-form');
    await consent.waitFor({ state: 'visible', timeout: 30000 });
    const boxes = consent.locator('input[type="checkbox"]');
    if ((await boxes.count()) !== 3) throw new Error(`the agreement has ${await boxes.count()} boxes, not 3`);
    for (let i = 0; i < 3; i++) if (await boxes.nth(i).isChecked()) throw new Error('an agreement box started ticked');
    await sleep(3000);
    const s = await panelState(page);
    if (s.answer || s.phase === 'streaming' || s.phase === 'done') throw new Error(`the panel is ${s.phase} with an answer: something was sent`);
    log(true, 'dry run: the shortcut opened the panel on its send agreement (3 unticked boxes); nothing streamed in 3 s', `panel ${s.size.join('x')} CSS px, phase ${s.phase}`);
    log((await wake(page)) === '1', 'dry run: the panel is fully opaque for its still');
    for (const scale of [2, 3]) {
      const f = path.join(shots, `s13-dry-panel@${scale}x.png`);
      const [w, h] = await shot(page, f, { scale });
      log(w === scale * s.size[0] && h === scale * s.size[1], `dry run: panel still at ${scale}x`, `${w}x${h}`);
    }
    grab('s13-dry-with-panel');
    await page.evaluate(() => window.unvibe.closeWidget()).catch(() => {});
  } catch (e) {
    log(false, 'dry run: the agreement form', String(e.message).split('\n')[0]);
    try { grab('s13-dry-error'); } catch {}
  }
  await app.close();
  finish();
}

// The take: one Control+U, no retry (BOSS: one attempt; if it fails, report and stop).
keystroke('u', 'control down');
result.sentAt = new Date().toISOString();
try {
  const { page, state } = await finishedPanel(panelPage, { depth: 'beginner', marker: '/api/messages', timeout: 120000 });
  const received = state.code.replace(/\n$/, '');
  Object.assign(result, { depth: state.depth, head: state.head, received: state.code, receivedSha: sha(Buffer.from(received, 'utf8')), answer: state.answer, unsure: state.unsure, notes: state.notes });
  log(result.receivedSha === SELECTION_SHA, 'the panel received exactly lines 8-14', `sha ${result.receivedSha.slice(0, 12)}`);
  const shotResult = await captureStills(page, { dir: shots, prefix: 's13', scales: [2, 3], expectCode: received === state.code ? selection : `${selection}\n` });
  for (const c of shotResult.checks) log(c.ok, c.what, c.why);
  result.stills = shotResult.stills;
  result.answer = shotResult.state.answer;
  grab('s13-with-panel');
} catch (e) {
  log(false, 'the take stopped', String(e.message).split('\n')[0]);
  try { grab('s13-error'); } catch {}
  const s = panelPage() ? await panelState(panelPage()).catch(() => null) : null;
  if (s) result.panelAtStop = s;
}
await app.close();
finish();
