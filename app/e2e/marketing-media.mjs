// Records the real app for the website: screenshots of each screen and raw window videos of one
// genuine session (first explanation, depth switch, follow-up, Test me, companion pages), and on request
// marketing's own sample files (media-samples/).
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
//      E2E_LOCAL=1 (a run on someone's own Mac: no keystrokes into the native file dialog),
//      MEDIA_SAMPLES=1 (also explain each file in media-samples/samples.json; see that step).
import { launchApp } from './cdp-launch.mjs';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
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
// Briefs reads the project last chosen (settings lastProjectRoot). The folder dialog can't be answered reliably on
// GitHub's runner, so the run starts as if this sample project had been chosen before: a brief of its real change.
const briefRepo = uploadRepo().repo;
writeFileSync(path.join(userData, 'unvibe-settings.json'), JSON.stringify({ lastProjectRoot: briefRepo }));

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
 * CDP's Browser.setWindowBounds is not available in Electron. macOS keeps a window inside the screen,
 * so on a smaller display (GitHub's macOS runners: 1024x768) the page's viewport is emulated at the
 * size the wanted window would give it, and screenshots and the screencast render at that size.
 */
async function resize(page, width, height, { center = false } = {}) {
  await page.evaluate(([w, h, c]) => {
    window.resizeTo(w, h);
    if (c) window.moveTo(Math.round(screen.availLeft + Math.max(0, (screen.availWidth - w) / 2)), Math.round(screen.availTop + Math.max(0, (screen.availHeight - h) / 2)));
  }, [width, height, center]);
  await sleep(400);
  const m = await page.evaluate(() => ({ outer: [window.outerWidth, window.outerHeight], inner: [window.innerWidth, window.innerHeight], avail: [screen.availWidth, screen.availHeight] }));
  if (Math.abs(m.outer[0] - width) <= 2 && Math.abs(m.outer[1] - height) <= 2) return;
  if (m.avail[0] >= width && m.avail[1] >= height) throw new Error(`window is ${m.outer.join('x')}, wanted ${width}x${height}`);
  // The window frame (title bar); 0 for frameless windows, which can report inner > outer mid-resize.
  const viewport = { width: width - Math.max(0, m.outer[0] - m.inner[0]), height: height - Math.max(0, m.outer[1] - m.inner[1]) };
  await page.setViewportSize(viewport);
  await sleep(300);
  const inner = await page.evaluate(() => [window.innerWidth, window.innerHeight]);
  if (inner[0] !== viewport.width || inner[1] !== viewport.height) throw new Error(`viewport is ${inner.join('x')}, wanted ${viewport.width}x${viewport.height}`);
  console.log(`NOTE screen ${m.avail.join('x')} is smaller than a ${width}x${height} window: page viewport emulated at ${viewport.width}x${viewport.height}`);
}

/**
 * Answers the app's native open dialog with `file` (macOS): "Choose a file to explain" (a sheet on its parent
 * window) or a folder chooser (a window named Open). Waits for the dialog, brings Unvibe forward, and types Go to
 * Folder + path + Open only while Unvibe is the frontmost app, so no keystroke can land in another app.
 */
function answerOpenPanel(file) {
  // Async: the pickFile call that opens the dialog has to reach the app while this waits for it.
  return new Promise((resolve, reject) => execFile('osascript', ['-e', `tell application "System Events"
  set p to first process whose unix id is ${app.process.pid}
  set found to false
  repeat 40 times
    if exists (first window of p whose name is "Choose a file to explain") then set found to true
    repeat with w in (windows of p)
      if exists sheet 1 of w then set found to true
    end repeat
    if found then exit repeat
    delay 0.25
  end repeat
  if not found then error "the file dialog did not open"
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
end tell`], { encoding: 'utf8', timeout: 30000 }, (error, _out, stderr) => (error ? reject(new Error(`osascript: ${(stderr || '').trim() || error.message}`)) : resolve())));
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
/**
 * Stills at 2x (the site shows them at up to half their pixel width, ledger 530 spec §5). Chromium renders the
 * capture itself at the clip's scale, so the text is sharp, not an upscaled image; the scale makes the file twice
 * the page's CSS size whatever the window's own pixel ratio is (the app runs at 2x, but Playwright's viewport
 * emulation in resize() can report 1x).
 */
async function shot(page, label) {
  const [width, height, ratio] = await page.evaluate(() => [window.innerWidth, window.innerHeight, window.devicePixelRatio || 1]);
  const cdp = await page.context().newCDPSession(page);
  try {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 2 / ratio } });
    writeFileSync(path.join(shots, `${label}.png`), Buffer.from(data, 'base64'));
  } finally {
    await cdp.detach().catch(() => {});
  }
}
const button = (page, name) => page.getByRole('button', { name, exact: true }).first();
/**
 * Puts `text` in a field and waits until the field holds exactly it. No key events: typing over CDP
 * stalled at random on GitHub's macOS runner (31 Oct runs 41238370806 and 41239289051).
 */
async function enterText(field, text) {
  await field.fill(text);
  const start = Date.now();
  while ((await field.inputValue()) !== text) {
    if (Date.now() - start > 10000) throw new Error(`field holds "${await field.inputValue()}", wanted "${text}"`);
    await sleep(100);
  }
}

async function step(label, fn) {
  try { await fn(); mark(label); return true; }
  catch (e) {
    failures.push(`${label}: ${e.message.split('\n')[0]}`);
    console.log(`FAIL ${label}: ${e.message.split('\n')[0]}`);
    // Why an action waited: the end of Playwright's call log, and what each app window reports.
    for (const line of e.message.split('\n').filter((l) => /^\s+-\s/.test(l)).slice(-4)) console.log(`  ${line.trim()}`);
    for (const w of app.windows().filter((p) => !p.isClosed())) {
      const s = await w.evaluate(() => `${document.visibilityState}, focus ${document.hasFocus()}, ${window.innerWidth}x${window.innerHeight}`).catch((err) => err.message.split('\n')[0]);
      console.log(`  window ${w.url().split('/').pop()?.split('?')[0]}: ${s}`);
    }
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

/** Asks `question` in the panel's follow-up row and returns the panel once the answer has finished. */
async function askFollowUp(question) {
  const askRow = async () => (await windowWith('widget.html')).locator('.askrow');
  await enterText((await askRow()).getByLabel('Follow-up question'), question);
  await (await askRow()).getByRole('button', { name: 'Ask', exact: true }).click();
  // A question is the person's own text, so the agreement is asked here; then ask again.
  if (await agreeIfAsked(await windowWith('widget.html'))) {
    const again = (await askRow()).getByLabel('Follow-up question');
    if ((await again.inputValue()).trim() !== question) await enterText(again, question);
    await (await askRow()).getByRole('button', { name: 'Ask', exact: true }).click();
  }
  await sleep(1500);
  return settledPanel();
}

/**
 * The answer goes under the explanation (0.1.49 opens it with a "Short answer" heading; earlier builds used the
 * question as its heading, matched by `questionPart`): bring that start to the top of the panel, so the still shows
 * the answer, not the end.
 */
async function scrollToAnswer(panel, questionPart) {
  const found = await panel.locator('.body').evaluate((body, part) => {
    const blocks = [...body.querySelectorAll('h1, h2, h3, h4, strong, p')];
    const heading = blocks.find((el) => /^short answer$/i.test((el.textContent ?? '').trim())) ?? blocks.find((el) => (el.textContent ?? '').toLowerCase().includes(part));
    if (!heading) return false;
    body.scrollTo({ top: Math.max(0, heading.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 14) });
    return true;
  }, questionPart.toLowerCase());
  if (!found) throw new Error('the follow-up question is not in the panel');
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
  await enterText(companion.getByPlaceholder('Your name'), 'Sam');
  await button(companion, "Let's go").click();
  await companion.locator('.ob2__count').filter({ hasText: `2 / ${steps}` }).waitFor();
  await sleep(1200);
  await shot(companion, 'onboarding-try-it');
  await button(companion, 'Explain this code').click();
});

/**
 * The website quotes short passages of real answers word for word (ledger 530), so each one it may
 * quote is saved with the depth that produced it: the panel's own text, nothing rewritten.
 */
const snippets = [];
async function saveAnswer(panel, label) {
  const depth = (await panel.locator('.lvl.on').first().innerText().catch(() => '')).trim();
  const text = (await panel.locator('.body').first().innerText()).trim();
  snippets.push({ label, depth, text });
}

const explained = firstRun && await step('first explanation', async () => {
  const panel = await windowWith('widget.html', 20000);
  await resize(panel, 560, 720);
  await panel.locator('.body .cursor').waitFor({ timeout: 60000 }).catch(() => {});
  await sleep(2500);
  await shot(panel, 'panel-streaming');
  const done = await settledPanel();
  await shot(done, 'panel-explained');
  await saveAnswer(done, 'first explanation');
  // The panel follows the stream to the end; the site also needs the opening of the answer.
  await done.locator('.body').evaluate((el) => el.scrollTo({ top: 0 }));
  await sleep(600);
  await shot(done, 'panel-explained-top');
});

if (explained) {
  await step('beginner depth', async () => {
    await (await windowWith('widget.html')).locator('.lvl[data-level="beginner"]').click();
    await sleep(1500);
    const done = await settledPanel();
    await shot(done, 'panel-beginner');
    await saveAnswer(done, 'beginner depth');
  });
  // The deepest depth a free install can open (Expert needs Pro), for the site's side-by-side.
  await step('advanced depth', async () => {
    await (await windowWith('widget.html')).locator('.lvl[data-level="advanced"]').click();
    await sleep(1500);
    const done = await settledPanel();
    await done.locator('.body').evaluate((el) => el.scrollTo({ top: 0 }));
    await sleep(600);
    await shot(done, 'panel-advanced');
    await saveAnswer(done, 'advanced depth');
  });
  await step('follow-up', async () => {
    // A question with a prose answer: in 0.1.49 a markdown table in an answer shows as raw | rows (5 Nov run
    // 42132166462, "five times quickly" got a timeline table), which the site must not show as the app's look.
    const done = await askFollowUp('Why does it call clearTimeout before setTimeout?');
    await scrollToAnswer(done, 'clearTimeout before');
    if (/\|\s*-{3,}\s*\|/.test(await done.locator('.body').innerText())) console.log('NOTE follow-up: the answer holds a raw markdown table (shown as | rows)');
    await sleep(600);
    await shot(done, 'panel-follow-up');
    await saveAnswer(done, 'follow-up');
  });
  await step('test me', async () => {
    const panel = await windowWith('widget.html');
    await panel.locator('.tool--quiz').first().click();
    await panel.locator('.quiz__q').waitFor({ timeout: 60000 });
    await sleep(1200);
    await shot(panel, 'panel-test-me');
    const question = (await panel.locator('.quiz__q').first().innerText()).trim();
    const options = await panel.locator('.quiz__opts .opt').allInnerTexts();
    snippets.push({ label: 'test me', depth: '', text: [question, ...options.map((o) => o.trim())].join('\n') });
    await panel.locator('.quiz__opts .opt').first().click();
    await sleep(600);
    await button(panel, 'Check').click();
    await panel.locator('.verdict').waitFor({ timeout: 60000 });
    await sleep(1500);
    await shot(panel, 'panel-test-checked');
  });
  // More of the person's own code, entered through the panel's paste box (widget:usePaste, which
  // takes the text from the page, never the OS clipboard), so the Library holds several real
  // explanations. Neutral sample code only.
  const samples = [
    ['formatPrice', 'export function formatPrice(cents, currency = "USD") {\n  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);\n}'],
    ['chunk', 'export function chunk(items, size) {\n  const out = [];\n  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));\n  return out;\n}'],
    ['retry', 'export async function retry(task, times = 3) {\n  for (let attempt = 1; ; attempt++) {\n    try { return await task(); }\n    catch (error) { if (attempt >= times) throw error; }\n  }\n}'],
  ];
  for (const [name, code] of samples) {
    await step(`paste ${name}`, async () => {
      const panel = await windowWith('widget.html');
      await panel.evaluate(([text]) => window.unvibe.usePaste({ text, level: 'intermediate' }), [code]);
      await (await windowWith('widget.html')).locator('.code-context').filter({ hasText: name }).first().waitFor({ timeout: 30000 });
      await (await windowWith('widget.html')).locator('.body .cursor').waitFor({ timeout: 30000 }).catch(() => {});
      await settledPanel();
    });
  }
  // Marketing's sample files (media-samples/, each checked against its sha256 in samples.json), at Beginner in a
  // 420 px panel, the narrowest the panel allows, so the text is as large as it gets when a 9:16 reel crops the
  // still or the window video: each file's explanation, then the follow-up a viewer would type. Only on request
  // (MEDIA_SAMPLES=1, the workflow's media_samples input), because their explanations also show in the Library still.
  // An entry with "depths" (e.g. ["new", "advanced", "beginner"]) is pasted at the first depth and then switched with
  // the panel's own depth buttons, one still + answer per depth (sample-<name>-<depth>), and has no follow-up.
  if (process.env.MEDIA_SAMPLES === '1') {
    const dir = new URL('./media-samples/', import.meta.url);
    const list = JSON.parse(readFileSync(new URL('samples.json', dir), 'utf8'));
    // The panel at <level> with a new, finished answer. One evaluate reads all of it together (finished: the done card's
    // save note and no stream cursor; the active depth; the body text), because a depth click marks the button at once
    // but the panel only switches to streaming when main's status event lands; separate reads could catch the new depth
    // over the old card or an early stream. It must read the same twice 1 s apart, and differ from the answer before
    // it. After a paste it fails fast (budget 30 s past the first finish) instead of polling for minutes.
    const panelState = (page) => page.evaluate(() => ({
      finished: !!document.querySelector('.card--done .local-save-note') && !document.querySelector('.body .cursor'),
      failed: /Couldn't explain that/.test(document.body.innerText),
      depth: (document.querySelector('.lvl.on')?.textContent ?? '').trim().toLowerCase(),
      text: (document.querySelector('.body')?.innerText ?? '').trim(),
    }));
    const atDepth = async (level, before, budget) => {
      const start = Date.now();
      let last = null;
      while (Date.now() - start < budget) {
        const page = await windowWith('widget.html');
        const s = await panelState(page).catch(() => null);
        if (s?.failed) throw new Error(`the ${level} explanation failed`);
        const ok = s && s.finished && s.depth === level && s.text && s.text !== before;
        if (ok && last && last.text === s.text && last.depth === s.depth) return { done: page, text: s.text };
        last = ok ? s : null;
        await sleep(1000);
      }
      throw new Error(`no fresh, finished ${level} answer within ${budget / 1000} s (the panel still shows the answer before it, another depth, or a stream)`);
    };
    // Two samples in a row that fail at the paste mean the paste itself is broken: stop there rather than spend the
    // job's time on the rest (each failed paste costs up to 90 s).
    let failedPastes = 0;
    for (const { file, sha256, marker, followUp, depths = ['beginner'] } of list) {
      if (failedPastes >= 2) { console.log(`NOTE sample ${file}: skipped (the last 2 samples failed at the paste)`); continue; }
      const name = path.parse(file).name;
      let before = '';
      for (const [i, level] of depths.entries()) {
        const ok = await step(i === 0 ? `sample ${file}` : `sample ${file} ${level}`, async () => {
          const panel = await windowWith('widget.html');
          await resize(panel, 420, 720);
          if (i === 0) {
            const bytes = readFileSync(new URL(file, dir));
            const sum = createHash('sha256').update(bytes).digest('hex');
            if (sum !== sha256) throw new Error(`${file} hashes to ${sum.slice(0, 16)}, samples.json says ${sha256.slice(0, 16)}`);
            // Whatever answer the panel shows now (the sample before) can't count as this file's.
            before = (await panel.locator('.body').first().innerText().catch(() => '')).trim();
            await panel.evaluate(([text, lvl]) => window.unvibe.usePaste({ text, level: lvl }), [bytes.toString('utf8'), level]);
            await (await windowWith('widget.html')).locator('.code-context').filter({ hasText: marker }).first().waitFor({ timeout: 30000 });
            await (await windowWith('widget.html')).locator('.body .cursor').waitFor({ timeout: 30000 }).catch(() => {});
          } else {
            await panel.locator(`.lvl[data-level="${level}"]`).click();
            await sleep(1500);
          }
          // Budget: a fresh paste's answer is already streaming past the cursor wait above, so 60 s; a depth click
          // starts a new explanation, so 90 s.
          const { done, text } = await atDepth(level, before, i === 0 ? 60000 : 90000);
          before = text;
          await resize(done, 420, 720);
          await done.locator('.body').evaluate((el) => el.scrollTo({ top: 0 }));
          await sleep(600);
          await shot(done, `sample-${name}-${level}`);
          // The still and the saved text must be the answer that was checked: nothing restarted while it was taken.
          const after = await panelState(done);
          if (!after.finished || after.depth !== level || after.text !== text) throw new Error(`the ${level} panel changed while its still was taken`);
          await saveAnswer(done, depths.length > 1 ? `sample ${file} ${level}` : `sample ${file}`);
        });
        if (i === 0) failedPastes = ok ? 0 : failedPastes + 1;
        if (!ok) break;
        if (i === depths.length - 1 && followUp) await step(`sample ${file} follow-up`, async () => {
          const done = await askFollowUp(followUp);
          await resize(done, 420, 720);
          await scrollToAnswer(done, followUp);
          await sleep(600);
          await shot(done, `sample-${name}-follow-up`);
          await saveAnswer(done, `sample ${file} follow-up`);
        });
      }
    }
    // Back to the size the other panel stills use.
    await step('sample panel size', async () => resize(await windowWith('widget.html'), 560, 720));
  }
  // The key check: code holding a key-shaped string is refused on this computer before anything is
  // sent. 'sk_test_' + 24 x's matches the stripe-key rule (core/secretFilter.ts) and is plainly fake.
  await step('key check', async () => {
    const code = `const stripe = new Stripe("sk_test_${'x'.repeat(24)}");\nexport const charge = (amount) => stripe.charges.create({ amount, currency: "usd" });`;
    const panel = await windowWith('widget.html');
    await panel.evaluate(([text]) => window.unvibe.usePaste({ text, level: 'intermediate' }), [code]);
    const blocked = (await windowWith('widget.html')).locator('.state[role="alert"]').filter({ hasText: 'Blocked: credential detected' });
    await blocked.waitFor({ timeout: 20000 });
    await sleep(800);
    await shot(await windowWith('widget.html'), 'panel-key-check');
  });
  // "Why does this exist?" reads git history, so it needs a file inside a repo. The repo is made
  // here with a neutral author, because the answer shows who last changed the lines.
  if (process.env.E2E_LOCAL === '1') console.log('NOTE why exists: skipped (E2E_LOCAL: no keystrokes into a native dialog on someone\'s own Mac)');
  // On GitHub's macOS runner the pick itself works (31 Oct runs 41236582897 and later showed the real
  // history), but every companion step after it then timed out, cause not found; skipped so the rest records.
  else if (process.env.CI === 'true') console.log('NOTE why exists: skipped on CI (after the native file pick the companion tour times out on the runner)');
  else await step('why exists', async () => {
    const { file, git } = uploadRepo();
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

/**
 * A small git repo for the features that read history (Why does this exist?, Change Briefs): upload.js committed,
 * then changed in the working tree. The author is neutral, because the answers show who changed the lines.
 */
function uploadRepo() {
  // The real path: on macOS tmpdir() is under /var, a link to /private/var, and git reports the
  // repo root through the link, so a /var file path would sit "outside" its own repo.
  // A neutral project name, since Library and Briefs show it: <tmp>/<random>/sample-app.
  const repo = path.join(realpathSync(mkdtempSync(path.join(tmpdir(), 'unvibe-media-repo-'))), 'sample-app');
  mkdirSync(repo);
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
  return { repo, file, git };
}

/**
 * After a few explanations the companion asks for feedback (a modal, feedback.tsx, 2.5 s after Today shows). Close
 * it the way a person would, so the tour's clicks reach the page; `wait` ms for it to appear first.
 */
async function closeFeedback(wait) {
  const overlay = companion.locator('.fbk-overlay');
  try { await overlay.waitFor({ timeout: Math.max(wait, 1) }); } catch { return; }
  await companion.getByRole('button', { name: 'Close feedback', exact: true }).click();
  await overlay.waitFor({ state: 'detached', timeout: 5000 });
  console.log('NOTE closed the feedback card');
}

// --- Finish onboarding and tour the companion ------------------------------------------------
await step('today', async () => {
  await companion.bringToFront();
  // Walk the rest of setup by whatever the footer offers: step 2 says Next (or Skip for now before an explanation);
  // on a Mac, step 3 says Next once own code was explained there (the pasted samples count) and step 4 offers the
  // shortcut (Not now finishes), else step 3's Skip for now finishes; Windows ends with Start using Unvibe.
  const labels = ['Not now', 'Do it later', 'Start using Unvibe', 'Skip for now', 'Next'];
  // A step can be mid-transition (e.g. "Welcome!" while setup closes), so a step with no known button is looked at
  // again a moment later; only a step that stays that way fails.
  let stuck = 0;
  for (let i = 0; i < 12 && await companion.locator('.ob2__count').count(); i++) {
    if (await companion.locator('.ob2__count').filter({ hasText: `3 / ${steps}` }).count()) {
      await sleep(1000);
      await shot(companion, 'onboarding-anywhere');
    }
    let clicked = false;
    for (const name of labels) {
      const b = companion.locator('.ob2').getByRole('button', { name, exact: true });
      if (await b.count() && await b.first().isVisible()) { await b.first().click(); clicked = true; break; }
    }
    if (!clicked) {
      if (!await companion.locator('.ob2__count').count()) break; // setup finished while this looked
      if (++stuck >= 4) {
        const names = await companion.locator('.ob2 button:visible').allInnerTexts();
        throw new Error(`setup step ${await companion.locator('.ob2__count').innerText()} offers no known button: ${names.map((n) => n.trim()).join(' | ')}`);
      }
    }
    await sleep(1200);
  }
  await companion.locator('.topbar__title').filter({ hasText: 'Today' }).waitFor({ timeout: 15000 });
  await closeFeedback(4000);
  await sleep(1800);
  await shot(companion, 'today');
});

for (const page of ['Library', 'Quiz', 'Briefs', 'Momentum', 'Ask Vibe']) {
  await step(page, async () => {
    await closeFeedback(0);
    await companion.locator('.side').getByRole('button', { name: page, exact: true }).click();
    await companion.locator('.topbar__title').filter({ hasText: page }).waitFor({ timeout: 10000 });
    await sleep(1800);
    await shot(companion, page.toLowerCase().replace(/\s+/g, '-'));
  });
}

// Ask Vibe answers a real question about what was just learned.
await step('ask vibe answer', async () => {
  await closeFeedback(0);
  const question = 'Explain debounce again in one sentence, like I am new to this.';
  const chat = companion.locator('#chatDraft');
  const send = companion.locator('.chat-dock').getByRole('button', { name: 'Send', exact: true });
  await enterText(chat, question);
  await send.click();
  if (await agreeIfAsked(companion, 3000)) {
    if ((await chat.inputValue()).trim() !== question) await enterText(chat, question);
    await send.click();
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
  await closeFeedback(0);
  await companion.locator('.side-settings').click();
  await companion.locator('.mside').getByRole('button', { name: 'Privacy & Data', exact: true }).click();
  await sleep(1200);
  await shot(companion, 'settings-privacy');
  await companion.getByRole('button', { name: 'Close settings', exact: true }).click();
});

await step('island', async () => {
  const bar = await windowWith('bar.html', 5000);
  await shot(bar, 'island');
});

// One Change Brief open: the sample project chosen before launch (briefRepo), its working-tree change to upload.js.
// Reading a brief stays on the computer.
await step('brief open', async () => {
  await closeFeedback(0);
  await companion.bringToFront();
  await companion.locator('.side').getByRole('button', { name: 'Briefs', exact: true }).click();
  await companion.locator('.topbar__title').filter({ hasText: 'Briefs' }).waitFor({ timeout: 10000 });
  try {
    await companion.locator('.briefings').getByText('upload.js').first().waitFor({ timeout: 45000 });
  } catch (e) {
    // What the page shows instead: a still and its text, for the next fix.
    await shot(companion, 'briefs-failed');
    console.log(`  briefs text: ${(await companion.locator('.briefings').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600)}`);
    throw e;
  }
  await sleep(1800);
  await shot(companion, 'briefs-open');
});

for (const v of videos) v.stop();
await app.close();
// Every recording was ended above; wait for the encoders to write their files.
await Promise.race([Promise.all(videos.map((v) => v.done)), sleep(30000)]);
const files = videos.map((v) => ({ window: v.window, opened: v.opened, closed: v.closed, path: existsSync(v.path) ? v.path : null }));
writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ version, marks, videos: files, failures }, null, 2));
writeFileSync(path.join(out, 'snippets.json'), JSON.stringify({ version, snippets }, null, 2));
console.log(JSON.stringify({ version, failures, videos: files }, null, 2));
process.exit(failures.length ? 1 : 0);
