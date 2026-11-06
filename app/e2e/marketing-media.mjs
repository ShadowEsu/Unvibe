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
//      E2E_LOCAL=1 (a run on someone's own Mac: no keystrokes into the native file dialog),
//      MEDIA_TAKES (which takes: gitlesson by default, film4, all, or screen: the whole-screen editor takes below).
// MEDIA_TAKES=screen also reads (set by real-device-test.yml's editor setup step): SCREEN_EDITOR (vscode, xcode or
//      textedit), SCREEN_VSCODE_EXE, SCREEN_VSCODE_SETTINGS (settings.json for each take's fresh VS Code profile),
//      SCREEN_WORKSPACE (the sample-app folder), SCREEN_DISPLAY (the display mode, as logged); it needs ffmpeg with
//      avfoundation, cliclick, Accessibility and Screen Recording.
import { launchApp } from './cdp-launch.mjs';
import { chromium } from 'playwright';
import { execFile, execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
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
const TAKES = process.env.MEDIA_TAKES ?? 'gitlesson';
const SCREEN = TAKES === 'screen';

const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-media-'));
const installId = process.env.MEDIA_INSTALL_ID ?? `qa-media-local-${Date.now()}`;
writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId }));
console.log(`install id ${installId}`);
// Briefs reads the project last chosen (settings lastProjectRoot). The folder dialog can't be answered reliably on
// GitHub's runner, so the run starts as if this sample project had been chosen before: a brief of its real change.
const briefRepo = uploadRepo().repo;
const seed = { lastProjectRoot: briefRepo };
// The whole-screen take: the panel opens where it was last left (windows.ts resolveWidgetBounds), so start it beside
// where the editor will be, not over it. settingsRevision is the app's SETTINGS_REVISION (8 in settings.ts since
// 0.1.11): a settings file below it counts as pre-onboarding, and the app drops its lastWidgetBounds on load.
let layout = SCREEN ? screenLayout(desktopPoints()) : null;
if (SCREEN) Object.assign(seed, { settingsRevision: 8, lastWidgetBounds: layout.panel });
writeFileSync(path.join(userData, 'unvibe-settings.json'), JSON.stringify(seed));

// Retina-sharp screenshots on runners whose display is 1x. Not for the whole-screen take: there the app has to draw
// exactly as it would for a person on that display (the stills scale themselves to 2x in shot()).
const app = await launchApp({ exe, userData, args: SCREEN ? [] : ['--force-device-scale-factor=2'], timeout: 90000 });

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
// The whole-screen take records the screen itself; a VP8 encode per window would compete with it for the CPU and
// cost it real-time frames.
if (!SCREEN) app.onWindow((page) => { void record(page); });

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

/** What each take pasted: its label, sha256, and when it was sent (s from the start of the run). */
const pasted = [];
const FILM4_TAKES = {
  // agents/marketing/films-1105/film4-sample/src/auth/retry.ts (sha256 3fe5657662788cb4…), lines 11-26.
  retry: {
    sha256: 'aabf7d5e2bddb457aab0ca6c42fa29d18a80d73b9d47fd960148306b43675e0c',
    text: [
      'export async function withRetry<T>(',
      '  task: () => Promise<T>,',
      '  attempts = 3,',
      '  baseDelayMs = 500,',
      '): Promise<T> {',
      '  let lastError: unknown;',
      '  for (let i = 0; i < attempts; i++) {',
      '    try {',
      '      return await task();',
      '    } catch (err) {',
      '      lastError = err;',
      '      if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i + Math.random() * 100);',
      '    }',
      '  }',
      '  throw lastError;',
      '}',
    ].join('\n'),
  },
  // agents/marketing/git-lesson/sample/login-callback.diff (sha256 f09025ebbac4c5ef…), its one hunk: the @@ line to the end.
  diff: {
    sha256: '282e4674ef88f9ff550aa8c259430cf0dc490995c7e4925e22ab34214a70c6b1',
    text: [
      '@@ -12,7 +12,8 @@ export async function GET(req: Request) {',
      '   const code = new URL(req.url).searchParams.get("code") ?? "";',
      '   const token = await exchangeCode(code);',
      '   const res = NextResponse.redirect(new URL("/dashboard", req.url));',
      '-  res.cookies.set("session", token, { httpOnly: true, secure: true, sameSite: "lax" });',
      '+  res.cookies.set("theme", "dark", { sameSite: "strict" });',
      '+  res.cookies.set("session", token, { httpOnly: true, secure: true, sameSite: "strict" });',
      '   return res;',
      ' }',
    ].join('\n'),
  },
};

/**
 * Sends `text` through the panel's paste box at `level` (widget:usePaste, the page's text, never the OS clipboard). A
 * fresh install asks for the send agreement before its first own code goes out: agree as a new user would; the panel
 * then explains the waiting code itself (sent again only if it doesn't).
 */
async function sendPaste(label, sha256, text, level) {
  const send = async () => {
    pasted.push({ label, sha256, sentAt: (Date.now() - t0) / 1000 });
    mark(`${label}: sent`);
    await (await windowWith('widget.html')).evaluate(([t, l]) => window.unvibe.usePaste({ text: t, level: l }), [text, level]);
  };
  await send();
  // After Continue the panel explains the code that waited by itself (widget.tsx onAgreed → request). Sending
  // again would abort that run after the server counted it (run 42155987974: one answer, two explanations spent),
  // so only send again if the panel did not start on its own within 5 s.
  if (await agreeIfAsked(await windowWith('widget.html'))) {
    mark(`${label}: agreed`);
    // The thinking card (widget.tsx ThinkingCard, role=status) counts: run 42161863065 resumed with it for 8 s before
    // the first words, and a check for the stream cursor alone sent the code a second time.
    const resumed = await (await windowWith('widget.html')).locator('.thinking, .body .cursor, .card--done').first().waitFor({ timeout: 8000 }).then(() => true, () => false);
    if (!resumed) await send();
  }
}

/**
 * One take: the text goes in through the panel's paste box at Beginner (sendPaste, agreeing if asked). The full answer
 * streams, and the finished panel is held 4 s as the app left it (the film's tail); only after that is it scrolled to
 * the top for a still.
 */
async function pasteTake(label, { sha256, text }, expect, { still = true } = {}) {
  const actual = createHash('sha256').update(text).digest('hex');
  if (actual !== sha256) {
    failures.push(`${label}: text sha256 ${actual} is not Marketing's ${sha256}; nothing sent`);
    console.log(`FAIL ${label}: text sha256 mismatch`);
    return false;
  }
  return step(label, async () => {
    const panel = await windowWith('widget.html');
    // The panel's size is only for framing: a window macOS keeps a little shorter (run 42155987974's second take came
    // up 560x679) still records the take, so a size miss is a note, not a failed take.
    await resize(panel, 560, 720).catch((e) => console.log(`NOTE ${label}: ${e.message.split('\n')[0]}`));
    await sleep(1500);
    await sendPaste(label, sha256, text, 'beginner');
    await (await windowWith('widget.html')).locator('.code-context').filter({ hasText: expect }).first().waitFor({ timeout: 30000 });
    await (await windowWith('widget.html')).locator('.body .cursor').waitFor({ timeout: 30000 }).then(() => mark(`${label}: streaming`)).catch(() => {});
    const done = await settledPanel();
    mark(`${label}: answer done`);
    const depth = (await done.locator('.lvl.on').first().innerText().catch(() => '')).trim();
    if (!/^beginner$/i.test(depth)) throw new Error(`the answer is at ${depth || 'no depth'}, not Beginner`);
    await saveAnswer(done, label);
    await sleep(4000);
    mark(`${label}: end`);
    if (still) {
      await done.locator('.body').evaluate((el) => el.scrollTo({ top: 0 }));
      await sleep(600);
      await shot(done, label.replace(/[^a-z0-9]+/gi, '-'));
    }
  });
}
/**
 * A follow-up typed into the panel's ask box (as a person would, enterText), the full answer streamed under the
 * explanation, and a 4 s hold on the panel as the app left it; then scrolled to the answer's start for a still.
 */
async function followUpTake(label, question) {
  return step(label, async () => {
    const askRow = async () => (await windowWith('widget.html')).locator('.askrow');
    await enterText((await askRow()).getByLabel('Follow-up question'), question);
    await sleep(600);
    mark(`${label}: sent`);
    await (await askRow()).getByRole('button', { name: 'Ask', exact: true }).click();
    if (await agreeIfAsked(await windowWith('widget.html'))) {
      const again = (await askRow()).getByLabel('Follow-up question');
      if ((await again.inputValue()).trim() !== question) await enterText(again, question);
      mark(`${label}: sent again after the agreement`);
      await (await askRow()).getByRole('button', { name: 'Ask', exact: true }).click();
    }
    await (await windowWith('widget.html')).locator('.body .cursor').waitFor({ timeout: 30000 }).then(() => mark(`${label}: streaming`)).catch(() => {});
    const done = await settledPanel();
    mark(`${label}: answer done`);
    const text = await done.locator('.body').innerText();
    if (!text.includes(question) && !/short answer/i.test(text)) throw new Error('the follow-up answer is not in the panel');
    await saveAnswer(done, label);
    await sleep(4000);
    mark(`${label}: end`);
    await done.locator('.body').evaluate((body) => {
      const blocks = [...body.querySelectorAll('h1, h2, h3, h4, strong, p')];
      const start = blocks.find((el) => /^short answer$/i.test((el.textContent ?? '').trim()));
      if (start) body.scrollTo({ top: Math.max(0, start.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 14) });
    });
    await sleep(600);
    await shot(done, label.replace(/[^a-z0-9]+/gi, '-'));
  });
}

// --- The whole-screen take (MEDIA_TAKES=screen; Design's home motion spec 530-531 §15) ------------------------------
// A real editor on the real screen, recorded whole by ffmpeg (avfoundation: cursor shown, 30 fps, real time). The lines
// are selected with a real mouse drag (cliclick), a real Control+U opens the panel (osascript, as real-device.mjs's
// global-shortcut check does on this runner), and the panel's buttons get real clicks. Nothing is drawn or composited.
// Take 1 (the site): debounce.js, then Beginner → Advanced → Test me. Take 2 (film 4): retry.ts lines 11-26 at Beginner.

// The 7 lines of the site's demo editor (marketing/src/components/paper/PhotoHero.tsx .ndemo__code, origin/main
// 707e8fc9). They are also the app's FIRST_RUN_SAMPLE (core/consent.ts), so the app counts this explanation as its
// sample (main.ts isSample: no launch-at-login question after it); the panel shows the same as for any selection.
const SCREEN_DEBOUNCE = {
  sha256: '635f502cc52431fd5e3d69f60fafef2612a12282e25b0a84d32a929f9af16818',
  text: [
    'function debounce(fn, wait) {',
    '  let timer;',
    '  return (...args) => {',
    '    clearTimeout(timer);',
    '    timer = setTimeout(() => fn(...args), wait);',
    '  };',
    '}',
  ].join('\n'),
};
// The sample files are written by real-device-test.yml's editor setup step; `first` is the selection's first line.
const SCREEN_TAKES = [
  { name: 'site', video: 'screen-site.mp4', file: 'src/debounce.js', first: 1, sample: SCREEN_DEBOUNCE, depth: 'intermediate', expect: 'debounce' },
  { name: 'film4', video: 'screen-film4.mp4', file: 'src/auth/retry.ts', first: 11, sample: FILM4_TAKES.retry, depth: 'beginner', expect: 'withRetry' },
];
// The warm-up: the same neutral formatPrice sample the full run pastes, so the agreement is given before any take.
const SCREEN_WARM_UP = 'export function formatPrice(cents, currency = "USD") {\n  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);\n}';
const EDITOR = process.env.SCREEN_EDITOR || 'vscode';
const sha256Of = (data) => createHash('sha256').update(data).digest('hex');
const run = (cmd, args, timeout = 30000) => new Promise((resolve, reject) => execFile(cmd, args, { encoding: 'utf8', timeout },
  (error, stdout, stderr) => (error ? reject(new Error(`${path.basename(cmd)}: ${(stderr || '').trim() || error.message}`)) : resolve(stdout))));
const osa = (script) => run('osascript', ['-e', script]);
const cliclick = (...args) => run(process.env.CLICLICK || 'cliclick', args);

/** The main display in points, before the app runs (Finder's desktop bounds; the menu bar's height is a guess). */
function desktopPoints() {
  try {
    const [, , width, height] = execFileSync('osascript', ['-e', 'tell application "Finder" to get bounds of window of desktop'], { encoding: 'utf8', timeout: 10000 })
      .split(',').map((n) => Number(n.trim()));
    if (width > 0 && height > 0) return { left: 0, top: 25, width, height: height - 25 };
  } catch { /* below */ }
  console.log('NOTE screen: Finder did not report the desktop size; laid out for 1920x1080');
  return { left: 0, top: 25, width: 1920, height: 1055 };
}

/**
 * Editor and panel side by side, centred, about 16:10 together (Design §15's crop), the panel at its usual 560 wide
 * (440 on a small screen). Points, as macOS and cliclick count them.
 */
function screenLayout({ left, top, width, height }) {
  const margin = 24;
  const gap = 16;
  const w = Math.min(width - 2 * margin, 1800);
  const h = Math.min(height - 2 * margin, Math.round(w / 1.6));
  const panelWidth = w >= 1400 ? 560 : 440;
  const x = left + Math.round((width - w) / 2);
  const y = top + Math.round((height - h) / 2);
  return {
    editor: { x, y, width: w - panelWidth - gap, height: h },
    panel: { x: x + w - panelWidth, y, width: panelWidth, height: Math.min(h, 760) },
  };
}

/** Presses No (else Cancel or OK) on a sheet or dialog of the app, as real-device.mjs's watcher does; up to `wait` ms. */
async function answerSheets(wait) {
  const found = [];
  const end = Date.now() + wait;
  while (!found.length && Date.now() < end) {
    const said = await osa(`tell application "System Events"
  set p to first process whose unix id is ${app.process.pid}
  set found to ""
  repeat with w in windows of p
    try
      set boxes to (sheets of w)
      if subrole of w is "AXDialog" then set end of boxes to w
      repeat with s in boxes
        set t to ""
        repeat with x in (static texts of s)
          set t to t & (value of x) & " "
        end repeat
        repeat with b in {"No", "Cancel", "OK"}
          if exists button b of s then
            click button b of s
            set found to found & t & "|"
            exit repeat
          end if
        end repeat
      end repeat
    end try
  end repeat
  return found
end tell`).catch((e) => { console.log(`NOTE screen dialogs: ${e.message.split('\n')[0]}`); return ''; });
    found.push(...said.split('|').map((m) => m.trim()).filter(Boolean));
    if (!found.length) await sleep(1000);
  }
  for (const message of found) console.log(`NOTE screen: answered a native dialog: ${message}`);
  return found;
}

/** The companion would sit behind the editor in every frame; minimised, as a person tidying their screen would. */
async function minimizeCompanion() {
  const title = await companion.title();
  // Matched by title: the panel and the island are windows of the same process.
  if (!title) throw new Error('the companion window has no title to find it by');
  const count = await osa(`tell application "System Events"
  set p to first process whose unix id is ${app.process.pid}
  set n to 0
  repeat with w in (windows of p)
    try
      if name of w is ${JSON.stringify(title)} and subrole of w is "AXStandardWindow" then
        set value of attribute "AXMinimized" of w to true
        set n to n + 1
      end if
    end try
  end repeat
  return n
end tell`);
  return Number(count.trim()) > 0;
}

async function waitNoPanel(timeout = 8000) {
  const end = Date.now() + timeout;
  while (app.windows().some((w) => w.url().includes('widget.html') && !w.isClosed())) {
    if (Date.now() > end) throw new Error('the panel did not close');
    await sleep(200);
  }
}

/**
 * Opens `file` in the take's editor, in front. VS Code gets a fresh profile per take (the setup step's settings, no
 * extensions, nothing restored from the take before) and its own debug port, so the code's line positions can be read
 * from its DOM. Xcode and TextEdit (Design's fallbacks) open through Launch Services and have no DOM to read.
 */
async function openEditor(index, workspace, file) {
  if (EDITOR !== 'vscode') {
    const name = { xcode: 'Xcode', textedit: 'TextEdit' }[EDITOR];
    if (!name) throw new Error(`unknown SCREEN_EDITOR ${EDITOR}`);
    await run('open', ['-a', name, file]);
    return { name, proc: `first process whose name is "${name}"`, page: null, close: () => osa(`tell application "${name}" to quit saving no`).catch(() => {}) };
  }
  const exe = process.env.SCREEN_VSCODE_EXE || '/Applications/Visual Studio Code.app/Contents/MacOS/Electron';
  const profile = mkdtempSync(path.join(tmpdir(), 'unvibe-vscode-'));
  mkdirSync(path.join(profile, 'User'));
  if (process.env.SCREEN_VSCODE_SETTINGS) copyFileSync(process.env.SCREEN_VSCODE_SETTINGS, path.join(profile, 'User', 'settings.json'));
  else console.log('NOTE screen: no SCREEN_VSCODE_SETTINGS; VS Code runs with its default settings');
  const port = 9340 + index;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  const child = spawn(exe, [`--user-data-dir=${profile}`, `--extensions-dir=${path.join(profile, 'extensions')}`, '--disable-extensions',
    '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', '--disable-telemetry', '--new-window',
    `--remote-debugging-port=${port}`, workspace, file], { env, detached: true, stdio: 'ignore' });
  let exited = null;
  child.on('exit', (code, signal) => { exited = `exit ${code ?? signal}`; });
  child.on('error', (e) => { exited = e.message; });
  const stop = () => { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ } };
  process.on('exit', stop);
  const start = Date.now();
  let browser = null;
  let page = null;
  while (!page && Date.now() - start < 60000) {
    if (exited) throw new Error(`VS Code stopped before its debug port opened (${exited})`);
    browser ??= await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => null);
    page = browser?.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes('workbench')) ?? null;
    if (!page) await sleep(500);
  }
  if (!page) {
    stop();
    throw new Error('VS Code showed no workbench on its debug port in 60 s');
  }
  return {
    name: 'VS Code',
    proc: `first process whose unix id is ${child.pid}`,
    page,
    async close() {
      await browser.close().catch(() => {});
      stop();
      await sleep(1500);
    },
  };
}

/** Puts the editor's window where the layout wants it and brings it in front (System Events, Accessibility). */
async function placeEditor(editor, { x, y, width, height }) {
  await osa(`tell application "System Events"
  repeat 60 times
    if exists (${editor.proc}) then
      if exists window 1 of (${editor.proc}) then exit repeat
    end if
    delay 0.5
  end repeat
  set p to ${editor.proc}
  set frontmost of p to true
  set position of window 1 of p to {${x}, ${y}}
  set size of window 1 of p to {${width}, ${height}}
end tell`);
}

/**
 * Where each selected line sits in VS Code: the row whose line number is n (.margin-view-overlays .line-numbers) and
 * the .view-line at the same height, checked against the sample's text. CSS pixels in the workbench page, plus what
 * turns them into screen points (the window's origin, its title bar if native, and its devicePixelRatio).
 */
function editorRows(page, first, lines) {
  return page.evaluate(([firstLine, expected]) => {
    const norm = (s) => (s ?? '').replace(/\u00a0/g, ' ').replace(/\s+$/, '');
    const editor = [...document.querySelectorAll('.editor-instance .monaco-editor')].find((e) => e.offsetParent && e.querySelector('.view-lines'));
    if (!editor) return { error: 'no code editor on screen' };
    const numbers = [...editor.querySelectorAll('.margin-view-overlays .line-numbers')];
    const views = [...editor.querySelectorAll('.view-lines .view-line')];
    const rows = [];
    for (let i = 0; i < expected.length; i++) {
      const n = firstLine + i;
      const number = numbers.find((el) => el.textContent.trim() === String(n));
      if (!number) return { error: `line ${n} is not on screen` };
      const top = number.getBoundingClientRect().top;
      const view = views.find((el) => Math.abs(el.getBoundingClientRect().top - top) < 2);
      if (!view) return { error: `no text row beside line number ${n}` };
      if (norm(view.textContent) !== norm(expected[i])) return { error: `line ${n} reads "${norm(view.textContent)}"` };
      const r = view.getBoundingClientRect();
      const text = view.firstElementChild?.getBoundingClientRect();
      rows.push({ n, left: r.left, top: r.top, height: r.height, right: text ? text.right : r.left });
    }
    return { rows, screenX: window.screenX, screenY: window.screenY, chromeTop: window.outerHeight - window.innerHeight, dpr: window.devicePixelRatio };
  }, [first, lines]);
}

/**
 * Selects with the keyboard at a typing pace (the fallback when the drag can't be placed or didn't select): VS Code's
 * Go to Line (Control+G), other editors from the top of the file; then Shift+Down per line and Shift+Command+Right.
 */
function keyboardSelect(first, count) {
  const goTo = EDITOR === 'vscode'
    ? `keystroke "g" using control down
  delay 0.7
  keystroke "${first}"
  delay 0.4
  key code 36
  delay 0.5`
    : `key code 126 using command down
  delay 0.4
  repeat ${first - 1} times
    key code 125
    delay 0.05
  end repeat`;
  return osa(`tell application "System Events"
  ${goTo}
  repeat ${count - 1} times
    key code 125 using shift down
    delay 0.08
  end repeat
  key code 124 using {shift down, command down}
end tell`);
}

/** avfoundation's index for "Capture screen 0" (the main display), or null when this ffmpeg has none. */
function screenDevice() {
  if (!ffmpeg) return null;
  const listed = spawnSync(ffmpeg, ['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', ''], { encoding: 'utf8' });
  return /\[(\d+)\] Capture screen 0/.exec(listed.stderr ?? '')?.[1] ?? null;
}

/**
 * Whole-screen recording: native resolution, cursor shown, 30 fps in real time, H.264 at CRF 10 (near lossless; the
 * site cut is made from it). x264 ultrafast/zerolatency keeps up with 2560x1600 on the runner's cores and writes each
 * frame at once, so ffmpeg's progress (out_time) against the wall clock dates the first frame: the marks are seconds
 * from that frame. Stopped with q on stdin, so the file is finalised.
 */
function startRecording(file, device) {
  const proc = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostats', '-progress', 'pipe:1',
    '-f', 'avfoundation', '-capture_cursor', '1', '-capture_mouse_clicks', '0', '-framerate', '30', '-pixel_format', 'uyvy422',
    '-thread_queue_size', '1024', '-i', `${device}:none`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '10', '-pix_fmt', 'yuv420p', '-r', '30',
    '-movflags', '+faststart', '-y', file], { stdio: ['pipe', 'pipe', 'pipe'] });
  const spawnedAt = Date.now();
  const starts = [];
  const errors = [];
  let buffered = '';
  let exit = null;
  proc.stdout.on('data', (d) => {
    buffered += d;
    for (let i = buffered.indexOf('\n'); i >= 0; i = buffered.indexOf('\n')) {
      const m = /^out_time_us=(\d+)$/.exec(buffered.slice(0, i).trim());
      buffered = buffered.slice(i + 1);
      // The first few reports only: each is an estimate of the first frame's wall time; the median is used.
      if (m && Number(m[1]) > 0 && starts.length < 7) starts.push(Date.now() - Number(m[1]) / 1000);
    }
  });
  proc.stderr.on('data', (d) => errors.push(String(d)));
  proc.stdin.on('error', () => {});
  const closed = new Promise((resolve) => {
    proc.on('close', (code, signal) => { exit = code ?? signal; resolve(); });
    proc.on('error', (e) => { errors.push(e.message); exit = -1; resolve(); });
  });
  const startedAt = () => (starts.length ? [...starts].sort((a, b) => a - b)[Math.floor(starts.length / 2)] : null);
  return {
    startedAt,
    async ready(timeout = 15000) {
      const end = Date.now() + timeout;
      while (!starts.length && exit === null && Date.now() < end) await sleep(100);
      if (!starts.length) throw new Error(`the screen recording did not start (${errors.join('').trim().split('\n').pop() || `ffmpeg ${exit ?? 'silent'}`})`);
    },
    async stop() {
      if (exit === null) proc.stdin.write('q');
      await Promise.race([closed, sleep(20000)]);
      if (exit === null) {
        proc.kill('SIGINT');
        await Promise.race([closed, sleep(10000)]);
      }
      return {
        firstFrameAfterSpawnS: startedAt() === null ? null : (startedAt() - spawnedAt) / 1000,
        startEstimates: starts.length,
        ffmpegExit: exit,
        ffmpegErrors: errors.join('').trim().slice(-800) || null,
        bytes: existsSync(file) ? statSync(file).size : 0,
      };
    },
  };
}

/**
 * Presses a panel control with a real click: the pointer glides there (cliclick) and clicks at the control's centre
 * (its rect in the panel page plus the window's screen position; the panel is frameless). A first click on a window
 * that isn't key can only bring it forward, so a second click follows if nothing happened, as a person would. Only
 * if the real clicks don't land is the control clicked through the DOM, and the take records that.
 */
async function pressInPanel(result, selector, label, pressed, tm) {
  const target = (await windowWith('widget.html')).locator(selector).first();
  await target.waitFor({ state: 'visible', timeout: 30000 });
  await target.scrollIntoViewIfNeeded();
  const [x, y] = await target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(window.screenX + r.left + r.width / 2), Math.round(window.screenY + window.outerHeight - window.innerHeight + r.top + r.height / 2)];
  });
  const waitPressed = async (ms) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await pressed(await windowWith('widget.html'))) return true;
      await sleep(150);
    }
    return false;
  };
  let how = null;
  try {
    await cliclick('-e', '250', `m:${x},${y}`);
    await sleep(350);
    tm(`${label} click`);
    await cliclick(`c:${x},${y}`);
    if (await waitPressed(2500)) how = 'cliclick';
    else {
      await cliclick(`c:${x},${y}`);
      if (await waitPressed(2500)) how = 'cliclick, second click';
    }
  } catch (e) {
    console.log(`NOTE screen: ${label}: cliclick failed (${e.message.split('\n')[0]})`);
  }
  if (!how) {
    console.log(`NOTE screen: ${label}: the real click did not land; clicked through the DOM instead`);
    tm(`${label} click (DOM)`);
    await (await windowWith('widget.html')).locator(selector).first().click();
    if (!await waitPressed(5000)) throw new Error(`${label} did not respond to a click`);
    how = 'DOM';
  }
  result.clicks.push({ label, how, x, y });
}

/** One whole-screen take; its result (marks, methods, recording) goes in `info.takes`, failures in `failures`. */
async function screenTake(take, index, info, ctx) {
  const lines = take.sample.text.split('\n');
  const result = {
    name: take.name, video: take.video, startDepth: take.depth,
    text: { file: take.file, lines: `${take.first}-${take.first + lines.length - 1}`, sha256: take.sample.sha256, fileSha256: null },
    selectMethod: null, clickMethod: null, clicks: [], captured: null, editorBounds: layout.editor, panelBounds: null,
    editorPixelRatio: null, marks: [], recording: null, failures: [],
  };
  info.takes.push(result);
  const fail = (message) => {
    result.failures.push(message);
    failures.push(`screen ${take.name}: ${message}`);
    console.log(`FAIL screen ${take.name}: ${message}`);
  };
  // The words on screen are Marketing's and Design's, character for character: the file's lines must hash to the
  // sample's sha256 (as pasteTake checks its texts), or the take is not recorded.
  const fileText = readFileSync(path.join(ctx.workspace, take.file), 'utf8');
  const selection = fileText.split('\n').slice(take.first - 1, take.first - 1 + lines.length).join('\n');
  result.text.fileSha256 = sha256Of(fileText);
  if (sha256Of(take.sample.text) !== take.sample.sha256 || sha256Of(selection) !== take.sample.sha256) {
    fail(`lines ${result.text.lines} of ${take.file} hash to ${sha256Of(selection)}, not ${take.sample.sha256}; not recorded`);
    return;
  }
  const wall = [];
  const tm = (label) => { wall.push({ label, at: Date.now() }); mark(`screen ${take.name}: ${label}`); };
  let editor = null;
  let recorder = null;
  try {
    // A shortcut-started panel opens at the Settings default depth (main.ts makeSession): take 1 starts in the middle so
    // Beginner and Advanced are both real switches; take 2 is at Beginner from the first word, as film 4's paste take is.
    await companion.evaluate((level) => window.unvibe.setSettings({ defaultExplanationLevel: level }), take.depth);
    editor = await openEditor(index, ctx.workspace, path.join(ctx.workspace, take.file));
    await placeEditor(editor, layout.editor);
    await sleep(2500); // the window settles and the editor draws the file
    let geometry = null;
    if (editor.page) {
      geometry = await editorRows(editor.page, take.first, lines).catch((e) => ({ error: e.message.split('\n')[0] }));
      if (geometry.error) {
        console.log(`NOTE screen ${take.name}: no line positions from the editor (${geometry.error})`);
        geometry = null;
      } else result.editorPixelRatio = geometry.dpr;
    }
    // The pointer starts at rest over the lower code, away from the lines, so its way to line 1 is in the take.
    await cliclick(`m:${Math.round(layout.editor.x + layout.editor.width * 0.7)},${Math.round(layout.editor.y + layout.editor.height * 0.8)}`);
    recorder = startRecording(path.join(ctx.dir, take.video), ctx.device);
    await recorder.ready();
    await sleep(1500); // a still lead-in before anything moves

    if (geometry) {
      // CSS pixels to screen points: the page's devicePixelRatio over the display's own (the app's companion page) is
      // VS Code's zoom; 1 with window.zoomLevel 0.
      const zoom = geometry.dpr / ctx.displayRatio || 1;
      const at = (x, y) => [Math.round(geometry.screenX + x * zoom), Math.round(geometry.screenY + geometry.chromeTop + y * zoom)];
      const firstRow = geometry.rows[0];
      const lastRow = geometry.rows.at(-1);
      const [x0, y0] = at(firstRow.left + 1, firstRow.top + firstRow.height / 2);
      const [x1, y1] = at(lastRow.right + 6, lastRow.top + lastRow.height / 2);
      await cliclick('-e', '300', `m:${x0},${y0}`);
      await sleep(450);
      // Design §15 step 1: the selection is seen growing. 16 eased steps 75 ms apart: about 1.3 s from the start of
      // line 1 to the end of the last line.
      const steps = 16;
      const moves = Array.from({ length: steps }, (_, i) => {
        const t = (i + 1) / steps;
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        return `dm:${Math.round(x0 + (x1 - x0) * e)},${Math.round(y0 + (y1 - y0) * e)}`;
      });
      tm('select start');
      await cliclick('-w', '75', `dd:${x0},${y0}`, ...moves, `du:${x1},${y1}`);
      tm('select end');
      const selectedRows = await editor.page.evaluate(() => document.querySelectorAll('.editor-instance .monaco-editor .view-overlays .selected-text').length).catch(() => 0);
      if (selectedRows >= lines.length) result.selectMethod = 'drag';
      else console.log(`NOTE screen ${take.name}: the drag selected ${selectedRows} of ${lines.length} rows`);
    }
    if (!result.selectMethod) {
      console.log(`NOTE screen ${take.name}: selecting with the keyboard instead of a drag`);
      await sleep(400);
      tm('select start (keyboard)');
      await keyboardSelect(take.first, lines.length);
      tm('select end (keyboard)');
      result.selectMethod = 'keyboard';
    }

    await sleep(800);
    // Marked when osascript returns: the key has been pressed and released by then (osascript's own start-up, about
    // 0.1-0.2 s, comes before the key, so a mark before the call would sit early).
    await osa('tell application "System Events" to keystroke "u" using control down');
    tm('shortcut');
    const panel = await windowWith('widget.html', 20000);
    tm('panel visible');
    result.panelBounds = await panel.evaluate(() => ({ x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight })).catch(() => null);
    const b = result.panelBounds;
    const ed = layout.editor;
    if (b && b.x < ed.x + ed.width && b.x + b.width > ed.x && b.y < ed.y + ed.height && b.y + b.height > ed.y) {
      console.log(`NOTE screen ${take.name}: the panel opened over the editor (${JSON.stringify(b)})`);
    }
    await (await windowWith('widget.html')).locator('.body .cursor').waitFor({ timeout: 30000 }).then(() => tm('streaming')).catch(() => {});
    let done = await settledPanel();
    tm('answer done');
    const captured = (await done.locator('.code-context code').first().innerText().catch(() => '')).trim();
    result.captured = captured === take.sample.text.trim();
    if (!result.captured) fail(`the panel explained other text than the selection: "${captured.slice(0, 80).replace(/\s+/g, ' ')}"`);
    await saveAnswer(done, `screen ${take.name}`);

    if (take.name === 'site') {
      // §15 step 5 (as §13.1): Beginner, then Advanced, then Test me with one question showing.
      for (const level of ['beginner', 'advanced']) {
        await sleep(1500);
        await pressInPanel(result, `.lvl[data-level="${level}"]`, level, async (p) => (await p.locator(`.lvl.on[data-level="${level}"], .body .cursor`).count()) > 0, tm);
        await (await windowWith('widget.html')).locator('.body .cursor').waitFor({ timeout: 15000 }).then(() => tm(`${level} streaming`)).catch(() => {});
        done = await settledPanel();
        tm(`${level} done`);
        await saveAnswer(done, `screen site ${level}`);
      }
      await sleep(1500);
      await pressInPanel(result, '.tool--quiz', 'test me', async (p) => (await p.locator('.tool--quiz.on, .quiz__q').count()) > 0, tm);
      await (await windowWith('widget.html')).locator('.quiz__q').first().waitFor({ timeout: 60000 });
      tm('question visible');
      await sleep(3000);
    } else {
      const depth = (await done.locator('.lvl.on').first().innerText().catch(() => '')).trim();
      if (!/^beginner$/i.test(depth)) fail(`the answer is at ${depth || 'no depth'}, not Beginner`);
      await sleep(4000); // the film's tail: the finished panel as the app left it
    }
    tm('end');
    await sleep(600);
  } catch (e) {
    fail(e.message.split('\n')[0]);
  } finally {
    if (recorder) result.recording = await recorder.stop();
    const zero = recorder?.startedAt();
    result.marks = wall.map(({ label, at }) => ({ label, s: zero ? Math.round(at - zero) / 1000 : null }));
    result.clickMethod = !result.clicks.length ? null : result.clicks.every((c) => c.how !== 'DOM') ? 'cliclick' : result.clicks.some((c) => c.how !== 'DOM') ? 'cliclick and DOM' : 'DOM';
    // The next take opens a fresh panel with no trace of this one.
    const open = await app.windowWith('widget.html', 1000);
    if (open) await open.evaluate(() => window.unvibe.closeWidget()).catch(() => {});
    await waitNoPanel().catch((e) => console.log(`NOTE screen ${take.name}: ${e.message}`));
    if (editor) await editor.close();
  }
}

/** Both whole-screen takes, after a warm-up off camera; writes screen/timeline.json and screen/SHA256SUMS. */
async function screenTakes() {
  const dir = path.join(out, 'screen');
  mkdirSync(dir, { recursive: true });
  const display = await companion.evaluate(() => ({
    points: [screen.width, screen.height], ratio: window.devicePixelRatio || 1,
    avail: { left: screen.availLeft, top: screen.availTop, width: screen.availWidth, height: screen.availHeight },
  }));
  // The app's own view of the screen (Dock and menu bar left out) replaces the guess made before launch.
  layout = screenLayout(display.avail);
  const info = {
    version, mode: TAKES, editor: EDITOR,
    display: { mode: process.env.SCREEN_DISPLAY || null, points: display.points.join('x'), pixelRatio: display.ratio, pixels: display.points.map((n) => n * display.ratio).join('x') },
    layout, warmUp: null, takes: [], failures: [],
  };
  const ctx = { dir, workspace: process.env.SCREEN_WORKSPACE, device: screenDevice(), displayRatio: display.ratio };
  console.log(`screen: ${info.display.pixels} px (${info.display.points} pt), editor ${EDITOR}, avfoundation screen ${ctx.device ?? 'none'}`);
  const missing = [
    !ctx.workspace && 'SCREEN_WORKSPACE is not set (real-device-test.yml\'s editor setup step writes the sample files)',
    !ctx.device && `this ffmpeg (${ffmpeg ?? 'none'}) lists no avfoundation screen`,
    !await cliclick('-V').then(() => true, () => false) && 'cliclick is not installed',
  ].filter(Boolean);
  for (const m of missing) failures.push(`screen: ${m}`);
  info.failures.push(...missing);

  if (!missing.length) {
    // Warm-up, off camera: the send agreement is given once with a paste, and the launch-at-login question that follows
    // a first own-code answer is answered No, so neither shows in a take. The panel is then put beside the editor
    // (the app saves where it is: lastWidgetBounds) and closed, so the recorded Control+U opens a fresh one there.
    info.warmUp = { agreed: false, dialogs: [], panel: null };
    const warmed = await step('screen warm-up', async () => {
      await sendPaste('screen warm-up', sha256Of(SCREEN_WARM_UP), SCREEN_WARM_UP, 'beginner');
      await (await windowWith('widget.html')).locator('.code-context').filter({ hasText: 'formatPrice' }).first().waitFor({ timeout: 30000 });
      await settledPanel();
      info.warmUp.agreed = existsSync(path.join(userData, 'unvibe-consent.json'));
      // The question comes once the answer is saved (main.ts askLaunchAtLogin), a moment after the panel settles.
      info.warmUp.dialogs = await answerSheets(12000);
      const panel = await windowWith('widget.html');
      await panel.evaluate((b) => { window.moveTo(b.x, b.y); window.resizeTo(b.width, b.height); }, layout.panel);
      await sleep(1000);
      info.warmUp.panel = await panel.evaluate(() => ({ x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight }));
      await panel.evaluate(() => window.unvibe.closeWidget());
      await waitNoPanel();
      if (!info.warmUp.agreed) throw new Error('no send agreement saved (unvibe-consent.json)');
    });
    if (warmed) {
      await step('screen: companion minimised', async () => {
        if (!await minimizeCompanion()) throw new Error('no companion window to minimise');
      });
      for (const [index, take] of SCREEN_TAKES.entries()) await screenTake(take, index, info, ctx);
    } else info.failures.push('warm-up failed: no take recorded');
  }

  for (const t of info.takes) info.failures.push(...t.failures.map((f) => `${t.name}: ${f}`));
  writeFileSync(path.join(dir, 'timeline.json'), JSON.stringify(info, null, 2));
  const sums = ['timeline.json', ...SCREEN_TAKES.map((t) => t.video)].filter((f) => existsSync(path.join(dir, f)))
    .map((f) => `${sha256Of(readFileSync(path.join(dir, f)))}  ${f}`);
  writeFileSync(path.join(dir, 'SHA256SUMS'), `${sums.join('\n')}\n`);
  console.log(sums.join('\n'));
}

if (SCREEN) {
  if (explained) await screenTakes();
  await finish();
}

// --- Film 4 and the git lesson (Marketing): the person's own code pasted into the panel at Beginner ---------------
// This capture branch (media/film4-paste) runs only these takes unless MEDIA_TAKES=all. Each text is Marketing's
// sample, word for word: checked against its sha256 before it is sent, and recorded in timeline.json.
// film4: retry.ts L11-26, then the login-callback hunk. gitlesson (take 3): the hunk, then a typed follow-up, with no
// still between them, so the take runs straight on.
if (TAKES === 'film4' || TAKES === 'gitlesson') {
  if (explained && TAKES === 'film4') {
    await pasteTake('film4 retry.ts 11-26', FILM4_TAKES.retry, 'withRetry');
    await pasteTake('film4 login-callback hunk', FILM4_TAKES.diff, 'GET(req');
  }
  if (explained && TAKES === 'gitlesson') {
    if (await pasteTake('git lesson hunk', FILM4_TAKES.diff, 'GET(req', { still: false })) {
      await followUpTake('git lesson follow-up', 'Could this change break login?');
    }
  }
  await finish();
}

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
    const question = 'Why does it call clearTimeout before setTimeout?';
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
    const done = await settledPanel();
    // The answer goes under the explanation (0.1.49 opens it with a "Short answer" heading; earlier builds used the
    // question as its heading): bring that start to the top of the panel, so the still shows the answer, not the end.
    const found = await done.locator('.body').evaluate((body) => {
      const blocks = [...body.querySelectorAll('h1, h2, h3, h4, strong, p')];
      const heading = blocks.find((el) => /^short answer$/i.test((el.textContent ?? '').trim())) ?? blocks.find((el) => /clearTimeout before/i.test(el.textContent ?? ''));
      if (!heading) return false;
      body.scrollTo({ top: Math.max(0, heading.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 14) });
      return true;
    });
    if (!found) throw new Error('the follow-up question is not in the panel');
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

await finish();

/** Ends every recording, closes the app, writes timeline.json and snippets.json, and exits (1 if a step failed). */
async function finish() {
  for (const v of videos) v.stop();
  await app.close();
  // Every recording was ended above; wait for the encoders to write their files.
  await Promise.race([Promise.all(videos.map((v) => v.done)), sleep(30000)]);
  const files = videos.map((v) => ({ window: v.window, opened: v.opened, closed: v.closed, path: existsSync(v.path) ? v.path : null }));
  writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ version, takes: TAKES, marks, videos: files, failures, pasted }, null, 2));
  writeFileSync(path.join(out, 'snippets.json'), JSON.stringify({ version, snippets }, null, 2));
  console.log(JSON.stringify({ version, failures, videos: files }, null, 2));
  process.exit(failures.length ? 1 : 0);
}
