// Records the real app for the website: screenshots of each screen and raw window videos of one
// genuine session (first explanation, depth switch, follow-up, Test me, companion pages).
// Everything shown is produced live by the installed app and the hosted AI; nothing is mocked.
// A release build is needed (it carries the trial token); a plain local build cannot explain.
// The app is driven through Chromium's debug port (cdp-launch.mjs): release builds turn off the
// Node inspector that Playwright's Electron launch needs.
//
// Run from a folder where `playwright` is installed (CI does this in real-device-test.yml):
//   UNVIBE_EXE=/Applications/Unvibe.app/Contents/MacOS/Unvibe MEDIA_DIR=/tmp/uv-media node marketing-media.mjs
// Env: UNVIBE_EXE (installed app executable), MEDIA_DIR (output folder), MEDIA_INSTALL_ID (qa-prefixed;
//      CI gives every run a fresh id and flags it as QA; an id reused across runs runs out of free
//      explanations), FFMPEG (optional ffmpeg path; default: ffmpeg on PATH, else Playwright's),
//      E2E_LOCAL=1 (a run on someone's own Mac: no keystrokes into the native file dialog).
import { launchApp } from './cdp-launch.mjs';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
if (!exe) throw new Error('Set UNVIBE_EXE to an installed release build');
const out = path.resolve(process.env.MEDIA_DIR ?? 'media');
const shots = path.join(out, 'shots');
const raw = path.join(out, 'raw');
mkdirSync(shots, { recursive: true });
mkdirSync(raw, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const marks = [];
const failures = [];
const mark = (label) => { marks.push({ label, s: (Date.now() - t0) / 1000 }); console.log(`${marks.at(-1).s.toFixed(1)}s ${label}`); };

const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-media-'));
const installId = process.env.MEDIA_INSTALL_ID ?? `qa-media-local-${Date.now()}`;
writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId }));
console.log(`install id ${installId}`);

// Retina-sharp screenshots on runners whose display is 1x.
const app = await launchApp({ exe, userData, args: ['--force-device-scale-factor=2'], timeout: 90000 });

// Window videos: Chromium's screencast of each app window, encoded to WebM at 25 fps and 1280x800
// (the size Playwright's own recorder used), each frame held until the next one arrives.
const ffmpeg = process.env.FFMPEG || [
  () => { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; },
  () => {
    const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
    const dir = readdirSync(cache).filter((d) => d.startsWith('ffmpeg')).sort().pop();
    const bin = dir && path.join(cache, dir, process.platform === 'darwin' ? 'ffmpeg-mac' : 'ffmpeg-linux');
    if (!bin || !existsSync(bin)) throw new Error('no Playwright ffmpeg');
    return bin;
  },
].reduce((found, find) => found ?? (() => { try { return find(); } catch { return null; } })(), null);
if (!ffmpeg) console.log('NOTE no ffmpeg found (run `npx playwright install ffmpeg`): screenshots only, no window videos');
const videos = [];
async function record(page) {
  if (!ffmpeg) return;
  const opened = (Date.now() - t0) / 1000;
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  if (page.isClosed() || page.url().startsWith('devtools:')) return;
  const window = page.url().split('/').pop()?.split('?')[0];
  const file = path.join(raw, `${String(videos.length + 1).padStart(2, '0')}-${window}.webm`);
  const encoder = spawn(ffmpeg, ['-loglevel', 'error', '-f', 'image2pipe', '-avioflags', 'direct', '-fpsprobesize', '0', '-probesize', '32',
    '-analyzeduration', '0', '-c:v', 'mjpeg', '-i', 'pipe:0', '-y', '-an', '-r', '25', '-c:v', 'vp8', '-qmin', '0', '-qmax', '50',
    '-crf', '8', '-deadline', 'realtime', '-speed', '8', '-b:v', '1M', '-threads', '1',
    '-vf', 'scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2:white', file], { stdio: ['pipe', 'ignore', 'inherit'] });
  const done = new Promise((resolve) => { encoder.on('close', resolve); encoder.on('error', resolve); });
  encoder.stdin.on('error', () => {}); // an encoder that stopped early must not crash the capture
  let last = null;
  const tick = setInterval(() => { if (last && encoder.stdin.writable) encoder.stdin.write(last); }, 40);
  const entry = {
    window, opened, closed: null, path: file, done,
    /** Ends the recording (window closed, or the run is over). */
    stop() {
      if (entry.closed !== null) return;
      clearInterval(tick);
      entry.closed = (Date.now() - t0) / 1000;
      encoder.stdin.end();
    },
  };
  videos.push(entry);
  page.once('close', entry.stop);
  try {
    const cdp = await page.context().newCDPSession(page);
    cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
      last = Buffer.from(data, 'base64');
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90 });
  } catch (e) {
    if (!page.isClosed()) console.log(`NOTE no recording of ${window}: ${e.message.split('\n')[0]}`);
    entry.stop();
  }
}
app.onWindow((page) => { void record(page); });

/**
 * Window size (and optionally centre) without the main process: Electron applies a page's
 * window.resizeTo/moveTo to its BrowserWindow ('content-bounds-updated'; the app doesn't block it).
 * CDP's Browser.setWindowBounds is not available in Electron.
 */
async function resize(page, width, height, { center = false } = {}) {
  await page.evaluate(([w, h, c]) => {
    window.resizeTo(w, h);
    if (c) window.moveTo(Math.round(screen.availLeft + (screen.availWidth - w) / 2), Math.round(screen.availTop + (screen.availHeight - h) / 2));
  }, [width, height, center]);
  await sleep(400);
  const size = await page.evaluate(() => [window.outerWidth, window.outerHeight]);
  if (Math.abs(size[0] - width) > 2 || Math.abs(size[1] - height) > 2) throw new Error(`window is ${size.join('x')}, wanted ${width}x${height}`);
}

/**
 * Answers the app's native "Choose a file to explain" dialog with `file` (macOS): waits for the
 * dialog, brings Unvibe forward, and types Go to Folder + path + Open only while Unvibe is the
 * frontmost app, so no keystroke can land in another app.
 */
function answerOpenPanel(file) {
  // Async: the pickFile call that opens the dialog has to reach the app while this waits for it.
  return new Promise((resolve, reject) => execFile('osascript', ['-e', `tell application "System Events"
  set p to first process whose unix id is ${app.process.pid}
  repeat 40 times
    if exists (first window of p whose name is "Choose a file to explain") then exit repeat
    delay 0.25
  end repeat
  if not (exists (first window of p whose name is "Choose a file to explain")) then error "the file dialog did not open"
  set frontmost of p to true
  delay 0.5
  if unix id of (first process whose frontmost is true) is not ${app.process.pid} then error "Unvibe is not in front"
  keystroke "g" using {command down, shift down}
  delay 0.8
  keystroke ${JSON.stringify(file)}
  delay 0.5
  key code 36
  delay 1
  if unix id of (first process whose frontmost is true) is not ${app.process.pid} then error "Unvibe lost focus"
  key code 36
end tell`], { encoding: 'utf8', timeout: 30000 }, (error) => (error ? reject(error) : resolve())));
}
const version = (await (await app.windowWith('companion.html', 60000)).evaluate(() => window.unvibe.appInfo())).version;

async function windowWith(part, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hit = app.windows().find((w) => w.url().includes(part) && !w.isClosed());
    if (hit) return hit;
    await sleep(250);
  }
  throw new Error(`${part} did not open`);
}
const shot = (page, label) => page.screenshot({ path: path.join(shots, `${label}.png`), animations: 'disabled' });
const button = (page, name) => page.getByRole('button', { name, exact: true }).first();

async function step(label, fn) {
  try { await fn(); mark(label); return true; }
  catch (e) {
    failures.push(`${label}: ${e.message.split('\n')[0]}`);
    console.log(`FAIL ${label}: ${e.message.split('\n')[0]}`);
    return false;
  }
}

/** The panel can be recreated between requests, so look it up each time. */
async function settledPanel() {
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const panel = await windowWith('widget.html', 20000);
    try {
      const failed = panel.getByText("Couldn't explain that");
      if (await failed.count()) throw new Error(`explanation failed: ${await panel.locator('.state').first().innerText()}`);
      await panel.locator('.card--done .local-save-note').waitFor({ timeout: 3000 });
      await panel.locator('.body .cursor').waitFor({ state: 'detached', timeout: 30000 });
      await sleep(700);
      return panel;
    } catch (e) {
      if (/explanation failed/.test(e.message)) throw e;
      if (!panel.isClosed()) await sleep(500);
    }
  }
  throw new Error('explanation did not finish in 120s');
}

/**
 * 0.1.46+ asks for the send agreement before the first question or own code goes out (the built-in
 * sample alone is exempt). Ticks its three boxes and continues, as a new user would. True if asked.
 */
async function agreeIfAsked(page, wait = 5000) {
  const form = page.locator('.consent-form');
  try { await form.waitFor({ timeout: wait }); } catch { return false; }
  await sleep(800);
  await shot(page, 'send-agreement');
  const boxes = form.locator('input[type="checkbox"]');
  for (let i = 0; i < await boxes.count(); i++) { await boxes.nth(i).check(); await sleep(250); }
  await form.getByRole('button', { name: 'Continue', exact: true }).click();
  await form.waitFor({ state: 'detached', timeout: 10000 });
  mark('send agreement');
  return true;
}

const companion = await windowWith('companion.html', 60000);
await companion.waitForLoadState('domcontentloaded');
await resize(companion, 1280, 800, { center: true });
mark(`app open ${version}`);

// --- First run: the real onboarding and the first explanation ---------------------------------
// A Mac's setup has 4 steps (paste your own code, then the shortcut offer); Windows has 3.
const steps = process.platform === 'win32' ? 3 : 4;
const firstRun = await step('onboarding', async () => {
  await companion.locator('.ob2__count').filter({ hasText: `1 / ${steps}` }).waitFor({ timeout: 20000 });
  await sleep(800);
  await shot(companion, 'onboarding-hello');
  // A neutral name: the greeting and sidebar show it in every published frame and screenshot.
  await companion.getByPlaceholder('Your name').pressSequentially('Sam', { delay: 70 });
  await button(companion, "Let's go").click();
  await companion.locator('.ob2__count').filter({ hasText: `2 / ${steps}` }).waitFor();
  await sleep(1200);
  await shot(companion, 'onboarding-try-it');
  await button(companion, 'Explain this code').click();
});

const explained = firstRun && await step('first explanation', async () => {
  const panel = await windowWith('widget.html', 20000);
  await resize(panel, 560, 720);
  await panel.locator('.body .cursor').waitFor({ timeout: 60000 }).catch(() => {});
  await sleep(2500);
  await shot(panel, 'panel-streaming');
  const done = await settledPanel();
  await shot(done, 'panel-explained');
  // The panel follows the stream to the end; the site also needs the opening of the answer.
  await done.locator('.body').evaluate((el) => el.scrollTo({ top: 0 }));
  await sleep(600);
  await shot(done, 'panel-explained-top');
});

if (explained) {
  await step('beginner depth', async () => {
    await (await windowWith('widget.html')).locator('.lvl[data-level="beginner"]').click();
    await sleep(1500);
    await shot(await settledPanel(), 'panel-beginner');
  });
  await step('follow-up', async () => {
    const question = 'What happens if I call it five times quickly?';
    const ask = (await windowWith('widget.html')).getByLabel('Follow-up question');
    await ask.click();
    await ask.pressSequentially(question, { delay: 45 });
    await ask.press('Enter');
    // A question is the person's own text, so the agreement is asked here; then ask again.
    if (await agreeIfAsked(await windowWith('widget.html'))) {
      const again = (await windowWith('widget.html')).getByLabel('Follow-up question');
      await again.click();
      if (!(await again.inputValue()).trim()) await again.pressSequentially(question, { delay: 45 });
      await again.press('Enter');
    }
    await sleep(1500);
    await shot(await settledPanel(), 'panel-follow-up');
  });
  await step('test me', async () => {
    const panel = await windowWith('widget.html');
    await panel.locator('.tool--quiz').first().click();
    await panel.locator('.quiz__q').waitFor({ timeout: 60000 });
    await sleep(1200);
    await shot(panel, 'panel-test-me');
    await panel.locator('.quiz__opts .opt').first().click();
    await sleep(600);
    await button(panel, 'Check').click();
    await panel.locator('.verdict').waitFor({ timeout: 60000 });
    await sleep(1500);
    await shot(panel, 'panel-test-checked');
  });
  // "Why does this exist?" reads git history, so it needs a file inside a repo. The repo is made
  // here with a neutral author, because the answer shows who last changed the lines.
  if (process.env.E2E_LOCAL === '1') console.log('NOTE why exists: skipped (E2E_LOCAL: no keystrokes into a native dialog on someone\'s own Mac)');
  else await step('why exists', async () => {
    // The real path: on macOS tmpdir() is under /var, a link to /private/var, and git reports the
    // repo root through the link, so a /var file path would sit "outside" its own repo.
    const repo = realpathSync(mkdtempSync(path.join(tmpdir(), 'unvibe-why-')));
    const git = (...args) => execFileSync('git', args, {
      cwd: repo,
      env: { ...process.env, GIT_AUTHOR_NAME: 'Sam', GIT_AUTHOR_EMAIL: 'sam@example.com', GIT_COMMITTER_NAME: 'Sam', GIT_COMMITTER_EMAIL: 'sam@example.com' },
    });
    const file = path.join(repo, 'upload.js');
    git('init', '-q');
    writeFileSync(file, [
      'export async function upload(file, send) {',
      '  for (let attempt = 1; ; attempt++) {',
      '    try {',
      '      return await send(file);',
      '    } catch (error) {',
      '      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n'));
    git('add', '.');
    git('commit', '-q', '-m', 'Retry uploads with backoff so a dropped connection does not lose the file');
    writeFileSync(file, [
      '// The storage API rate-limits after five quick failures, so stop there.',
      'const MAX_ATTEMPTS = 5;',
      '',
      'export async function upload(file, send) {',
      '  for (let attempt = 1; ; attempt++) {',
      '    try {',
      '      return await send(file);',
      '    } catch (error) {',
      '      if (attempt >= MAX_ATTEMPTS) throw error;',
      '      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n'));
    git('commit', '-q', '-am', 'Stop after 5 attempts: the storage API rate-limits after that');
    // The file dialog is native (the main process can't be stubbed on a release build), so macOS
    // answers it: Go to Folder with the file's path, then Open, typed only while Unvibe is in front.
    const pickFrom = await windowWith('widget.html');
    const [picked] = await Promise.all([pickFrom.evaluate(() => window.unvibe.pickFile()), answerOpenPanel(file)]);
    if (!picked?.ok) throw new Error(`file pick failed: ${picked?.error ?? 'cancelled'}`);
    // Wait for the picked file's preview first, so the earlier finished card can't pass for this one.
    await (await windowWith('widget.html')).locator('.code-context').filter({ hasText: 'MAX_ATTEMPTS' }).first().waitFor({ timeout: 30000 });
    const panel = await settledPanel();
    await panel.locator('.tool--why').click();
    await panel.locator('.origin-panel').waitFor({ timeout: 20000 });
    await panel.locator('.origin-panel').scrollIntoViewIfNeeded();
    await sleep(800);
    await shot(panel, 'panel-why');
    // The answer must carry the real commit history, not the "no documented history" fallback.
    await panel.locator('.origin-panel').getByText('Reason documented').waitFor({ timeout: 5000 });
  });
}

// --- Finish onboarding and tour the companion ------------------------------------------------
await step('today', async () => {
  await companion.bringToFront();
  if (await companion.locator('.ob2__count').count()) {
    await button(companion, 'Next').click();
    await companion.locator('.ob2__count').filter({ hasText: `3 / ${steps}` }).waitFor();
    await sleep(1000);
    await shot(companion, 'onboarding-anywhere');
    // On a Mac step 3 is the paste target; nothing is pasted here, so Skip for now finishes setup.
    await button(companion, steps === 3 ? 'Start using Unvibe' : 'Skip for now').click();
  }
  await companion.locator('.topbar__title').filter({ hasText: 'Today' }).waitFor({ timeout: 15000 });
  await sleep(1800);
  await shot(companion, 'today');
});

for (const page of ['Library', 'Quiz', 'Briefs', 'Momentum', 'Ask Vibe']) {
  await step(page, async () => {
    await companion.locator('.side').getByRole('button', { name: page, exact: true }).click();
    await companion.locator('.topbar__title').filter({ hasText: page }).waitFor({ timeout: 10000 });
    await sleep(1800);
    await shot(companion, page.toLowerCase().replace(/\s+/g, '-'));
  });
}

// Ask Vibe answers a real question about what was just learned.
await step('ask vibe answer', async () => {
  const chat = companion.locator('#chatDraft');
  await chat.click();
  await chat.pressSequentially('Explain debounce again in one sentence, like I am new to this.', { delay: 40 });
  await chat.press('Enter');
  if (await agreeIfAsked(companion, 3000)) {
    if (!(await chat.inputValue()).trim()) await chat.pressSequentially('Explain debounce again in one sentence, like I am new to this.', { delay: 40 });
    await chat.press('Enter');
  }
  await companion.locator('.chat-thinking').waitFor({ timeout: 10000 }).catch(() => {});
  await companion.locator('.chat-thinking').waitFor({ state: 'detached', timeout: 90000 });
  const error = companion.locator('.form-error');
  if (await error.count()) throw new Error(`Ask Vibe failed: ${await error.innerText()}`);
  await companion.locator('.chat-assistant__body').last().waitFor({ timeout: 10000 });
  await sleep(2000);
  await shot(companion, 'ask-vibe-answer');
});

await step('settings privacy', async () => {
  await companion.locator('.side-settings').click();
  await companion.locator('.mside').getByRole('button', { name: 'Privacy & Data', exact: true }).click();
  await sleep(1200);
  await shot(companion, 'settings-privacy');
  await companion.keyboard.press('Escape');
});

await step('island', async () => {
  const bar = await windowWith('bar.html', 5000);
  await shot(bar, 'island');
});

for (const v of videos) v.stop();
await app.close();
// Every recording was ended above; wait for the encoders to write their files.
await Promise.race([Promise.all(videos.map((v) => v.done)), sleep(30000)]);
const files = videos.map((v) => ({ window: v.window, opened: v.opened, closed: v.closed, path: existsSync(v.path) ? v.path : null }));
writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ version, marks, videos: files, failures }, null, 2));
console.log(JSON.stringify({ version, failures, videos: files }, null, 2));
process.exit(failures.length ? 1 : 0);
