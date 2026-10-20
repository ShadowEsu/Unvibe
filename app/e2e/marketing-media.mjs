// Records the real app for the website: screenshots of each screen and raw window videos of one
// genuine session (first explanation, depth switch, follow-up, Test me, companion pages).
// Everything shown is produced live by the installed app and the hosted AI; nothing is mocked.
// A release build is needed (it carries the trial token); a plain local build cannot explain.
//
// Run from a folder where `playwright` is installed (CI does this in real-device-test.yml):
//   UNVIBE_EXE=/Applications/Unvibe.app/Contents/MacOS/Unvibe MEDIA_DIR=/tmp/uv-media node marketing-media.mjs
// Env: UNVIBE_EXE (installed app executable), MEDIA_DIR (output folder), MEDIA_INSTALL_ID (reused
//      so repeated captures count as one install in founder stats).
import { _electron as electron } from 'playwright';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId: process.env.MEDIA_INSTALL_ID ?? 'marketingcapture0001' }));

const app = await electron.launch({
  executablePath: exe,
  // Retina-sharp screenshots on runners whose display is 1x.
  args: ['--force-device-scale-factor=2'],
  env: { ...process.env, UNVIBE_USER_DATA: userData },
  recordVideo: { dir: raw, size: { width: 1280, height: 800 } },
  timeout: 90000,
});
const version = await app.evaluate(({ app }) => app.getVersion());
const seen = new Set();
const videos = [];
const remember = (page) => {
  if (seen.has(page)) return;
  seen.add(page);
  const opened = (Date.now() - t0) / 1000;
  page.once('close', () => { videos.push({ window: page.url().split('/').pop()?.split('?')[0], opened, closed: (Date.now() - t0) / 1000, video: page.video() }); });
};
app.on('window', remember);
app.windows().forEach(remember);

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

const companion = await windowWith('companion.html', 60000);
await companion.waitForLoadState('domcontentloaded');
await app.evaluate(({ BrowserWindow }) => {
  const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('companion.html'));
  win?.setSize(1280, 800);
  win?.center();
});
mark(`app open ${version}`);

// --- First run: the real onboarding and the first explanation ---------------------------------
const firstRun = await step('onboarding', async () => {
  await companion.locator('.ob2__count').filter({ hasText: '1 / 3' }).waitFor({ timeout: 20000 });
  await sleep(800);
  await shot(companion, 'onboarding-hello');
  await companion.getByPlaceholder('Your name').pressSequentially('Preston', { delay: 70 });
  await button(companion, "Let's go").click();
  await companion.locator('.ob2__count').filter({ hasText: '2 / 3' }).waitFor();
  await sleep(1200);
  await shot(companion, 'onboarding-try-it');
  await button(companion, 'Explain this code').click();
});

const explained = firstRun && await step('first explanation', async () => {
  const panel = await windowWith('widget.html', 20000);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('widget.html'))?.setSize(560, 720);
  });
  await panel.locator('.body .cursor').waitFor({ timeout: 60000 }).catch(() => {});
  await sleep(2500);
  await shot(panel, 'panel-streaming');
  await shot(await settledPanel(), 'panel-explained');
});

if (explained) {
  await step('beginner depth', async () => {
    await (await windowWith('widget.html')).locator('.lvl[data-level="beginner"]').click();
    await sleep(1500);
    await shot(await settledPanel(), 'panel-beginner');
  });
  await step('follow-up', async () => {
    const ask = (await windowWith('widget.html')).getByLabel('Follow-up question');
    await ask.click();
    await ask.pressSequentially('What happens if I call it five times quickly?', { delay: 45 });
    await ask.press('Enter');
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
}

// --- Finish onboarding and tour the companion ------------------------------------------------
await step('today', async () => {
  await companion.bringToFront();
  if (await companion.locator('.ob2__count').count()) {
    await button(companion, 'Next').click();
    await companion.locator('.ob2__count').filter({ hasText: '3 / 3' }).waitFor();
    await sleep(1000);
    await shot(companion, 'onboarding-anywhere');
    await button(companion, 'Start using Unvibe').click();
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
  await companion.locator('.chat-thinking').waitFor({ timeout: 10000 }).catch(() => {});
  await companion.locator('.chat-thinking').waitFor({ state: 'detached', timeout: 90000 });
  await sleep(2000);
  await shot(companion, 'ask-vibe-answer');
});

await step('settings privacy', async () => {
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

await app.close();
await sleep(500);
const files = [];
for (const v of videos) files.push({ window: v.window, opened: v.opened, closed: v.closed, path: await v.video?.path().catch(() => null) });
writeFileSync(path.join(out, 'timeline.json'), JSON.stringify({ version, marks, videos: files, failures }, null, 2));
console.log(JSON.stringify({ version, failures, videos: files }, null, 2));
process.exit(failures.length ? 1 : 0);
