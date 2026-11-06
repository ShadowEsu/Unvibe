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

// Every Island notice as the app draws it (bar.html): text, the screen-reader copy, the dot colour, the class, when.
const islandBar = await app.windowWith('bar.html', 15000);
if (islandBar) {
  await islandBar.evaluate(() => {
    if (window.__qaNotes) return;
    window.__qaNotes = []; let last = null;
    const read = () => {
      const n = document.querySelector('.island__notice');
      const text = (n?.textContent || '').trim();
      const sr = (document.querySelector('.island__sr')?.textContent || '').trim();
      if (text + '|' + sr === last) return; last = text + '|' + sr;
      window.__qaNotes.push({ at: Date.now(), text, sr, dot: n ? getComputedStyle(n, '::before').backgroundColor : null, cls: n ? n.className : null });
    };
    new MutationObserver(read).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    read();
  }).catch((e) => note(`Island notice log: ${e.message.split('\n')[0]}`));
}
const islandNotes = async () => (islandBar ? await islandBar.evaluate(() => window.__qaNotes || []).catch(() => []) : []);

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
    // Design #213/#219: the Island's count after the first real explanation, as the app itself draws it.
    const bar = await app.windowWith('bar.html', 5000);
    if (!bar) note('Island: no bar.html window');
    else {
      await sleep(3000); // let the usage snapshot after the explanation reach the Island
      const count = (await bar.locator('.island__left').innerText({ timeout: 5000 }).catch(() => '')).replace(/\s+/g, ' ').trim();
      note(`Island count after the first explanation: '${count || 'none shown'}'`);
      try { await bar.locator('.island').first().screenshot({ path: path.join(out, 'explain-island-after.png') }); }
      catch (e) { note(`Island shot: ${e.message.split('\n')[0]}`); }
      desktop('4-island-after');
    }
    if (process.env.AGREE === '1' || process.env.NOTICES === '1') {
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

// NOTICES=1 (0.1.50 RC-3, the lead's notice rows): success is silent, a problem is amber, and a problem right after an
// explanation still shows (notify's 15 s gap must not let an info swallow it). Both explanations are real: the person's
// own code from the clipboard, then the same button with the clipboard empty ("Your clipboard is empty", main.ts).
if (process.env.NOTICES === '1' && panel) {
  const AMBER = 'rgb(245, 165, 36)'; // #f5a524, bar.css .island__notice::before at 3190b6d0
  const isProblem = (n) => /clipboard is empty/i.test(n.text || n.sr);
  const setClipboard = (text) => {
    if (os === 'mac') execFileSync('pbcopy', { input: text });
    else execFileSync('powershell', ['-NoProfile', '-STA', '-Command', `Add-Type -AssemblyName System.Windows.Forms; ${text ? '[System.Windows.Forms.Clipboard]::SetText($env:QA_CLIP)' : '[System.Windows.Forms.Clipboard]::Clear()'}`], { env: { ...process.env, QA_CLIP: text } });
  };
  try {
    await sleep(16000); // past notify's 15 s gap from any earlier notice
    setClipboard('function sum(list) {\n  let total = 0;\n  for (const n of list) total += n;\n  return total;\n}\n');
    const t1 = Date.now();
    await companion.evaluate(() => window.unvibe.explainClipboard());
    await panel.locator('.code-context code').filter({ hasText: 'function sum(list) {' }).first().waitFor({ timeout: 60000 });
    await panel.locator('.card--done .local-save-note:visible').first().waitFor({ timeout: 120000 });
    await panel.locator('.body .cursor').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    const tDone = Date.now();
    log(true, 'N-0 a second real explanation (own code from the clipboard)', `${Math.round((tDone - t1) / 100) / 10} s`);
    // At once: the same button with nothing copied.
    setClipboard('');
    const tP = Date.now();
    await companion.evaluate(() => window.unvibe.explainClipboard());
    let problem = null;
    for (let i = 0; i < 60 && !problem; i++) { await sleep(250); problem = (await islandNotes()).find((n) => n.at >= tP && isProblem(n)) ?? null; }
    if (problem && islandBar) {
      await islandBar.locator('.island').first().screenshot({ path: path.join(out, 'explain-notice-problem.png') }).catch(() => {});
      desktop('5-notice-problem');
    }
    await sleep(10000); // anything the explanation still shows after it, and the problem's own 9 s
    const all = await islandNotes();
    writeFileSync(path.join(out, 'island-notices.json'), JSON.stringify(all.map((n) => ({ ...n, sinceSecondExplain: Math.round((n.at - t1) / 100) / 10 })), null, 1));
    const others = all.filter((n) => n.at >= t1 && (n.text || n.sr) && !isProblem(n));
    log(others.length === 0, 'N-1 success is silent: no notice from the second explanation', others.map((n) => `'${n.text || n.sr}' (dot ${n.dot}) at +${Math.round((n.at - t1) / 100) / 10} s`).join(' | '));
    log(!!problem, 'N-2 a problem right after an explanation still shows (not swallowed)', problem ? `'${problem.text || problem.sr}' ${Math.round((problem.at - tP) / 100) / 10} s after the press, ${Math.round((tP - tDone) / 100) / 10} s after the explanation finished` : `none within 15 s of the press; notices since the explanation: ${all.filter((n) => n.at >= t1).map((n) => `'${n.text || n.sr}'`).join(', ') || 'none'}`);
    if (problem) log(problem.dot === AMBER, 'N-3 the problem notice has the amber dot', `${problem.dot}; class '${problem.cls}'`);
    for (const n of all.filter((x) => x.text && !isProblem(x))) note(`info notice '${n.text}': dot ${n.dot} (amber is ${AMBER}); class '${n.cls}'`);
    // N-4 (#220): the expanded card's '% AI used' is the AI allowance, consistent with its 'N AI' left.
    if (islandBar) {
      await islandBar.locator('.island').first().click();
      await sleep(1500);
      const card = (await islandBar.locator('.island').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
      await islandBar.locator('.island').first().screenshot({ path: path.join(out, 'explain-card-220.png') }).catch(() => {});
      desktop('6-card-220');
      const pct = card.match(/(\d+)%\s*(AI used|used)/);
      const left = card.match(/(\d+)\s*AI\b/);
      note(`card text: ${card.slice(0, 300)}`);
      if (pct && left) {
        const used = 50 - Number(left[1]); // the trial's AI allowance: a fresh install shows '50 left' (server quota)
        const ok = pct[2] === 'AI used' && [Math.floor, Math.round, Math.ceil].some((f) => f((used / 50) * 100) === Number(pct[1]));
        log(ok, "N-4 (#220) the card's '% AI used' matches the allowance used", `'${pct[0]}' with '${left[0]}' left (${used} of 50 used = ${((used / 50) * 100).toFixed(1)}%)`);
      } else log(false, "N-4 (#220) the card shows '% AI used' and 'N AI'", `pct ${pct?.[0] ?? 'missing'}, left ${left?.[0] ?? 'missing'}`);
      await islandBar.keyboard.press('Escape').catch(() => {});
    }
  } catch (e) {
    log(false, 'N notice rows', e.message.split('\n')[0]);
    await shot(panel, 'notices-stuck'); desktop('notices-stuck');
  }
}
clearInterval(watch);
for (const d of dialogs) note(`native dialog answered: ${d}`);
log(errors.length === 0, 'no console or page errors in the app\'s own windows', errors.slice(0, 6).join(' | '));
note(`install id after: ${readStore(userData).installId ?? 'none'}`);
writeFileSync(path.join(out, 'explain-main-output.txt'), app.output.join(''));
await app.close();
finish();
