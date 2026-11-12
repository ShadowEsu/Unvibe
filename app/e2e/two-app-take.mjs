// S8 "Same line. Any app." (Studio's concept; Marketing's take ask requests/unvibe-helper/20261112-0242; BOSS GO, cap
// $0.10): the same 16 lines selected in TextEdit and in Terminal on the released app, Control+U in each, at Beginner.
//
// Exactly 2 hosted calls, one per app. The profile is set up the way a returning person's is, without the onboarding's
// sample: a first launch (it explains nothing) writes the app's own settings; onboarded, own code explained and Beginner
// are merged into them, and the store says the launch-at-login question was asked (its native dialog would land
// between the takes). The send agreement is given through the app's own IPC (consentAgree, as consent-fixture.mjs).
//
// Before each Control+U the selection is checked by copying it (Command+C, pbpaste): it must be exactly the sample
// (sha256 aabf7d5e…; one trailing newline allowed and recorded). A wrong selection stops that app's take before its
// Control+U, so it costs no call. TextEdit: the file holds only the sample, Command+A. Terminal (Security's conditions,
// 12 Nov): prompt '$ ', scrollback cleared, a custom title, 100 columns; `cat retry.ts`; each row's text is found by a
// triple-click + copy, then a real drag selects the 16 rows.
//
// Per app, in MEDIA_DIR/shots: s8-<app>-selected.png (the desktop with the app's own highlight, screencapture at the
// runner's 1x), s8-<app>-panel.png (the panel at 840x1440 once the answer is finished, scrolled to the top),
// s8-<app>-with-panel.png (the desktop with the panel). takes.json: each app's version, the copied selection's sha, the
// code the panel received and the answer text, word for word.
//
// TWO_APP=dry: the selections, checks and desktop grabs only. Unvibe isn't started, so nothing is sent.
// Env: UNVIBE_EXE, MEDIA_DIR, MEDIA_INSTALL_ID (qa-, flagged by the workflow), MOUSE (mouse.swift, built), TWO_APP.
import { launchApp } from './cdp-launch.mjs';
import { resize, shot } from './media-window.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

if (process.platform !== 'darwin') throw new Error('two-app-take.mjs runs on macOS (TextEdit, Terminal, Control+U)');
const dry = process.env.TWO_APP === 'dry';
if (!dry && process.env.TWO_APP !== 'take') throw new Error('TWO_APP must be dry or take');
const exe = process.env.UNVIBE_EXE;
const mouse = process.env.MOUSE;
if (!dry && !exe) throw new Error('Set UNVIBE_EXE to an installed release build');
if (!mouse || !existsSync(mouse)) throw new Error('Set MOUSE to the built mouse.swift helper');
const out = path.resolve(process.env.MEDIA_DIR ?? 'media');
const shots = path.join(out, 'shots');
mkdirSync(shots, { recursive: true });

const SHA = 'aabf7d5e2bddb457aab0ca6c42fa29d18a80d73b9d47fd960148306b43675e0c';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sample = readFileSync(new URL('./media-samples/two-app/retry.ts', import.meta.url));
if (sha(sample) !== SHA) throw new Error(`the sample hashes to ${sha(sample).slice(0, 16)}, not ${SHA.slice(0, 16)}`);
const lines = sample.toString('utf8').split('\n');

const report = [];
const log = (ok, what, why = '') => {
  const line = `${ok === null ? 'NOTE' : ok ? 'PASS' : 'FAIL'}  ${what}${why ? ` (${why})` : ''}`;
  report.push(line);
  console.log(line);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const osa = (...script) => execFileSync('osascript', script.flatMap((l) => ['-e', l]), { encoding: 'utf8', timeout: 30000 }).trim();
const keystroke = (key, mods) => osa(`tell application "System Events" to keystroke "${key}" using {${mods}}`);
const frontmost = () => osa('tell application "System Events" to get name of first process whose frontmost is true');
const grab = (name) => execFileSync('screencapture', ['-x', path.join(shots, `${name}.png`)]);
const clipboard = () => execFileSync('pbpaste', { encoding: 'utf8' });
const clearClipboard = () => execFileSync('pbcopy', { input: '' });
const pointer = (...args) => execFileSync(mouse, args.map(String), { encoding: 'utf8' }).trim();
const appVersion = (bundle) => execFileSync('defaults', ['read', `${bundle}/Contents/Info`, 'CFBundleShortVersionString'], { encoding: 'utf8' }).trim();

/** Copies the front app's selection the way Unvibe will (Command+C) and says whether it is exactly the sample. */
async function copiedSelection() {
  clearClipboard();
  keystroke('c', 'command down');
  await sleep(600);
  const text = clipboard();
  const exact = sha(Buffer.from(text, 'utf8')) === SHA;
  const newline = !exact && text.endsWith('\n') && sha(Buffer.from(text.slice(0, -1), 'utf8')) === SHA;
  return { text, ok: exact || newline, how: exact ? 'exact' : newline ? 'the sample + one trailing newline' : `${text.length} chars, sha ${sha(Buffer.from(text, 'utf8')).slice(0, 12)}` };
}

const dir = mkdtempSync(path.join(tmpdir(), 's8-'));
const file = path.join(dir, 'retry.ts');
writeFileSync(file, sample);

// --- The app, set up as a returning person's (take only) -------------------------------------------------------
let app = null;
let version = 'not started (dry)';
if (!dry) {
  const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-s8-'));
  const installId = process.env.MEDIA_INSTALL_ID ?? `qa-s8-local-${Date.now()}`;
  writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId, loginPromptAsked: true }));
  console.log(`install id ${installId}`);
  app = await launchApp({ exe, userData, timeout: 90000 });
  const first = await app.windowWith('companion.html', 60000);
  if (!first) throw new Error('the companion did not open on the first launch');
  await first.waitForLoadState('domcontentloaded');
  version = (await first.evaluate(() => window.unvibe.appInfo())).version;
  await sleep(3000);
  await app.close();
  const settingsFile = path.join(userData, 'unvibe-settings.json');
  if (!existsSync(settingsFile)) throw new Error('the first launch wrote no settings');
  const settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
  Object.assign(settings, { onboarded: true, ownCodeExplained: true, defaultExplanationLevel: 'beginner' });
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  app = await launchApp({ exe, userData, args: ['--force-device-scale-factor=2'], timeout: 90000 });
  const companion = await app.windowWith('companion.html', 60000);
  if (!companion) throw new Error('the companion did not open on the second launch');
  await companion.waitForLoadState('domcontentloaded');
  const status = await companion.evaluate(() => window.unvibe.consentStatus());
  if (!status.allowed) {
    const answer = await companion.evaluate((provider) => window.unvibe.consentAgree({ aiSend: true, terms: true, age18: true, provider }), status.provider);
    if (answer?.ok !== true) throw new Error(`consentAgree: ${answer?.error ?? 'no answer'}`);
  }
  const kept = JSON.parse(readFileSync(settingsFile, 'utf8'));
  if (kept.onboarded !== true || kept.defaultExplanationLevel !== 'beginner') throw new Error('the app did not keep onboarded / Beginner');
  if (kept.shortcut !== 'Control+U') throw new Error(`the shortcut is ${kept.shortcut}, not Control+U`);
  log(true, `Unvibe ${version} set up: onboarded, Beginner, launch-at-login asked, send agreement given (provider ${status.provider}), shortcut Control+U`);
  const consent = JSON.parse(readFileSync(path.join(userData, 'unvibe-consent.json'), 'utf8'));
  console.log(`consent record keys: ${Object.keys(consent).join(', ')}`);
}

// --- The panel ---------------------------------------------------------------------------------------------------
const panelState = (page) => page.evaluate(() => {
  const body = document.querySelector('.body');
  const answer = body ? body.cloneNode(true) : null;
  answer?.querySelector('.code-context')?.remove();
  return {
    finished: !!document.querySelector('.card--done .local-save-note') && !document.querySelector('.body .cursor'),
    failed: /Couldn't explain that/.test(document.body.innerText),
    depth: (document.querySelector('.lvl.on')?.textContent ?? '').trim().toLowerCase(),
    code: document.querySelector('.code-context pre')?.innerText ?? '',
    answer: (answer?.innerText ?? '').trim(),
  };
});
/** The panel with a finished Beginner answer to the sample, read the same twice 1 s apart, and not `before`'s answer. */
async function finishedPanel(before) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < 120000) {
    const page = app.windows().find((w) => w.url().includes('widget.html') && !w.isClosed());
    const s = page ? await panelState(page).catch(() => null) : null;
    if (s?.failed) throw new Error(`the explanation failed: ${s.answer.slice(0, 160)}`);
    const ok = s && s.finished && s.depth === 'beginner' && s.code.includes('withRetry') && s.answer && s.answer !== before;
    if (ok && last && last.answer === s.answer) return { page, ...s };
    last = ok ? s : null;
    await sleep(1000);
  }
  throw new Error('no finished Beginner answer to the sample within 120 s');
}

const takes = [];
let before = '';
async function take(name, owner, bundle, select) {
  const entry = { app: owner, appVersion: appVersion(bundle) };
  takes.push(entry);
  try {
    const sel = await select();
    entry.selection = sel.how;
    log(sel.ok, `${owner}: the selection is exactly the sample`, sel.how);
    if (!sel.ok) {
      try { grab(`s8-${name}-not-selected`); } catch {}
      return;
    }
    if (frontmost() !== owner) { log(false, `${owner} is in front before the grab`, `front: ${frontmost()}`); return; }
    grab(`s8-${name}-selected`);
    if (dry) { log(null, `${owner}: dry run, no Control+U`); return; }
    keystroke('u', 'control down');
    entry.sentAt = new Date().toISOString();
    const done = await finishedPanel(before);
    before = done.answer;
    await resize(done.page, 420, 720);
    await done.page.locator('.body').evaluate((el) => el.scrollTo({ top: 0 }));
    await sleep(600);
    const [w, h] = await shot(done.page, path.join(shots, `s8-${name}-panel.png`));
    grab(`s8-${name}-with-panel`);
    Object.assign(entry, { depth: done.depth, received: done.code, receivedSha: sha(Buffer.from(done.code.replace(/\n$/, ''), 'utf8')), answer: done.answer });
    log(entry.receivedSha === SHA, `${owner}: the panel received exactly the sample`, `sha ${entry.receivedSha.slice(0, 12)}`);
    log(w === 840 && h === 1440, `${owner}: panel still 840x1440`, `${w}x${h}`);
    // The next app's take opens a fresh panel, so this one can't cover the next window.
    await done.page.evaluate(() => window.unvibe.closeWidget()).catch(() => {});
    await sleep(1500);
  } catch (e) {
    // One app's failure is logged and the other app still gets its take (the report says what happened in both).
    entry.error = String(e.message).split('\n')[0];
    log(false, `${owner}: the take stopped`, entry.error);
    try { grab(`s8-${name}-error`); } catch {}
  }
}

// --- TextEdit: the file holds only the sample; Command+A --------------------------------------------------------
await take('textedit', 'TextEdit', '/System/Applications/TextEdit.app', async () => {
  execFileSync('open', ['-a', 'TextEdit', file]);
  await sleep(3000);
  // Only `activate` and System Events, as real-device.mjs does: an Apple Event that scripts TextEdit itself (set bounds)
  // timed out on the runner (dry run 43206019385). The window keeps the place TextEdit gives it.
  osa('tell application "TextEdit" to activate', 'delay 1', 'tell application "System Events" to keystroke "a" using command down');
  await sleep(800);
  return copiedSelection();
});

// --- Terminal: a neutral prompt, cleared scrollback, `cat retry.ts`, a real drag over the 16 rows ----------------
await take('terminal', 'Terminal', '/System/Applications/Utilities/Terminal.app', async () => {
  // Terminal is never scripted either (do script needs the same Apple Events): it opens this .command file itself.
  // The script sizes, places and titles its window with Terminal's own escape sequences, tells Terminal its working
  // directory (OSC 7: the title's directory part is then "auth", like the film's src/auth/retry.ts, not the login's
  // home folder, which dry run 43208580782 showed as "runner"), clears the screen and the scrollback (the line
  // Terminal typed to start it, and the login message), and becomes /bin/sh: an interactive POSIX shell reads only the
  // file $ENV names, and ENV and PROMPT_COMMAND are unset, so no rc file or inherited hook can set a prompt or a title
  // (a plain bash read /etc/bash.bashrc in the local smoke and titled the window user@host), and the title shows "sh"
  // without the arguments dry run 43208580782 showed. '$ ' prompt, no history file. `cat retry.ts` is then typed at
  // that prompt. Terminal's copy of the file ends with the newline the original retry.ts has after line 26, so the
  // next prompt starts on its own row, not after the closing }.
  const term = path.join(dir, 'auth');
  mkdirSync(term);
  writeFileSync(path.join(term, 'retry.ts'), Buffer.concat([sample, Buffer.from('\n')]));
  const command = path.join(dir, 's8.command');
  writeFileSync(command, [
    '#!/bin/bash',
    `cd '${term}'`,
    "printf '\\033[8;30;100t\\033[3;40;60t\\033]0;retry.ts\\007\\033]7;file://%s\\007' \"$PWD\"",
    "clear; printf '\\033[3J'",
    "unset ENV PROMPT_COMMAND; export HOME=\"$PWD\" PS1='$ ' HISTFILE=/dev/null",
    'exec /bin/sh',
    '',
  ].join('\n'), { mode: 0o755 });
  execFileSync('open', ['-a', 'Terminal', command]);
  await sleep(4000);
  if (frontmost() !== 'Terminal') {
    execFileSync('open', ['-a', 'Terminal']);
    await sleep(1000);
  }
  osa('tell application "System Events" to keystroke "cat retry.ts"', 'tell application "System Events" to key code 36');
  await sleep(2000);
  try {
    log(null, `Terminal window title: ${osa('tell application "System Events" to get name of front window of process "Terminal"')}`);
  } catch (e) {
    log(null, 'Terminal window title: not read', String(e.message).split('\n')[0]);
  }
  const frame = pointer('frame', 'Terminal');
  const [wx, wy, ww, wh] = frame.split(' ').map(Number);
  // Which row is where: triple-click (one whole row), copy, read. Every 5 points down from below the title bar (about
  // 28 points): a double-click on the title bar zooms the window (dry run 43208580782 lost its top rows that way).
  const rows = new Map();
  for (let y = wy + 32; y < wy + Math.min(wh, 440); y += 5) {
    clearClipboard();
    pointer('click', wx + 60, y, 3);
    await sleep(150);
    keystroke('c', 'command down');
    await sleep(250);
    const text = clipboard().replace(/\n$/, '');
    if (!rows.has(text)) rows.set(text, []);
    rows.get(text).push(y);
  }
  const after = pointer('frame', 'Terminal');
  if (after !== frame) return { ok: false, how: `the window moved or changed size during the row scan (${frame} → ${after})`, text: '' };
  const middle = (ys) => ys[Math.floor(ys.length / 2)];
  const cat = rows.get('$ cat retry.ts');
  const firstYs = rows.get(lines[0]);
  const lastYs = rows.get(lines[lines.length - 1]);
  const order = [...rows.keys()];
  const above = cat ? order.slice(0, order.indexOf('$ cat retry.ts')) : order.slice(0, 3);
  log(null, `Terminal rows found: '$ cat retry.ts' ${cat ? `at y ${middle(cat)}` : 'NOT seen'}; first sample line ${firstYs ? `at y ${middle(firstYs)}` : 'NOT seen'}; last ${lastYs ? `at y ${middle(lastYs)}` : 'NOT seen'}; window ${wx},${wy} ${ww}x${wh}; ${rows.size} distinct rows`);
  log(null, `Terminal rows above '$ cat retry.ts': ${above.length ? above.map((t) => JSON.stringify(t)).join(', ') : 'none'}`);
  if (!firstYs || !lastYs) return { ok: false, how: 'the sample rows were not found', text: '' };
  // A drag from the left edge of the first row to past the end of the last row selects exactly those 16 rows.
  let sel = { ok: false, how: 'not tried' };
  for (const x0 of [wx + 6, wx + 3, wx + 9]) {
    pointer('drag', x0, middle(firstYs), wx + ww - 24, middle(lastYs));
    await sleep(300);
    sel = await copiedSelection();
    if (sel.ok) break;
  }
  return sel;
});

if (app) await app.close();
writeFileSync(path.join(out, 'takes.json'), JSON.stringify({ version, dry, sample: { file: 'media-samples/two-app/retry.ts', sha256: SHA }, takes }, null, 2));
writeFileSync(path.join(out, 'report.txt'), `${report.join('\n')}\n`);
process.exit(report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
