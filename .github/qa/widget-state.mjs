// qa-admin-win.yml: reads Unvibe's panel (widget.html) through the app's debug port and prints one JSON line: its text
// (cut to 600 chars), whether it shows the admin note, the usual no-selection picker, or a marker (the captured code),
// and the app's own answer about the last press (window.unvibe.captureBlock(), main's perms:captureBlock: 'elevated'
// after a press at a window that runs as administrator, null otherwise).
// --click "<button>" presses that panel button first (Explain my clipboard). --close only closes the panel (the next
// row's press must open a fresh one: an open panel is restored as it was). It never opens or quits the app.
// Usage: node widget-state.mjs <userData> --expect admin|picker|marker [--marker <text>] [--click <name>] [--wait <ms>]
//        node widget-state.mjs <userData> --close
//   admin   wait until the admin note shows
//   picker  wait until the no-selection picker shows, then 2 s more, so a note that comes a moment later is seen
//   marker  wait until <text> shows in the panel
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const userData = args[0];
const opt = (k) => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : undefined; };
const expect = opt('--expect') ?? 'picker';
const marker = opt('--marker');
const click = opt('--click');
const close = args.includes('--close');
const wait = Number(opt('--wait') ?? 10000);
const ADMIN = "This window runs as administrator, so Unvibe can't copy from it. Copy the code yourself, then use Explain my clipboard.";
const PICKER = 'Ready when you are.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const done = (o) => { console.log(JSON.stringify(o)); process.exit(0); };

const portFile = path.join(userData, 'DevToolsActivePort');
if (!existsSync(portFile)) done({ ok: false, error: 'no DevToolsActivePort in the profile' });
const port = Number(readFileSync(portFile, 'utf8').split('\n')[0]);
let browser;
try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch (e) { done({ ok: false, error: `debug port: ${e.message.split('\n')[0]}` }); }
const context = browser.contexts()[0];
const widget = () => context.pages().find((p) => p.url().includes('widget.html') && !p.isClosed()) ?? null;
const textOf = async (w) => (w ? await w.evaluate(() => document.body.innerText).catch(() => '') : '');

if (close) {
  const w = widget();
  if (!w) done({ ok: true, closed: 'no panel open' });
  await w.evaluate(() => window.unvibe.closeWidget()).catch(() => {});
  for (let i = 0; i < 20 && widget(); i++) await sleep(250);
  done({ ok: !widget(), closed: widget() ? 'still open after 5 s' : 'closed' });
}

let clicked = null;
if (click) {
  const w = widget();
  if (!w) done({ ok: false, error: `no panel to press '${click}' in` });
  try {
    await w.getByRole('button', { name: click, exact: true }).click({ timeout: 4000 });
    clicked = 'pointer';
  } catch {
    // A panel window the OS has hidden after losing focus still has its page: press the button in the page itself.
    clicked = await w.evaluate((name) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === name);
      if (!b) return null;
      b.click();
      return 'dom';
    }, click).catch(() => null);
    if (!clicked) done({ ok: false, error: `no '${click}' button in the panel`, text: (await textOf(w)).replace(/\s+/g, ' ').slice(0, 600) });
  }
}

const start = Date.now();
let text = '';
let w = null;
while (Date.now() - start < wait) {
  w = widget();
  text = await textOf(w);
  if (expect === 'admin' && text.includes(ADMIN)) break;
  if (expect === 'marker' && marker && text.includes(marker)) break;
  if (expect === 'picker' && text.includes(PICKER)) { await sleep(2000); text = await textOf(widget()); break; }
  await sleep(250);
}
// The app's own answer, asked the way the panel asks it (IPC perms:captureBlock): 'elevated' | null | another block.
const block = w ? await w.evaluate(() => window.unvibe.captureBlock()).catch((e) => `error: ${e.message.split('\n')[0]}`) : 'no panel';
done({
  ok: true,
  clicked,
  url: w?.url() ?? null,
  captureBlock: block,
  adminNote: text.includes(ADMIN),
  usualPicker: text.includes(PICKER),
  marker: marker ? text.includes(marker) : null,
  ms: Date.now() - start,
  text: text.replace(/\s+/g, ' ').slice(0, 600),
});
