// QA (BOSS, ledger 628): DRAFT #329's squircle corners against main, the same sections in the same engines.
// #329 sets `corner-shape: squircle` beside every 6-20 px radius and grows the radii 1.3x only inside
// `@supports (corner-shape: squircle)`. Where the browser lacks corner-shape (Safari), the page must not change.
//   WebKit (Playwright) at 1440x900 and 390x844: main vs #329 must be pixel-identical.
//   Safari (the runner's own, through safaridriver) at 1440: the same, plus what Safari says about corner-shape.
//   Chromium (Playwright) is the positive control: it draws corner-shape, so #329 must change pixels there.
// Each engine shoots main twice ("main2") to show how much a page differs from itself.
// Sites are local builds (MAIN, PR). Nothing is signed in, installed or sent; no hosted-AI call.
import { chromium, webkit } from 'playwright';
import { PNG } from 'pngjs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT;
const SITES = { main: process.env.MAIN, main2: process.env.MAIN, pr: process.env.PR };
const TAKES = ['main', 'main2', 'pr'];
mkdirSync(OUT, { recursive: true });

const report = [];
let fails = 0;
function log(kind, what, detail = '') {
  report.push(`${kind.padEnd(5)} ${what}${detail ? `  ${detail}` : ''}`);
  if (kind === 'FAIL') fails += 1;
  console.log(report.at(-1));
}

const SECTIONS = [
  { id: 'home-hero', path: '/', sel: '.d-hero' },
  { id: 'home-download', path: '/', sel: '.d-get' },
  { id: 'home-faq', path: '/', sel: '#faq' },
  { id: 'beta-download-card', path: '/beta', sel: '.dd' },
];
const VIEWPORTS = [
  { id: '1440', opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  { id: '390', opts: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
];
const url = (take, p) => `${SITES[take]}${p}?notrack=1`;

// Animations and transitions off, videos paused at 0, so a page shot twice is the same page.
const STILL = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
const SETTLE = `const s = document.createElement('style'); s.textContent = ${JSON.stringify(STILL)}; document.head.appendChild(s);
document.querySelectorAll('video').forEach((v) => { v.pause(); v.currentTime = 0; });`;
const PROBE = `(() => {
  const faq = document.querySelector('.d-faq__item');
  const cs = faq && getComputedStyle(faq);
  return {
    supports: CSS.supports('corner-shape', 'squircle'),
    k: getComputedStyle(document.documentElement).getPropertyValue('--squircle-k').trim() || '(unset, so 1)',
    faqRadius: cs ? cs.borderTopLeftRadius : 'no .d-faq__item',
    viewport: innerWidth + 'x' + innerHeight + ' @' + devicePixelRatio,
    ua: navigator.userAgent,
  };
})()`;
const probeLine = (p) => `CSS.supports('corner-shape','squircle')=${p.supports}; --squircle-k ${p.k}; .d-faq__item radius ${p.faqRadius}; viewport ${p.viewport}; ${p.ua}`;

function compare(fileA, fileB, diffFile) {
  const a = PNG.sync.read(readFileSync(fileA));
  const b = PNG.sync.read(readFileSync(fileB));
  if (a.width !== b.width || a.height !== b.height) return { same: false, text: `size ${a.width}x${a.height} vs ${b.width}x${b.height}` };
  const d = new PNG({ width: a.width, height: a.height });
  let n = 0, max = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let i = 0; i < a.data.length; i += 4) {
    const delta = Math.max(...[0, 1, 2, 3].map((c) => Math.abs(a.data[i + c] - b.data[i + c])));
    if (delta) {
      const p = i / 4, x = p % a.width, y = Math.floor(p / a.width);
      n += 1; max = Math.max(max, delta);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      d.data.set([255, 0, 0, 255], i);
    } else {
      const g = Math.round(170 + ((a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3) * 0.33);
      d.data.set([g, g, g, 255], i);
    }
  }
  if (n && diffFile) writeFileSync(diffFile, PNG.sync.write(d));
  const total = a.width * a.height;
  return n
    ? { same: false, text: `${n} of ${total} px differ (max channel delta ${max}), box ${x0},${y0} ${x1 - x0 + 1}x${y1 - y0 + 1}${diffFile ? `, ${path.basename(diffFile)}` : ''}` }
    : { same: true, text: `identical, ${a.width}x${a.height}` };
}

// One verdict per engine, viewport and section. expectChange: Chromium (positive control); else must be identical.
function judge(engine, vpId, files, expectChange) {
  let changed = 0;
  for (const s of SECTIONS) {
    const f = (take) => files[`${vpId}|${s.id}|${take}`];
    if (!f('main') || !f('pr')) { log('FAIL', `${engine} ${vpId} ${s.id}`, 'a shot is missing (see above)'); continue; }
    const self = f('main2') ? compare(f('main'), f('main2'), null) : null;
    const d = compare(f('main'), f('pr'), path.join(OUT, `diff-${engine}-${vpId}-${s.id}.png`));
    const selfText = self ? `; main vs main again: ${self.text}` : '';
    if (expectChange) {
      if (!d.same) changed += 1;
      log('NOTE', `${engine} ${vpId} ${s.id}: main vs #329`, `${d.text}${selfText}`);
    } else {
      log(d.same ? 'PASS' : 'FAIL', `${engine} ${vpId} ${s.id}: main vs #329 pixel-identical`, `${d.text}${selfText}`);
    }
  }
  if (expectChange) log(changed ? 'PASS' : 'FAIL', `${engine} ${vpId}: positive control, #329 changes pixels where corner-shape is drawn`, `${changed} of ${SECTIONS.length} sections changed`);
}

async function playwrightEngine(type, engine) {
  const browser = await type.launch();
  log('NOTE', `${engine} ${browser.version()}`);
  try {
    for (const vp of VIEWPORTS) {
      const files = {};
      for (const take of TAKES) {
        const context = await browser.newContext({ ...vp.opts, reducedMotion: 'reduce' });
        const page = await context.newPage();
        let at = '';
        try {
          for (const s of SECTIONS) {
            const file = path.join(OUT, `${engine}-${vp.id}-${s.id}-${take}.png`);
            try {
              if (at !== s.path) {
                await page.goto(url(take, s.path), { waitUntil: 'load' });
                await page.evaluate(`(() => { ${SETTLE} })()`);
                await page.evaluate(() => document.fonts.ready.then(() => true));
                await page.waitForTimeout(1500);
                at = s.path;
                if (s.path === '/' && take !== 'main2') log('NOTE', `${engine} ${vp.id} ${take} probe`, probeLine(await page.evaluate(PROBE)));
              }
              const el = page.locator(s.sel).first();
              await el.scrollIntoViewIfNeeded();
              await page.waitForTimeout(800);
              await el.screenshot({ path: file, animations: 'disabled' });
              files[`${vp.id}|${s.id}|${take}`] = file;
            } catch (e) { log('FAIL', `${engine} ${vp.id} ${s.id} (${take}): shot`, firstLine(e)); }
          }
        } finally { await context.close(); }
      }
      judge(engine, vp.id, files, engine === 'chromium');
    }
  } finally { await browser.close(); }
}

// The runner's real Safari through W3C WebDriver (safaridriver on 127.0.0.1:4444).
async function wd(method, p, body) {
  const r = await fetch(`http://127.0.0.1:4444${p}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p}: ${j.value?.error ?? r.status} ${j.value?.message ?? ''}`.slice(0, 240));
  return j.value;
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function safari() {
  let sid;
  try {
    sid = (await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } })).sessionId;
  } catch (e) { log('NOTE', 'Safari: no WebDriver session, so no Safari shots', e.message); return; }
  const files = {};
  try {
    await wd('POST', `/session/${sid}/window/rect`, { x: 0, y: 0, width: 1440, height: 1000 });
    for (const take of TAKES) {
      let at = '';
      for (const s of SECTIONS) {
        const file = path.join(OUT, `safari-1440-${s.id}-${take}.png`);
        try {
          if (at !== s.path) {
            await wd('POST', `/session/${sid}/url`, { url: url(take, s.path) });
            await wd('POST', `/session/${sid}/execute/sync`, { script: `${SETTLE} return true;`, args: [] });
            await wd('POST', `/session/${sid}/execute/async`, { script: 'const done = arguments[arguments.length - 1]; document.fonts.ready.then(() => done(true));', args: [] });
            await sleep(1500);
            at = s.path;
            if (s.path === '/' && take !== 'main2') log('NOTE', `safari 1440 ${take} probe`, probeLine(await wd('POST', `/session/${sid}/execute/sync`, { script: `return ${PROBE};`, args: [] })));
          }
          const el = await wd('POST', `/session/${sid}/element`, { using: 'css selector', value: s.sel });
          await wd('POST', `/session/${sid}/execute/sync`, { script: 'arguments[0].scrollIntoView({ block: "start" }); return true;', args: [el] });
          await sleep(800);
          const png = await wd('GET', `/session/${sid}/element/${Object.values(el)[0]}/screenshot`);
          writeFileSync(file, Buffer.from(png, 'base64'));
          files[`1440|${s.id}|${take}`] = file;
        } catch (e) { log('FAIL', `safari 1440 ${s.id} (${take}): shot`, firstLine(e)); }
      }
    }
  } finally { await wd('DELETE', `/session/${sid}`).catch(() => {}); }
  judge('safari', '1440', files, false);
}

// One engine failing to start must not hide the others' results.
const firstLine = (e) => e.message.split('\n').map((l) => l.trim()).find(Boolean) ?? String(e);
for (const [name, run] of [['webkit', () => playwrightEngine(webkit, 'webkit')], ['safari', safari], ['chromium', () => playwrightEngine(chromium, 'chromium')]]) {
  try { await run(); } catch (e) { log('FAIL', `${name}: stopped`, firstLine(e)); }
}
log(fails ? 'FAIL' : 'PASS', `squircle check: ${fails} FAIL`);
writeFileSync(path.join(OUT, 'report.txt'), `${report.join('\n')}\n`);
process.exit(fails ? 1 : 0);
