// One real panel capture for Marketing's code-history ep02 reel (request 20261028-1601): the released
// app explaining a two-line Postgres row-level-security policy at the default free depth.
// Same method as marketing-media.mjs: the installed release build and the hosted AI; nothing mocked.
// It takes up to 3 takes (each a fresh explanation of the same file) and saves each take's panel and
// text, so a take whose wording calls the policy secure or vulnerable can be discarded.
//   UNVIBE_EXE=... MEDIA_DIR=... MEDIA_INSTALL_ID=... node rls-panel-capture.mjs
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
const BANNED = /\b(in)?secure\b|vulnerab/i;

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
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'unvibe-rls-src-')));
  const file = path.join(dir, 'profiles_policy.sql');
  writeFileSync(file, 'create policy "Users read own rows" on profiles\nfor select using ( (select auth.uid()) = user_id );\n');
  await app.evaluate(({ dialog }, picked) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [picked] }); }, file);

  for (let take = 1; take <= 3; take += 1) {
    const picked = await (await windowWith('widget.html')).evaluate(() => window.unvibe.pickFile());
    if (!picked?.ok) throw new Error(`file pick failed: ${picked?.error ?? 'cancelled'}`);
    await (await windowWith('widget.html')).locator('.code-context').filter({ hasText: 'auth.uid()' }).first().waitFor({ timeout: 30000 });
    const panel = await settledPanel();
    const level = await panel.locator('.lvl[aria-pressed="true"], .lvl.is-active, .lvl[aria-checked="true"]').first().getAttribute('data-level').catch(() => null);
    await panel.locator('.body').evaluate((el) => el.scrollTo({ top: 0 }));
    await sleep(600);
    const text = await panel.locator('.body').innerText();
    const whole = await panel.locator('body').innerText();
    const banned = BANNED.test(whole);
    await panel.screenshot({ path: path.join(shots, `panel-rls-take${take}.png`), animations: 'disabled' });
    writeFileSync(path.join(shots, `panel-rls-take${take}.txt`), `level=${level}\nbanned=${banned}\n\n${whole}\n`);
    result.takes.push({ take, level, banned, chars: text.length });
    console.log(`take ${take}: level=${level} banned=${banned} chars=${text.length}`);
    if (!banned) break;
  }
} catch (e) {
  result.error = e.message.split('\n')[0];
  console.log(`FAIL ${result.error}`);
}
await app.close();
writeFileSync(path.join(out, 'rls-result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
process.exit(result.error || !result.takes.some((t) => !t.banned) ? 1 : 0);
