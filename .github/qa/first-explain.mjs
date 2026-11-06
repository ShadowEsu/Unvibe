// QA install matrix (qa-install-matrix.yml): after an install path's own first launch, start the installed app
// again through its debug port (app/e2e/cdp-launch.mjs) on the SAME profile the first launch made, and do what a
// new user does first: name → "Let's go" → "Explain this code" on the built-in sample, then wait for a complete
// AI explanation. The sample needs no sign-in and no send agreement (core/consent.ts isFirstRunSamplePayload).
//
// Env: UNVIBE_EXE (installed executable), USER_DATA (the profile the first launch used), OUT (shots + report),
//      UNVIBE_OS (mac | windows). Writes OUT/explain-report.txt; exit 1 on any FAIL.
import { launchApp, readStore } from './cdp-launch.mjs';
import { execFile, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const exe = process.env.UNVIBE_EXE;
const userData = process.env.USER_DATA;
const out = process.env.OUT;
const os = process.env.UNVIBE_OS;
mkdirSync(out, { recursive: true });
const report = [];
let fails = 0;
const log = (ok, step, detail = '') => { if (!ok) fails++; report.push(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `: ${detail}` : ''}`); console.log(report.at(-1)); };
const note = (s) => { report.push(`NOTE  ${s}`); console.log(report.at(-1)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const finish = () => { writeFileSync(path.join(out, 'explain-report.txt'), `${report.join('\n')}\n`); process.exit(fails ? 1 : 0); };

function desktop(label) {
  const file = path.join(out, `explain-desktop-${label}.png`);
  try {
    if (os === 'mac') execFileSync('screencapture', ['-x', file]);
    else execFileSync('powershell', ['-NoProfile', '-Command',
      `Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${file}')`]);
  } catch (e) { note(`desktop shot ${label}: ${e.message.split('\n')[0]}`); }
}
async function shot(page, label) {
  try { await page.screenshot({ path: path.join(out, `explain-${label}.png`) }); } catch (e) { note(`shot ${label}: ${e.message.split('\n')[0]}`); }
}

const store = readStore(userData);
note(`profile ${userData}; install id before launch: ${store.installId ?? 'none'}`);
if (!String(store.installId ?? '').startsWith('qa-')) { log(false, 'install id is qa-prefixed before the debug launch', String(store.installId)); finish(); }

const started = Date.now();
let app;
try {
  app = await launchApp({ exe, userData, timeout: 120000 });
} catch (e) { log(false, 'app starts with its debug port', e.message.split('\n')[0]); desktop('no-debug-port'); finish(); }
log(true, 'app starts with its debug port', `${Math.round((Date.now() - started) / 100) / 10} s`);

// The app's own native dialogs (launch-at-login and the like) on macOS: read, keep, answer No/Cancel/OK.
const dialogs = [];
const watch = os === 'mac' ? setInterval(() => {
  execFile('osascript', ['-e', `tell application "System Events"
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
end tell`], (err, stdout) => { if (!err) for (const m of String(stdout).split('|').map((x) => x.trim()).filter(Boolean)) dialogs.push(m); });
}, 1500) : null;

const errors = [];
app.onWindow((page) => {
  page.on('console', (m) => { if (m.type() === 'error' && !/^https?:/.test(page.url())) errors.push(`console ${page.url().split('/').pop()}: ${m.text().slice(0, 200)}`); });
  page.on('pageerror', (e) => errors.push(`pageerror ${page.url().split('/').pop()}: ${e.message.split('\n')[0]}`));
});
const companion = await app.windowWith('companion.html', 60000);
if (!companion) { log(false, 'companion window opens'); desktop('no-companion'); await app.close(); finish(); }
await companion.waitForLoadState('domcontentloaded');
const info = await companion.evaluate(() => window.unvibe?.appInfo?.()).catch(() => null);
log(true, 'companion window opens', `version ${info?.version ?? 'unknown'}`);
await sleep(1500);
await shot(companion, '1-first-screen');
desktop('1-first-screen');

const steps = os === 'windows' ? 3 : 4;
try {
  await companion.locator('.ob2__count').filter({ hasText: `1 / ${steps}` }).waitFor({ timeout: 20000 });
  await companion.getByPlaceholder('Your name').fill('QA Matrix');
  await companion.getByRole('button', { name: "Let's go", exact: true }).click({ timeout: 8000 });
  await companion.locator('.ob2__count').filter({ hasText: `2 / ${steps}` }).waitFor({ timeout: 8000 });
  await shot(companion, '2-try-it');
  await companion.getByRole('button', { name: 'Explain this code', exact: true }).click({ timeout: 8000 });
  log(true, 'onboarding: hello, then "Explain this code" on the sample');
} catch (e) {
  log(false, 'onboarding: hello, then "Explain this code" on the sample', e.message.split('\n')[0]);
  await shot(companion, 'onboarding-stuck'); desktop('onboarding-stuck');
}
const clicked = Date.now();

const panel = await app.windowWith('widget.html', 20000);
if (!panel) log(false, 'the review panel opens');
else {
  try {
    await panel.locator('.code-context code').filter({ hasText: 'function debounce(fn, wait) {' }).waitFor({ timeout: 30000 });
    await panel.locator('.card--done .local-save-note').waitFor({ timeout: 120000 });
    await panel.locator('.body .cursor').waitFor({ state: 'detached', timeout: 30000 });
    const body = await panel.locator('.body').innerText();
    const code = await panel.locator('.code-context').innerText();
    const text = body.replace(code, '').trim();
    const s = Math.round((Date.now() - clicked) / 100) / 10;
    const total = Math.round((Date.now() - started) / 100) / 10;
    log(text.length > 80, 'a complete AI explanation of the sample', `${text.length} characters, ${s} s after the click, ${total} s after launch`);
    writeFileSync(path.join(out, 'explanation.txt'), `${text}\n`);
    await shot(panel, '3-explanation');
    desktop('3-explanation');
    if (process.env.AGREE === '1') {
      // One question of the person's own: the send agreement comes first; its three boxes are ticked, so the profile
      // holds a consent record (unvibe-consent.json) for an upgrade check to compare.
      const row = panel.locator('.askrow');
      await row.getByLabel('Follow-up question').fill('Why clear the timer first?');
      await row.getByRole('button', { name: 'Ask', exact: true }).click();
      const form = panel.locator('.consent-form');
      await form.waitFor({ timeout: 15000 });
      const boxes = form.locator('input[type="checkbox"]');
      for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
      await form.getByRole('button', { name: 'Continue', exact: true }).click();
      await form.waitFor({ state: 'detached', timeout: 10000 });
      log(true, 'send agreement ticked (AGREE=1)');
      await sleep(1500);
    }
  } catch (e) {
    log(false, 'a complete AI explanation of the sample', e.message.split('\n')[0]);
    await shot(panel, 'explanation-stuck'); desktop('explanation-stuck');
    const t = await panel.locator('body').innerText().catch(() => '');
    note(`panel text: ${t.replace(/\s+/g, ' ').slice(0, 400)}`);
  }
}
clearInterval(watch);
for (const d of dialogs) note(`native dialog answered: ${d}`);
log(errors.length === 0, 'no console or page errors in the app\'s own windows', errors.slice(0, 6).join(' | '));
note(`install id after: ${readStore(userData).installId ?? 'none'}`);
writeFileSync(path.join(out, 'explain-main-output.txt'), app.output.join(''));
await app.close();
finish();
