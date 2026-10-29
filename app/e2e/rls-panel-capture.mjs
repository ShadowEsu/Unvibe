// Real panel captures for Marketing's code-history reels: the released app explaining one code card.
// Presets (CAPTURE_PRESET): 'rls' (ep02, request 20261028-1601), 'flag' (ep03, 20261028-2155), 'workflow' (ep04, 20261029-0005), 'lint' (ep05, 20261029-0040), 'rust' (20261029-0100), 'ifreturn' (20261029-0105).
// Same method as marketing-media.mjs: the installed release build and the hosted AI; nothing mocked.
// Up to 3 takes (each a fresh explanation of the same file); each take's panel and text are saved, and
// a take whose answer uses a banned word (it would imply detection) is discarded and retaken.
//   UNVIBE_EXE=... MEDIA_DIR=... MEDIA_INSTALL_ID=... CAPTURE_PRESET=rls|flag node rls-panel-capture.mjs
import { _electron as electron } from 'playwright';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
if (!exe) throw new Error('Set UNVIBE_EXE to an installed release build');
const out = path.resolve(process.env.MEDIA_DIR ?? 'media');
const shots = path.join(out, 'shots');
mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PRESETS = {
  rls: {
    file: 'profiles_policy.sql',
    code: 'create policy "Users read own rows" on profiles\nfor select using ( (select auth.uid()) = user_id );\n',
    match: 'auth.uid()',
    level: null,
    banned: /\b(in)?secure\b|vulnerab/i,
  },
  // Beginner: the Intermediate answer carries a standard "Potential Risks" section the reel can't show.
  flag: {
    file: 'trade.js',
    code: 'if (flag) runLegacy();\n',
    match: 'runLegacy',
    level: 'beginner',
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|should (be )?remove|\bremove (it|this|the)\b|dead code/i,
  },
  // ep04 (request 20261029-0005): the frame is cropped above "Risks and Edge Cases", so only the text
  // before that heading is checked.
  workflow: {
    file: '.github/workflows/ci.yml',
    code: '      - run: npm ci\n',
    match: 'npm ci',
    level: 'beginner',
    scanUntil: 'Risks and Edge Cases',
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b/i,
  },
  // ep05 (request 20261029-0040): cropped above "Why it is here" (which comes before the Risks section).
  lint: {
    file: 'src/utils.js',
    code: '// eslint-disable-next-line no-unused-vars\n',
    match: 'eslint-disable',
    level: 'beginner',
    scanUntil: 'Why it is here',
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bhid(e|es|ing|den)\b/i,
  },
  // Request 20261029-0100: '?' returns the error to the caller; a take that says it panics or crashes is wrong.
  rust: {
    file: 'src/main.rs',
    code: 'let config = load_config()?;\n',
    match: 'load_config',
    level: 'beginner',
    scanUntil: 'Why it is here',
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bcrash|\bpanic/i,
  },
  ifreturn: {
    file: 'src/profile.js',
    code: 'if (!user) return;\n',
    match: '!user',
    level: 'beginner',
    scanUntil: 'Why it is here',
    // Marketing (ep07): an exact panel. 'empty' is not falsy for {} or [], so any take that calls a
    // value empty, or lists falsy values as a partial set, is retaken.
    banned: /\bbugs?\b|\bbuggy\b|\brisk|danger|vulnerab|\b(in)?secure\b|\bempty\b(?!\s+(string|text)\b)|falsy"?\s*\((?![^)]*\b0\b)[^)]*\)/i,
  },
};
const preset = PRESETS[process.env.CAPTURE_PRESET ?? 'rls'];
if (!preset) throw new Error(`unknown CAPTURE_PRESET ${process.env.CAPTURE_PRESET}`);
const NAME = process.env.CAPTURE_PRESET ?? 'rls';

const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-rls-'));
writeFileSync(path.join(userData, 'unvibe-store.json'), JSON.stringify({ installId: process.env.MEDIA_INSTALL_ID ?? 'rlscapture0001' }));
const app = await electron.launch({
  executablePath: exe,
  args: ['--force-device-scale-factor=2'],
  env: { ...process.env, UNVIBE_USER_DATA: userData },
  timeout: 90000,
});
const version = await app.evaluate(({ app }) => app.getVersion());
console.log(`app open ${version}`);

async function windowWith(part, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hit = app.windows().find((w) => w.url().includes(part) && !w.isClosed());
    if (hit) return hit;
    await sleep(250);
  }
  throw new Error(`${part} did not open`);
}
const button = (page, name) => page.getByRole('button', { name, exact: true }).first();

async function settledPanel() {
  const start = Date.now();
  while (Date.now() - start < 120000) {
    const panel = await windowWith('widget.html', 20000);
    try {
      if (await panel.getByText("Couldn't explain that").count()) throw new Error('explanation failed');
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

const result = { version, takes: [] };
try {
  // Onboarding with a neutral name, then the built-in sample so the panel exists.
  const companion = await windowWith('companion.html', 60000);
  await companion.waitForLoadState('domcontentloaded');
  await companion.locator('.ob2__count').filter({ hasText: '1 / 3' }).waitFor({ timeout: 20000 });
  await companion.getByPlaceholder('Your name').pressSequentially('Sam', { delay: 40 });
  await button(companion, "Let's go").click();
  await companion.locator('.ob2__count').filter({ hasText: '2 / 3' }).waitFor();
  await sleep(800);
  await button(companion, 'Explain this code').click();
  await windowWith('widget.html', 20000);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes('widget.html'))?.setSize(560, 720);
  });
  await settledPanel();

  // The episode's code card, exactly as the request gives it.
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'unvibe-capture-src-')));
  const file = path.join(dir, preset.file);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, preset.code);
  await app.evaluate(({ dialog }, picked) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [picked] }); }, file);

  for (let take = 1; take <= 3; take += 1) {
    const picked = await (await windowWith('widget.html')).evaluate(() => window.unvibe.pickFile());
    if (!picked?.ok) throw new Error(`file pick failed: ${picked?.error ?? 'cancelled'}`);
    await (await windowWith('widget.html')).locator('.code-context').filter({ hasText: preset.match }).first().waitFor({ timeout: 30000 });
    let panel = await settledPanel();
    if (preset.level) {
      await panel.locator(`.lvl[data-level="${preset.level}"]`).click();
      await sleep(1500);
      panel = await settledPanel();
    }
    const level = await panel.locator('.lvl[aria-pressed="true"], .lvl.is-active, .lvl[aria-checked="true"]').first().getAttribute('data-level').catch(() => null);
    await panel.locator('.body').evaluate((el) => el.scrollTo({ top: 0 }));
    await sleep(600);
    const text = await panel.locator('.body').innerText();
    const whole = await panel.locator('body').innerText();
    const cut = (s) => {
      const at = preset.scanUntil ? s.toLowerCase().indexOf(preset.scanUntil.toLowerCase()) : -1;
      return at >= 0 ? s.slice(0, at) : s;
    };
    const banned = preset.banned.test(cut(text)) || /\b(in)?secure\b|vulnerab|danger/i.test(cut(whole));
    await panel.screenshot({ path: path.join(shots, `panel-${NAME}-take${take}.png`), animations: 'disabled' });
    writeFileSync(path.join(shots, `panel-${NAME}-take${take}.txt`), `level=${level}\nbanned=${banned}\n\n${whole}\n`);
    result.takes.push({ take, level, banned, chars: text.length });
    console.log(`take ${take}: level=${level} banned=${banned} chars=${text.length}`);
    if (!banned) break;
  }
} catch (e) {
  result.error = e.message.split('\n')[0];
  console.log(`FAIL ${result.error}`);
}
await app.close();
writeFileSync(path.join(out, `${NAME}-result.json`), JSON.stringify({ preset: NAME, ...result }, null, 2));
console.log(JSON.stringify(result));
process.exit(result.error || !result.takes.some((t) => !t.banned) ? 1 : 0);
