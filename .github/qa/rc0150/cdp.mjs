// QA helper for qa-rc-0150-mac.yml: reads the RUNNING Unvibe (started by `open -a … --args --remote-debugging-port=0`,
// so macOS treats Unvibe itself as the app asking for System Events) through its Chromium debug port. Read-only.
//   node cdp.mjs note206 <out> <label>   waits for the panel's Automation-denied note; text, button, geometry, contrast
//   node cdp.mjs island <out> <label>    the Island window: screen position/size, placement classes, notice text + colours
//   node cdp.mjs islandnote <out> <label> the expanded card's .island__note: text and colour (#218)
//   node cdp.mjs islandcount <out> <label> waits for the COMPACT Island (count showing, no notice, not expanded), then
//                                         the exact .island__left text and the gap from the </> chip to the count
//   node cdp.mjs sample <out> <label>    the onboarding sample explanation (the companion's "Explain this code" IPC,
//                                         window.unvibe.explainSample), waits for the complete AI explanation
// Prints "KEY value" lines for the shell and writes <out>/cdp-<label>.json; element stills go to <out>/<label>-*.png.
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const [mode, out, label] = process.argv.slice(2);
const userData = process.env.USER_DATA || path.join(os.homedir(), 'Library/Application Support/Unvibe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (k, v) => console.log(`${k} ${typeof v === 'string' ? v : JSON.stringify(v)}`);

async function connect() {
  const file = path.join(userData, 'DevToolsActivePort');
  for (let i = 0; i < 60; i++) {
    let port = existsSync(file) ? Number(readFileSync(file, 'utf8').split('\n')[0]) : 0;
    if (!port) {
      // Fallback: the port Unvibe's main process listens on.
      try {
        const pid = execFileSync('pgrep', ['-x', 'Unvibe']).toString().trim().split('\n')[0];
        const m = execFileSync('lsof', ['-nP', '-a', '-p', pid, '-iTCP', '-sTCP:LISTEN']).toString().match(/127\.0\.0\.1:(\d+)/);
        port = m ? Number(m[1]) : 0;
      } catch { /* not up yet */ }
    }
    if (port) {
      const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => null);
      if (b) return { browser: b, port };
    }
    await sleep(500);
  }
  throw new Error(`no debug port (looked in ${file} and lsof)`);
}

async function page(browser, part, wait = 20000) {
  const t = Date.now();
  while (Date.now() - t < wait) {
    const hit = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes(part) && !p.isClosed());
    if (hit) return hit;
    await sleep(250);
  }
  return null;
}

// Runs in the page: every CSS colour → sRGB bytes through a canvas, alpha compositing, WCAG contrast.
const helpers = `
  const toRgba = (c) => { const x = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    x.clearRect(0, 0, 1, 1); x.fillStyle = '#000'; x.fillStyle = c; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, under) => { const a = top[3]; return [0, 1, 2].map((i) => Math.round(top[i] * a + under[i] * (1 - a))).concat(1); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return Math.round(((h + 0.05) / (l + 0.05)) * 100) / 100; };
  // What is painted behind an element: its ancestors' backgrounds composited from the first opaque one upward.
  const behind = (el) => { const chain = []; let n = el.parentElement; const images = [];
    while (n) { const s = getComputedStyle(n); chain.push(toRgba(s.backgroundColor));
      if (s.backgroundImage !== 'none') images.push(n.className + ': ' + s.backgroundImage.slice(0, 80)); n = n.parentElement; }
    let i = chain.findIndex((c) => c[3] === 1); const base = i < 0 ? [0, 0, 0, 1] : chain[i];
    let c = base; for (let j = (i < 0 ? chain.length : i) - 1; j >= 0; j--) c = over(chain[j], c);
    return { color: c, opaqueAncestorFound: i >= 0, backgroundImages: images }; };
  const win = () => ({ screenX: window.screenX, screenY: window.screenY, outerWidth: window.outerWidth, outerHeight: window.outerHeight,
    innerWidth: window.innerWidth, innerHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio });
  // Is the whole element visible: inside the viewport and not cut by a scrolling/clipping ancestor?
  const clipped = (el) => { const r = el.getBoundingClientRect(); const cuts = [];
    if (r.top < 0 || r.left < 0 || r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5) cuts.push('viewport');
    for (let n = el.parentElement; n; n = n.parentElement) { const s = getComputedStyle(n);
      if (/(hidden|auto|scroll|clip)/.test(s.overflow + s.overflowX + s.overflowY)) { const p = n.getBoundingClientRect();
        if (r.top < p.top - 0.5 || r.bottom > p.bottom + 0.5 || r.left < p.left - 0.5 || r.right > p.right + 0.5) cuts.push(n.className || n.tagName); } }
    return cuts; };
  // The part of the window an element can show through: the viewport cut by every clipping ancestor.
  const box = (el) => { let b = { top: 0, left: 0, bottom: innerHeight, right: innerWidth };
    for (let n = el.parentElement; n; n = n.parentElement) { const s = getComputedStyle(n);
      if (/(hidden|auto|scroll|clip)/.test(s.overflow + s.overflowX + s.overflowY)) { const p = n.getBoundingClientRect();
        b = { top: Math.max(b.top, p.top), left: Math.max(b.left, p.left), bottom: Math.min(b.bottom, p.bottom), right: Math.min(b.right, p.right) }; } }
    return b; };
  const within = (r, b) => r.top >= b.top - 0.5 && r.left >= b.left - 0.5 && r.bottom <= b.bottom + 0.5 && r.right <= b.right + 0.5;
  // Every line of text and every button of the element shows (its own border may still be cut).
  const contentVisible = (el) => { const b = box(el); const rects = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t;
    while ((t = w.nextNode())) { if (!t.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(t); rects.push(...g.getClientRects()); }
    el.querySelectorAll('button').forEach((x) => rects.push(x.getBoundingClientRect()));
    const r = el.getBoundingClientRect();
    return { all: rects.every((x) => within(x, b)), lines: rects.length, hiddenBottomPx: Math.max(0, Math.round(r.bottom - b.bottom)), hiddenTopPx: Math.max(0, Math.round(b.top - r.top)) }; };
`;
const inPage = (p, fn) => p.evaluate(`(() => { ${helpers}\n return (${fn.toString()})(); })()`);

const { browser, port } = await connect();
say('PORT', String(port));
const result = { mode, label };
try {
  if (mode === 'note206') {
    const panel = await page(browser, 'widget.html', 30000);
    if (!panel) throw new Error('no panel window (widget.html)');
    const note = panel.locator('.access-note').filter({ hasText: 'macOS is blocking Unvibe' });
    await note.waitFor({ timeout: Number(process.env.NOTE_WAIT || 15000) });
    await sleep(800); // let the entrance settle before measuring
    // The ink (dark) panel is the panel's own ☾ button (localStorage unvibe.panelTheme2), not settings.theme.
    if (process.env.PANEL === 'dark') {
      const toDark = panel.getByRole('button', { name: 'Switch panel to dark mode', exact: true });
      if (await toDark.count()) { await toDark.click(); say('PANEL_SWITCHED', 'pressed ☾ (Switch panel to dark mode)'); await sleep(900); }
    }
    // SCROLL=1: scroll the panel the way a person would until the whole note shows.
    if (process.env.SCROLL === '1') { await note.evaluate((el) => el.scrollIntoView({ block: 'end' })); await sleep(700); say('SCROLLED', 'note scrolled into view (block end)'); }
    // Page-side code goes in as one source string (Runtime.evaluate is not held to the page's CSP; an eval() would be).
    Object.assign(result, await inPage(panel, () => {
      const el = [...document.querySelectorAll('.access-note')].find((n) => n.textContent.includes('macOS is blocking Unvibe'));
      const s = getComputedStyle(el);
      const back = behind(el);
      const panelBg = back.color;
      const noteBg = over(toRgba(s.backgroundColor), panelBg);
      const text = over(toRgba(s.color), noteBg);
      const borderRaw = toRgba(s.borderTopColor);
      const border = over(borderRaw, noteBg); // background-clip: border-box paints the note's fill under its border
      const btn = [...el.querySelectorAll('button')].map((b) => b.textContent.trim());
      const r = el.getBoundingClientRect();
      return {
        text: el.innerText.replace(/\s+/g, ' ').trim(), buttons: btn, rect: { x: r.x, y: r.y, w: r.width, h: r.height }, clippedBy: clipped(el), content: contentVisible(el),
        theme: `panel=${document.documentElement.dataset.panel ?? ''} theme=${document.documentElement.dataset.theme ?? ''}`,
        css: { color: s.color, backgroundColor: s.backgroundColor, border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`, font: `${s.fontSize}/${s.lineHeight} ${s.fontWeight}` },
        panelBackground: hex(panelBg), panelBackgroundFromOpaqueAncestor: back.opaqueAncestorFound, backgroundImagesBehind: back.backgroundImages,
        noteBackground: hex(noteBg), textColor: hex(text), borderColor: hex(border), borderAlpha: borderRaw[3],
        textContrast: ratio(text, noteBg), borderContrast: ratio(border, panelBg), window: win(),
      };
    }));
    await note.screenshot({ path: path.join(out, `${label}-note-element.png`) }).catch(() => {});
    say('NOTE_TEXT', result.text);
    say('NOTE_BUTTONS', result.buttons.join(' | '));
    say('NOTE_CLIPPED_BY', result.clippedBy.join(',') || 'nothing');
    say('NOTE_CONTENT_VISIBLE', `${result.content.all ? 'yes' : 'no'} (${result.content.lines} text/button boxes); note box hidden: bottom ${result.content.hiddenBottomPx} px, top ${result.content.hiddenTopPx} px`);
    say('THEME', result.theme);
    say('CONTRAST_TEXT', `${result.textColor} on ${result.noteBackground} = ${result.textContrast}:1`);
    say('CONTRAST_BORDER', `${result.borderColor} (alpha ${result.borderAlpha}) vs panel ${result.panelBackground} = ${result.borderContrast}:1`);
    say('PANEL_WINDOW', `${result.window.screenX} ${result.window.screenY} ${result.window.outerWidth} ${result.window.outerHeight} dpr ${result.window.devicePixelRatio}`);
    say('NOTE_RECT', `${Math.round(result.rect.x)} ${Math.round(result.rect.y)} ${Math.round(result.rect.w)} ${Math.round(result.rect.h)}`);
  } else if (mode === 'island' || mode === 'islandnote') {
    const bar = await page(browser, 'bar.html', 20000);
    if (!bar) throw new Error('no Island window (bar.html)');
    if (mode === 'islandnote') await bar.locator('.island__note').waitFor({ timeout: 8000 }).catch(() => {});
    Object.assign(result, await inPage(bar, () => {
      const island = document.querySelector('.island');
      const pick = (sel) => { const el = document.querySelector(sel); if (!el) return null; const s = getComputedStyle(el);
        const r = el.getBoundingClientRect(); const dot = getComputedStyle(el, '::before');
        const back = behind(el); const fill = over(toRgba(s.backgroundColor), back.color); const fg = over(toRgba(s.color), fill);
        return { text: el.innerText.replace(/\s+/g, ' ').trim(), color: hex(toRgba(s.color)), colorCss: s.color, on: hex(fill), contrast: ratio(fg, fill),
          dot: dot.content === 'none' ? null : hex(toRgba(dot.backgroundColor)), rect: { x: r.x, y: r.y, w: r.width, h: r.height }, clippedBy: clipped(el),
          lines: Math.round(r.height / parseFloat(s.lineHeight || '16')) }; };
      const ir = island?.getBoundingClientRect();
      return { window: win(), islandClass: island?.className ?? null,
        islandRect: ir ? { x: ir.x, y: ir.y, w: ir.width, h: ir.height } : null,
        islandFill: island ? hex(over(toRgba(getComputedStyle(island).backgroundColor), [0, 0, 0, 1])) : null,
        notice: pick('.island__notice'), note: pick('.island__note') };
    }));
    await bar.screenshot({ path: path.join(out, `${label}-bar-page.png`) }).catch(() => {});
    const w = result.window;
    say('BAR_WINDOW', `${w.screenX} ${w.screenY} ${w.outerWidth} ${w.outerHeight} dpr ${w.devicePixelRatio}`);
    say('ISLAND_CLASS', result.islandClass ?? 'none');
    say('ISLAND_RECT', result.islandRect ? `${Math.round(result.islandRect.x)} ${Math.round(result.islandRect.y)} ${Math.round(result.islandRect.w)} ${Math.round(result.islandRect.h)}` : 'none');
    for (const k of ['notice', 'note']) {
      const n = result[k];
      say(k.toUpperCase(), n ? `"${n.text}" colour ${n.color} on ${n.on} = ${n.contrast}:1, dot ${n.dot ?? 'none'}, ${Math.round(n.rect.w)}x${Math.round(n.rect.h)} px, clipped by ${n.clippedBy.join(',') || 'nothing'}` : 'none');
    }
  } else if (mode === 'islandcount') {
    const bar = await page(browser, 'bar.html', 20000);
    if (!bar) throw new Error('no Island window (bar.html)');
    const waitStart = Date.now();
    const until = Date.now() + Number(process.env.COMPACT_WAIT || 30000);
    let state = null;
    while (Date.now() < until) {
      state = await bar.evaluate(() => ({ cls: document.querySelector('.island')?.className ?? '', count: !!document.querySelector('.island__left') }));
      if (state.count && !/island--(notice|expanded|closing)/.test(state.cls)) break;
      await sleep(250);
    }
    await sleep(700); // any resize or fade finishes
    Object.assign(result, await inPage(bar, () => {
      const island = document.querySelector('.island');
      const chip = document.querySelector('.island__wing--left .island__tool');
      const count = document.querySelector('.island__left');
      const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, w: b.width, h: b.height }; };
      // The first painted character of the count: its own box, not the span's.
      let first = null;
      if (count) { const w = document.createTreeWalker(count, NodeFilter.SHOW_TEXT); let t;
        while ((t = w.nextNode())) { const i = t.textContent.search(/\S/); if (i >= 0) { const g = document.createRange(); g.setStart(t, i); g.setEnd(t, i + 1);
          const b = g.getBoundingClientRect(); first = { char: t.textContent[i], left: b.left, right: b.right }; break; } } }
      const chipBox = r(chip), countBox = r(count);
      return { window: win(), islandClass: island?.className ?? null, islandRect: r(island), countText: count ? count.textContent : null,
        countInner: count ? count.innerText : null, chip: chipBox, count: countBox, firstChar: first,
        wingLeft: r(document.querySelector('.island__wing--left')), wingRight: r(document.querySelector('.island__wing--right')),
        notch: r(document.querySelector('.island__notch')),
        gapSpan: chipBox && countBox ? Math.round((countBox.left - chipBox.right) * 100) / 100 : null,
        gapFirstChar: chipBox && first ? Math.round((first.left - chipBox.right) * 100) / 100 : null };
    }));
    result.compactReached = !!(state?.count && !/island--(notice|expanded|closing)/.test(state.cls));
    await bar.screenshot({ path: path.join(out, `${label}-bar-page.png`) }).catch(() => {});
    const w = result.window, f = (n) => Math.round(n * 100) / 100;
    say('BAR_WINDOW', `${w.screenX} ${w.screenY} ${w.outerWidth} ${w.outerHeight} dpr ${w.devicePixelRatio}`);
    result.waitedMs = Date.now() - waitStart;
    say('ISLAND_CLASS', `${result.islandClass ?? 'none'} (compact reached: ${result.compactReached ? 'yes' : 'no'})`);
    say('COUNT_TEXT', JSON.stringify(result.countText));
    say('CHIP', result.chip ? `left ${f(result.chip.left)} right ${f(result.chip.right)} (${f(result.chip.w)}x${f(result.chip.h)})` : 'none');
    say('COUNT', result.count ? `left ${f(result.count.left)} right ${f(result.count.right)} (${f(result.count.w)}x${f(result.count.h)}); first char "${result.firstChar?.char}" left ${f(result.firstChar?.left ?? NaN)}` : 'none');
    say('WAITED', `${result.waitedMs} ms until the compact state was read (from the start of this read)`);
    say('WINGS', `left ${f(result.wingLeft?.left ?? NaN)}..${f(result.wingLeft?.right ?? NaN)}, notch ${f(result.notch?.left ?? NaN)}..${f(result.notch?.right ?? NaN)}, right ${f(result.wingRight?.left ?? NaN)}..${f(result.wingRight?.right ?? NaN)}`);
    say('GAP', `${result.gapFirstChar} px (first character's left − chip's right); span ${result.gapSpan} px`);
  } else if (mode === 'sample') {
    const pages = () => browser.contexts().flatMap((c) => c.pages()).filter((p) => !p.isClosed());
    let host = await page(browser, 'companion.html', 10000);
    if (!host) for (const p of pages()) if (await p.evaluate(() => typeof window.unvibe?.explainSample === 'function').catch(() => false)) { host = p; break; }
    if (!host) throw new Error('no window with window.unvibe.explainSample');
    say('SAMPLE_FROM', host.url().split('/').pop());
    const clicked = Date.now();
    await host.evaluate(() => window.unvibe.explainSample());
    const panel = await page(browser, 'widget.html', 20000);
    if (!panel) throw new Error('the review panel did not open');
    await panel.locator('.code-context code').filter({ hasText: 'function debounce(fn, wait) {' }).waitFor({ timeout: 30000 });
    await panel.locator('.card--done .local-save-note').waitFor({ timeout: 120000 });
    await panel.locator('.body .cursor').waitFor({ state: 'detached', timeout: 30000 });
    const body = await panel.locator('.body').innerText();
    const code = await panel.locator('.code-context').innerText();
    result.explanation = body.replace(code, '').trim();
    result.seconds = Math.round((Date.now() - clicked) / 100) / 10;
    writeFileSync(path.join(out, `${label}-explanation.txt`), `${result.explanation}\n`);
    await panel.screenshot({ path: path.join(out, `${label}-panel.png`) }).catch(() => {});
    say('EXPLANATION', `${result.explanation.length} characters, ${result.seconds} s after the request`);
  }
} catch (e) {
  result.error = e.message.split('\n')[0];
  say('ERROR', result.error);
}
writeFileSync(path.join(out, `cdp-${label}.json`), `${JSON.stringify(result, null, 2)}\n`);
await browser.close().catch(() => {}); // disconnects only; the app keeps running
process.exit(result.error ? 1 : 0);
