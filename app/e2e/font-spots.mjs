// Font checks shared by motion-qa.mjs (the runner's mock pass) and QA's guarded dev-build proof on the shared Mac,
// so both run the same code. No app state is changed: everything here reads the DOM or the installed bundle.
//
// Self-hosting the fonts (0.1.50, app/self-host-fonts) swapped Google's fixed JetBrains Mono faces (400/500/600/700)
// for one 400-700 range face, so a declared 650 that used to snap to the 700 face could render at 650 (Design's two
// weight spots), and Plus Jakarta Sans was dropped (Security 0546: check for fallback glyphs).
import { existsSync, openSync, readSync, closeSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The weight that renders: the computed weight matched against the declared faces as CSS Fonts 4 §5.2 does. A face
 * whose range covers it renders it exactly; otherwise 400-500 tries heavier faces up to 500, then lighter, then
 * heavier; above 500 heavier first; below 400 lighter first. Matching picks among every declared face and then loads
 * the winner, so only faces that failed to load drop out.
 */
export function renderedWeight(weight, faces) {
  const w = Number(weight);
  const ranges = faces.filter((f) => f.status !== 'error').map((f) => String(f.weight).split(' ').map(Number)).map(([lo, hi]) => [lo, hi ?? lo]);
  if (!ranges.length) return null;
  if (ranges.some(([lo, hi]) => lo <= w && w <= hi)) return w;
  const pick = (xs, fn) => (xs.length ? fn(...xs) : null);
  const lighter = pick(ranges.filter(([, hi]) => hi < w).map(([, hi]) => hi), Math.max);
  const heavier = pick(ranges.filter(([lo]) => lo > w).map(([lo]) => lo), Math.min);
  if (w >= 400 && w <= 500) return pick(ranges.filter(([lo]) => lo > w && lo <= 500).map(([lo]) => lo), Math.min) ?? lighter ?? heavier;
  return w > 500 ? heavier ?? lighter : lighter ?? heavier;
}

/** First-choice families that text asks for with no loaded face and no system/generic name (glyphs then fall back). */
export const fallbacks = (page) => page.evaluate(async () => {
  await document.fonts.ready;
  const SYSTEM = /^(-apple-system|blinkmacsystemfont|system-ui|ui-(sans-serif|serif|monospace|rounded)|sans-serif|serif|monospace|cursive|fantasy|menlo|monaco|sf mono|helvetica( neue)?|arial|courier( new)?|times( new roman)?|georgia)$/i;
  const loaded = new Set([...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '').toLowerCase()));
  const asked = new Set();
  for (const el of document.querySelectorAll('body *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    asked.add(getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, ''));
  }
  return [...asked].filter((f) => !SYSTEM.test(f) && !loaded.has(f.toLowerCase()));
});

/**
 * Every host this renderer loaded anything from (stylesheets, fonts, fetches), from the page's own resource timing,
 * so requests made before a debugger attached are included. `google` lists any *.googleapis.com / *.gstatic.com URL.
 */
export const resourceHosts = (page) => page.evaluate(() => {
  const urls = [...performance.getEntriesByType('resource').map((e) => e.name), ...[...document.querySelectorAll('link[href]')].map((l) => l.href)];
  const hosts = new Set(); const google = [];
  for (const u of urls) {
    try {
      const url = new URL(u);
      hosts.add(url.protocol === 'file:' ? 'file:' : url.host);
      if (/(^|\.)(googleapis|gstatic)\.com$/i.test(url.hostname)) google.push(u.slice(0, 120));
    } catch { /* not a URL */ }
  }
  return { hosts: [...hosts], google: [...new Set(google)] };
});

/**
 * One weight spot: computed family/weight/size, the declared JetBrains Mono (normal) faces, the weight that renders,
 * a still of the element, and a 4x crop (Page.captureScreenshot re-renders the clip at scale 4, so a 10px chip is
 * readable). `newCDPSession(page)` comes from the caller's Playwright context.
 */
export async function weightSpot(page, selector, file, newCDPSession) {
  const el = page.locator(selector).first();
  await el.waitFor({ timeout: 15000 });
  await el.scrollIntoViewIfNeeded();
  const info = await el.evaluate(async (node) => {
    await document.fonts.ready;
    const cs = getComputedStyle(node);
    const faces = [...document.fonts].filter((f) => /jetbrains mono/i.test(f.family) && f.style === 'normal').map((f) => ({ weight: String(f.weight), status: f.status }));
    return { text: node.textContent.trim().slice(0, 40), family: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), weight: cs.fontWeight, size: cs.fontSize, faces: [...new Map(faces.map((f) => [`${f.weight} ${f.status}`, f])).values()], scroll: [window.scrollX, window.scrollY] };
  });
  await el.screenshot({ path: `${file}.png` }).catch(() => {});
  let zoom = null; let zoomError = null;
  const box = await el.boundingBox();
  if (box) {
    const cdp = await newCDPSession(page).catch((e) => { zoomError = String(e).split('\n')[0]; return null; });
    try {
      if (cdp) {
        const pad = 6;
        const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, box.x + info.scroll[0] - pad), y: Math.max(0, box.y + info.scroll[1] - pad), width: box.width + 2 * pad, height: box.height + 2 * pad, scale: 4 } });
        writeFileSync(`${file}-4x.png`, Buffer.from(data, 'base64'));
        zoom = `${path.basename(file)}-4x.png`;
      }
    } catch (e) { zoomError = String(e).split('\n')[0].slice(0, 120); } finally { await cdp?.detach().catch(() => {}); }
  }
  const { scroll, ...rest } = info;
  void scroll;
  return { ...rest, rendered: /jetbrains mono/i.test(info.family) ? renderedWeight(info.weight, info.faces) : null, still: `${path.basename(file)}.png`, zoom, zoomError };
}

/** Files under dist/renderer/fonts in an installed app (inside app.asar by default; or an unpacked app/ folder). */
export function bundleFonts(bundle) {
  const resources = path.join(bundle, 'Contents', 'Resources');
  const asar = path.join(resources, 'app.asar');
  if (existsSync(asar)) {
    // asar: an 8-byte pickle (uint32 4, uint32 header size), then the header pickle (uint32 payload size, int32 string
    // length, the JSON index). Only the index is read.
    const fd = openSync(asar, 'r');
    try {
      const head = Buffer.alloc(8); readSync(fd, head, 0, 8, 0);
      const size = head.readUInt32LE(4);
      const buf = Buffer.alloc(size); readSync(fd, buf, 0, size, 8);
      const index = JSON.parse(buf.subarray(8, 8 + buf.readInt32LE(4)).toString('utf8'));
      let node = index;
      for (const part of ['dist', 'renderer', 'fonts']) { node = node?.files?.[part]; if (!node) return { from: 'app.asar', files: [] }; }
      const files = [];
      const walk = (n, pre) => { for (const [name, child] of Object.entries(n.files ?? {})) { if (child.files) walk(child, `${pre}${name}/`); else files.push(`${pre}${name}`); } };
      walk(node, '');
      return { from: 'app.asar', files: files.sort() };
    } finally { closeSync(fd); }
  }
  const dir = path.join(resources, 'app', 'dist', 'renderer', 'fonts');
  if (!existsSync(dir)) return { from: 'none', files: [] };
  const files = [];
  const walk = (d, pre) => { for (const name of readdirSync(d)) { const p = path.join(d, name); if (statSync(p).isDirectory()) walk(p, `${pre}${name}/`); else files.push(`${pre}${name}`); } };
  walk(dir, '');
  return { from: 'app/', files: files.sort() };
}
