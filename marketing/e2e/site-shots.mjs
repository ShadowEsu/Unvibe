// Screenshot and accessibility sweep of the marketing site, for review before a release.
// For every route × viewport × theme it scrolls the page (so lazy images and reveal observers fire),
// saves a top-of-page and a full-page screenshot, runs axe-core, and records console errors, failed
// requests, horizontal overflow and headings hidden under the fixed top bar.
//
// Run against an already running site (this script never starts one):
//   NODE_PATH=/tmp/pw-webkit/node_modules node marketing/e2e/site-shots.mjs
// Env: BASE_URL (default http://127.0.0.1:3000), OUT_DIR (default /tmp/uv-site-shots),
//      ROUTES (optional comma list, e.g. "/,/pricing"), AXE_PATH (default: marketing/node_modules/axe-core/axe.min.js).
// Writes OUT_DIR/report.json and OUT_DIR/report.md. Exits 1 on any serious/critical axe violation,
// console error, failed request, horizontal overflow or page that could not be checked.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// A bare ESM `import 'playwright'` ignores NODE_PATH; require() honours it.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const OUT_DIR = process.env.OUT_DIR || '/tmp/uv-site-shots';
const AXE_PATH = process.env.AXE_PATH || fileURLToPath(new URL('../node_modules/axe-core/axe.min.js', import.meta.url));
const DEFAULT_ROUTES = ['/', '/beta', '/pricing', '/resources', '/about', '/releases', '/install-help', '/app', '/kit',
  '/privacy', '/terms', '/rewards', '/activate', '/waitlist', '/nonexistent-404'];
const ROUTES = process.env.ROUTES
  ? process.env.ROUTES.split(',').map((r) => r.trim()).filter(Boolean).map((r) => (r.startsWith('/') ? r : `/${r}`))
  : DEFAULT_ROUTES;
const HOME_ANCHORS = ['tour', 'product', 'install'];
const NAV_HEIGHT = 64; // .mnav is 4rem tall
const PARALLEL = 2;
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844, mobile: true },
  { width: 320, height: 640 },
];

const ANALYTICS_HOST = /(^|\.)(mixpanel\.com|posthog\.com|google-analytics\.com|googletagmanager\.com|doubleclick\.net|vercel-insights\.com)$/;
const isAnalytics = (url) => {
  try {
    const u = new URL(url);
    return ANALYTICS_HOST.test(u.hostname) || u.pathname.startsWith('/_vercel/');
  } catch { return false; }
};

if (!existsSync(AXE_PATH)) {
  console.error(`axe-core not found at ${AXE_PATH}. Set AXE_PATH or install marketing dependencies.`);
  process.exit(2);
}
mkdirSync(OUT_DIR, { recursive: true });

const slug = (route) => (route === '/' ? 'home' : route.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9-]+/gi, '_'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const jobs = [];
for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    for (const theme of ['light', 'dark']) jobs.push({ route, viewport, theme, reduced: false });
  }
}
if (ROUTES.includes('/')) jobs.push({ route: '/', viewport: VIEWPORTS[0], theme: 'light', reduced: true });

// The site's ThemeProvider pins light on mount, so dark is forced the same way it would apply it:
// the `dark` class and color-scheme on <html>, re-applied whenever something removes them.
function forceDark() {
  const root = document.documentElement;
  const apply = () => {
    if (!root.classList.contains('dark')) root.classList.add('dark');
    if (root.style.colorScheme !== 'dark') root.style.colorScheme = 'dark';
  };
  apply();
  new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
}

/** Scroll the whole page in steps so lazy images and intersection observers fire, then return to top. */
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    for (let i = 0, y = 0; i < 80 && y < document.documentElement.scrollHeight; i++, y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await pause(150);
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    await pause(300);
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await sleep(400);
}

/** Horizontal overflow and the widest element that sticks out past the viewport (outside any clipping box). */
function measureOverflow() {
  const iw = window.innerWidth;
  const sw = document.documentElement.scrollWidth;
  if (sw <= iw) return null;
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(p).overflowX)) return true;
    }
    return false;
  };
  const describe = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { parts.unshift(`${s}#${e.id}`); break; }
      const cls = [...e.classList].slice(0, 2).join('.');
      if (cls) s += `.${cls}`;
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  let worst = null;
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const over = Math.max(r.right - iw, -r.left);
    if (over > 1 && (!worst || over > worst.over) && !clipped(el)) worst = { over, el };
  }
  return {
    scrollWidth: sw,
    innerWidth: iw,
    widest: worst ? { selector: describe(worst.el), overBy: Math.round(worst.over) } : null,
  };
}

/** First heading in view whose top sits under the fixed top bar. */
function headingUnderNav(fallback) {
  const nav = document.querySelector('.mnav');
  const navBottom = nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().bottom : fallback;
  const main = document.querySelector('main') || document.body;
  const heading = [...main.querySelectorAll('h1, h2, h3')].find((h) => {
    const r = h.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  });
  if (!heading) return null;
  const top = heading.getBoundingClientRect().top;
  return top < navBottom ? { text: heading.textContent.trim().slice(0, 80), top: Math.round(top), navBottom: Math.round(navBottom) } : null;
}

async function runAxe(page) {
  await page.addScriptTag({ path: AXE_PATH });
  const result = await page.evaluate(() => window.axe.run(document, { resultTypes: ['violations'] }));
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    count: v.nodes.length,
    targets: v.nodes.slice(0, 2).map((n) => n.target.join(' ')),
  }));
}

async function runJob(browser, job) {
  const { route, viewport, theme, reduced } = job;
  const variant = `${theme}${reduced ? '-reduced' : ''}`;
  const base = `${slug(route)}-${viewport.width}-${variant}`;
  const res = {
    route, width: viewport.width, height: viewport.height, theme, reducedMotion: reduced,
    status: null, finalUrl: null, screenshots: [], axe: [], consoleErrors: [], failedRequests: [],
    overflow: null, underNav: [], notes: [], error: null,
  };
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    ...(viewport.mobile ? { userAgent: IPHONE_UA, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } : {}),
    colorScheme: theme,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    bypassCSP: true,
  });
  if (theme === 'dark') await context.addInitScript(forceDark);
  const page = await context.newPage();
  const expect404 = route === '/nonexistent-404';
  const docUrl = `${BASE_URL}${route}`;

  page.on('console', (m) => {
    if (m.type() !== 'error' || isAnalytics(m.location()?.url ?? '')) return;
    // The deliberate 404 route logs its own document status; that is the expected result, not an error.
    if (expect404 && /status of 404/.test(m.text()) && (m.location()?.url ?? '').startsWith(docUrl)) return;
    res.consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => res.consoleErrors.push(`pageerror: ${e.message.split('\n')[0].slice(0, 300)}`));
  page.on('response', (r) => {
    const req = r.request();
    if (r.status() < 400 || isAnalytics(r.url())) return;
    if (expect404 && req.isNavigationRequest() && req.frame() === page.mainFrame()) return;
    res.failedRequests.push({ url: r.url(), status: r.status() });
  });
  page.on('requestfailed', (req) => {
    const why = req.failure()?.errorText ?? '';
    // Media range requests and prefetches are routinely cancelled by the browser.
    if (isAnalytics(req.url()) || /ERR_ABORTED|NS_BINDING_ABORTED/.test(why)) return;
    res.failedRequests.push({ url: req.url(), status: why || 'failed' });
  });

  try {
    const response = await page.goto(docUrl, { waitUntil: 'load', timeout: 45000 });
    res.status = response?.status() ?? null;
    res.finalUrl = page.url();
    if (expect404 && res.status !== 404) res.notes.push(`expected HTTP 404, got ${res.status}`);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => res.notes.push('network never went idle within 10s'));
    await page.evaluate(() => document.fonts.ready.then(() => true));
    await scrollThrough(page);

    const top = `${base}-top.png`;
    await page.screenshot({ path: path.join(OUT_DIR, top), animations: 'disabled' });
    res.screenshots.push(top);
    const under = await page.evaluate(headingUnderNav, NAV_HEIGHT);
    if (under) res.underNav.push({ at: 'top', ...under });
    res.overflow = await page.evaluate(measureOverflow);

    const full = `${base}-full.png`;
    await page.screenshot({ path: path.join(OUT_DIR, full), fullPage: true, animations: 'disabled' });
    res.screenshots.push(full);

    if (route === '/') {
      for (const id of HOME_ANCHORS) {
        const found = await page.evaluate((anchor) => {
          const el = document.getElementById(anchor);
          if (!el) return false;
          el.scrollIntoView({ block: 'start', behavior: 'instant' });
          return true;
        }, id);
        if (!found) { res.notes.push(`#${id} not found`); continue; }
        await sleep(600);
        const file = `${base}-${id}.png`;
        await page.screenshot({ path: path.join(OUT_DIR, file), animations: 'disabled' });
        res.screenshots.push(file);
        const hidden = await page.evaluate(headingUnderNav, NAV_HEIGHT);
        if (hidden) res.underNav.push({ at: `#${id}`, ...hidden });
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await sleep(300);
    }

    res.axe = await runAxe(page);
  } catch (e) {
    res.error = e.message.split('\n')[0];
  } finally {
    await context.close().catch(() => {});
  }
  return res;
}

const browser = await chromium.launch();
const results = new Array(jobs.length);
let next = 0;
await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, async () => {
  while (next < jobs.length) {
    const i = next++;
    const j = jobs[i];
    results[i] = await runJob(browser, j);
    console.log(`${String(i + 1).padStart(3)}/${jobs.length} ${j.route} ${j.viewport.width} ${j.theme}${j.reduced ? ' reduced-motion' : ''}`);
  }
}));
await browser.close();

const serious = (r) => r.axe.filter((v) => v.impact === 'serious' || v.impact === 'critical');
const failures = (r) => [
  ...(r.error ? [`could not check: ${r.error}`] : []),
  ...serious(r).map((v) => `axe ${v.impact} ${v.id} (${v.count})`),
  ...r.consoleErrors.map((m) => `console: ${m}`),
  ...r.failedRequests.map((f) => `request ${f.status}: ${f.url}`),
  ...(r.overflow ? [`horizontal overflow ${r.overflow.scrollWidth}px > ${r.overflow.innerWidth}px${r.overflow.widest ? ` (${r.overflow.widest.selector}, +${r.overflow.widest.overBy}px)` : ''}`] : []),
];
const failing = results.filter((r) => failures(r).length > 0);

writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify({
  baseUrl: BASE_URL, generatedAt: new Date().toISOString(), axePath: AXE_PATH, pass: failing.length === 0, results,
}, null, 2));

const label = (r) => `\`${r.route}\` ${r.width}px ${r.theme}${r.reducedMotion ? ' reduced-motion' : ''}`;
const md = [
  `# Site shots: ${BASE_URL}`,
  '',
  `${results.length} page checks, ${failing.length} failing. Screenshots and report.json are in \`${OUT_DIR}\`.`,
  'Dark theme is forced through the `dark` class on `<html>` (the site itself currently pins light).',
  'Fails on: serious/critical axe violations, console errors, failed requests (analytics hosts excluded), horizontal overflow, or a page that could not be checked.',
  '',
  '## Failures',
  '',
  ...(failing.length ? failing.flatMap((r) => [`### ${label(r)}`, ...failures(r).map((f) => `- ${f}`), '']) : ['None.', '']),
  '## Warnings',
  '',
  ...results.flatMap((r) => [
    ...r.underNav.map((u) => `- ${label(r)} at ${u.at}: heading "${u.text}" top ${u.top}px is under the top bar (${u.navBottom}px)`),
    ...r.notes.map((n) => `- ${label(r)}: ${n}`),
    ...r.axe.filter((v) => !serious(r).includes(v)).map((v) => `- ${label(r)}: axe ${v.impact} ${v.id} (${v.count}) ${v.targets.join(' | ')}`),
  ]),
  '',
  '## Axe detail (serious/critical)',
  '',
  ...results.flatMap((r) => serious(r).map((v) => `- ${label(r)}: **${v.id}** ${v.impact}, ${v.count} node(s): ${v.help}. First: ${v.targets.map((t) => `\`${t}\``).join(', ')}`)),
  '',
  '## All checks',
  '',
  '| Route | Width | Theme | HTTP | Axe (all) | Result |',
  '| --- | --- | --- | --- | --- | --- |',
  ...results.map((r) => `| \`${r.route}\` | ${r.width} | ${r.theme}${r.reducedMotion ? ' (reduced)' : ''} | ${r.status ?? '-'} | ${r.axe.length} | ${failures(r).length ? 'FAIL' : 'ok'} |`),
  '',
].join('\n');
writeFileSync(path.join(OUT_DIR, 'report.md'), md);

console.log(`\n${failing.length ? 'FAIL' : 'PASS'}: ${failing.length}/${results.length} checks failing. Report: ${path.join(OUT_DIR, 'report.md')}`);
process.exit(failing.length ? 1 : 0);
