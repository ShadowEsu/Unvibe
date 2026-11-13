// QA helper for qa-rc-0150-mac.yml: reads the RUNNING Unvibe (started by `open -a … --args --remote-debugging-port=0`,
// so macOS treats Unvibe itself as the app asking for System Events) through its Chromium debug port. Read-only.
//   node cdp.mjs note206 <out> <label>   waits for the panel's Automation-denied note; text, button, geometry, contrast
//   node cdp.mjs island <out> <label>    the Island window: screen position/size, placement classes, notice text + colours
//   node cdp.mjs islandnote <out> <label> the expanded card's .island__note: text and colour (#218)
//   node cdp.mjs islandcount <out> <label> waits for the COMPACT Island (count showing, no notice, not expanded), then
//                                         the exact .island__left text and the gap from the </> chip to the count
//   node cdp.mjs sample <out> <label>    the onboarding sample explanation (the companion's "Explain this code" IPC,
//                                         window.unvibe.explainSample), waits for the complete AI explanation
//   node cdp.mjs onboard <out> <label>   onboarding step 1 → "Let's go" → step 2 → "Explain this code" (first-explain.mjs's
//                                         steps, on the already running app), epoch-ms timestamps of each screen
//   node cdp.mjs finish <out> <label>    setup finished by clicks with NO explanation (no hosted-AI call): 1/4 "Let's go" →
//                                         2/4 "Skip for now" → 3/4 "Skip for now" (Mac: finishes setup), epoch-ms marks
//   node cdp.mjs brief <out> <label>     design's Briefs half only (Studio's S10): Briefs, the project, "Latest commit";
//                                         a brief is built from local git (main's brief:build), so no hosted-AI call; no
//                                         Explain/Understand button is pressed. Stills: the real window at 1x, design's
//                                         1180x820 at 2x, and the whole page in one tall viewport at 2x and at 1x, with
//                                         checks that nothing is scrolled out, clipped, masked or covered
// Prints "KEY value" lines for the shell and writes <out>/cdp-<label>.json; element stills go to <out>/<label>-*.png.
import { chromium } from 'playwright';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const [mode, out, label] = process.argv.slice(2);
// 591 (BOSS, 10 Nov): no hosted-AI call from any QA run. sample, onboard (the sample explanation) and design (a real
// brief) make one, so they refuse before connecting unless the workflow sets QA_AI_OK=1 (qa-rc-0150-mac.yml fixes it to
// "0" in its env; a commit-message marker can't change it). brief (S10) is not refused: it opens Briefs only, whose
// brief:build (0.1.51 main.ts) is local git (buildChangeBrief) plus a change_brief_opened product event, and it presses
// no Explain/Understand button, so no diff leaves the runner and no hosted-AI call is made.
if (['sample', 'onboard', 'design'].includes(mode) && process.env.QA_AI_OK !== '1') {
  console.log(`ERROR REFUSED ${mode}: hosted-AI step blocked, QA_AI_OK is not 1 (591)`); process.exit(3);
}
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
  } else if (mode === 'onboard') {
    // Each screen's time goes out as it happens, so a dialog's time can be placed on a screen.
    const mark = (what) => { say('SCREEN', `${Date.now()} ${what}`); };
    const companion = await page(browser, 'companion.html', 60000);
    if (!companion) throw new Error('no companion window');
    await companion.waitForLoadState('domcontentloaded');
    const info = await companion.evaluate(() => window.unvibe?.appInfo?.()).catch(() => null);
    say('VERSION', String(info?.version ?? 'unknown'));
    await companion.locator('.ob2__count').filter({ hasText: '1 / 4' }).waitFor({ timeout: 30000 });
    mark('onboarding 1/4');
    await companion.getByPlaceholder('Your name').fill('QA Mic');
    await companion.getByRole('button', { name: "Let's go", exact: true }).click({ timeout: 8000 });
    await companion.locator('.ob2__count').filter({ hasText: '2 / 4' }).waitFor({ timeout: 8000 });
    mark('onboarding 2/4 (after typing a name and pressing "Let\'s go")');
    await companion.getByRole('button', { name: 'Explain this code', exact: true }).click({ timeout: 8000 });
    const clicked = Date.now();
    mark('pressed "Explain this code"');
    const panel = await page(browser, 'widget.html', 20000);
    if (!panel) throw new Error('the review panel did not open');
    await panel.locator('.card--done .local-save-note').waitFor({ timeout: 120000 });
    await panel.locator('.body .cursor').waitFor({ state: 'detached', timeout: 30000 });
    const body = await panel.locator('.body').innerText();
    const code = await panel.locator('.code-context').innerText();
    result.explanation = body.replace(code, '').trim();
    mark('explanation complete');
    say('EXPLANATION', `${result.explanation.length} characters, ${Math.round((Date.now() - clicked) / 100) / 10} s after the click`);
    writeFileSync(path.join(out, `${label}-explanation.txt`), `${result.explanation}\n`);
  } else if (mode === 'finish') {
    const mark = (what) => { say('SCREEN', `${Date.now()} ${what}`); };
    const companion = await page(browser, 'companion.html', 60000);
    if (!companion) throw new Error('no companion window');
    await companion.waitForLoadState('domcontentloaded');
    const info = await companion.evaluate(() => window.unvibe?.appInfo?.()).catch(() => null);
    say('VERSION', String(info?.version ?? 'unknown'));
    const count = (n) => companion.locator('.ob2__count').filter({ hasText: `${n} / 4` });
    await count(1).waitFor({ timeout: 30000 });
    mark('onboarding 1/4');
    await companion.getByPlaceholder('Your name').fill('QA T1');
    await companion.getByRole('button', { name: "Let's go", exact: true }).click({ timeout: 8000 });
    await count(2).waitFor({ timeout: 8000 });
    mark('onboarding 2/4 (after "Let\'s go")');
    await sleep(1500);
    await companion.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 8000 });
    await count(3).waitFor({ timeout: 8000 });
    mark('onboarding 3/4 (after "Skip for now"; no explanation)');
    await sleep(1500);
    await companion.screenshot({ path: path.join(out, `${label}-3of4.png`) }).catch(() => {});
    await companion.getByRole('button', { name: 'Skip for now', exact: true }).click({ timeout: 8000 });
    mark('setup finished (pressed "Skip for now" on 3/4)');
    await companion.locator('.ob2__count').waitFor({ state: 'detached', timeout: 20000 });
    mark('setup screens gone');
    await sleep(2000);
    await companion.screenshot({ path: path.join(out, `${label}-after-setup.png`) }).catch(() => {});
  } else if (mode === 'design' || mode === 'brief') {
    // Design package stills: Briefs with one real brief, then Settings → Privacy & Data. Clicks go through the page's
    // own buttons (as first-explain.mjs does); the folder comes from the app's own folder dialog (PICK_PATH, typed into
    // macOS's Go to Folder) unless the app already knows the project (SKIP_PICK=1). Each screen: a 1x capture of the
    // real companion window, then a 2x capture through Emulation.setDeviceMetricsOverride (EMU_W x EMU_H, scale 2).
    const emuW = Number(process.env.EMU_W || 1180), emuH = Number(process.env.EMU_H || 820);
    const companion = await page(browser, 'companion.html', 60000);
    if (!companion) throw new Error('no companion window');
    await companion.waitForLoadState('domcontentloaded');
    await sleep(2500);
    const info = await companion.evaluate(() => window.unvibe?.appInfo?.()).catch(() => null);
    result.version = info?.version ?? 'unknown';
    result.realWindow = await companion.evaluate(() => ({ innerWidth, innerHeight, outerWidth, outerHeight, dpr: devicePixelRatio, x: screenX, y: screenY }));
    say('VERSION', result.version);
    say('REAL_WINDOW', JSON.stringify(result.realWindow));
    const shot1x = (file) => {
      try {
        const found = execFileSync(process.env.GKWIN, ['find', 'Unvibe']).toString().trim().split(' ');
        execFileSync('screencapture', ['-x', '-o', '-l', found[0], path.join(out, file)]);
        say('SHOT_1X', `${file} window ${found.slice(1).join(' ')}`);
      } catch (e) { say('SHOT_1X', `${file} failed: ${e.message.split('\n')[0]}`); }
    };
    const cdpSession = await companion.context().newCDPSession(companion);
    // Text that the layout cuts (overflow hidden/clip, or ellipsis) inside the given root, at the current viewport.
    const clippedText = (root) => companion.evaluate((sel) => {
      const hits = [];
      for (const el of document.querySelectorAll(`${sel} *`)) {
        const s = getComputedStyle(el);
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const cut = (el.scrollWidth > el.clientWidth + 1 && /(hidden|clip)/.test(s.overflowX)) || (el.scrollHeight > el.clientHeight + 1 && /(hidden|clip)/.test(s.overflowY) && s.webkitLineClamp !== 'none');
        if (cut && el.getBoundingClientRect().width > 0) hits.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}: "${el.textContent.trim().slice(0, 60)}"`);
      }
      return hits.slice(0, 12);
    }, root);
    const shot2x = async (file, root) => {
      await cdpSession.send('Emulation.setDeviceMetricsOverride', { width: emuW, height: emuH, deviceScaleFactor: 2, mobile: false });
      await sleep(1200);
      const vp = await companion.evaluate(() => ({ innerWidth, innerHeight, dpr: devicePixelRatio }));
      const cut = await clippedText(root);
      const { data } = await cdpSession.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path.join(out, file), Buffer.from(data, 'base64'));
      await cdpSession.send('Emulation.clearDeviceMetricsOverride');
      await sleep(800);
      say('SHOT_2X', `${file} viewport ${vp.innerWidth}x${vp.innerHeight} CSS px at dpr ${vp.dpr}; clipped text: ${cut.length ? cut.join(' | ') : 'none'}`);
      return { file, viewport: vp, clipped: cut };
    };

    // Briefs. A returning launch can open with the "Welcome back" paste card over the app; it is closed the user's way.
    const notNow = companion.getByRole('button', { name: 'Not now', exact: true });
    if (await notNow.count() && await notNow.first().isVisible()) { await notNow.first().click(); say('STEP', 'pressed "Not now" on the welcome card'); await sleep(1000); }
    try {
      await companion.locator('#companion-sidebar nav button[aria-label="Briefs"]').click({ timeout: 10000 });
    } catch (e) {
      execFileSync('screencapture', ['-x', path.join(out, 'briefs-nav-failed-full.png')]);
      say('STEP', `buttons on screen: ${(await companion.evaluate(() => [...document.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 40).join(' | ')))}`);
      throw e;
    }
    say('STEP', 'opened Briefs from the sidebar');
    const card = companion.locator('.briefings__card');
    // Briefs is idle when its Refresh button is enabled (it reads "Reading…" while a build or the folder dialog runs)
    // or when the "Choose a project" invitation shows (needsRepo and not busy).
    const idle = () => companion.evaluate(() => [...document.querySelectorAll('.briefings__actions button')].some((b) => b.textContent.trim() === 'Refresh' && !b.disabled)
      || [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Choose a project'));
    const waitIdle = async (ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await idle()) return true; await sleep(300); } return false; };
    const snap = (name) => { try { execFileSync('screencapture', ['-x', path.join(out, name)]); } catch { /* best effort */ } };
    if (process.env.SKIP_PICK !== '1') {
      const choose = companion.getByRole('button', { name: 'Choose a project', exact: true });
      await choose.waitFor({ timeout: 20000 });
      await choose.click();
      say('STEP', 'pressed "Choose a project" (the app opens macOS\'s folder dialog)');
      await sleep(2500);
      snap('briefs-pick-1-dialog.png');
      try { writeFileSync(path.join(out, 'briefs-pick-dialog-ax.txt'), execFileSync(process.env.RCMAC, ['ax', 'Unvibe'], { timeout: 20000 }).toString()); } catch { /* best effort */ }
      const osa = (...lines) => execFileSync('osascript', lines.flatMap((l) => ['-e', l]), { timeout: 20000 }).toString().trim();
      try {
        execFileSync('open', ['-a', '/Applications/Unvibe.app']); // the dialog's app in front, through LaunchServices
        await sleep(1500);
        osa('tell application "System Events" to keystroke "g" using {command down, shift down}');
        await sleep(1500);
        snap('briefs-pick-2-goto.png');
        osa(`tell application "System Events" to keystroke "${process.env.PICK_PATH}"`);
        await sleep(1200);
        snap('briefs-pick-3-typed.png');
        osa('tell application "System Events" to key code 36'); // Go
        await sleep(2000);
        snap('briefs-pick-4-went.png');
        if (!(await idle())) osa('tell application "System Events" to key code 36'); // Open (chooses the folder now shown)
        say('STEP', `typed ${process.env.PICK_PATH} into Go to Folder, Return, then Return (Open)`);
      } catch (e) { say('STEP', `folder dialog keystrokes failed: ${e.message.split('\n')[0]}`); }
      if (!(await waitIdle(6000))) {
        snap('briefs-pick-5-still-open.png');
        let pressed = '';
        try { pressed = execFileSync(process.env.RCMAC, ['axpress', 'Unvibe', 'Open'], { timeout: 20000 }).toString().trim(); } catch (e) { pressed = `failed: ${String(e.stdout ?? e.message).split('\n')[0]}`; }
        say('STEP', `dialog still open; AXPress "Open": ${pressed}`);
      }
    }
    const wasIdle = await waitIdle(20000);
    if (!wasIdle || await companion.getByRole('button', { name: 'Choose a project', exact: true }).count()) {
      say('PICK', `no project after the folder dialog (Briefs idle: ${wasIdle})`);
      snap('briefs-pick-failed-full.png');
      try { execFileSync('osascript', ['-e', 'tell application "System Events" to key code 53']); } catch { /* close a dialog left open */ }
      throw new Error('PICK_FAILED');
    }
    say('PICK', `a project is chosen; Briefs says: ${(await companion.locator('.briefings__empty').allInnerTexts()).join(' | ').slice(0, 160) || 'a brief'}`);
    await companion.getByRole('tab', { name: 'Latest commit', exact: true }).click({ timeout: 10000 });
    say('STEP', 'chose the "Latest commit" scope');
    await sleep(1500);
    await card.waitFor({ timeout: 20000 });
    await companion.locator('.briefings__busy').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await sleep(1200);
    result.brief = await companion.evaluate(() => {
      const c = document.querySelector('.briefings__card');
      const list = (sel) => [...c.querySelectorAll(sel)].map((n) => n.textContent.trim());
      return { meta: list('.briefings__meta > *'), mainChanges: list('ul:not(.briefings__files) > li'), understand: list('ol > li'), note: c.querySelector('.briefings__note')?.textContent.trim(),
        files: list('.briefings__file'), agentReview: document.querySelector('.agent-review')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 600) ?? null };
    });
    say('BRIEF', JSON.stringify(result.brief));
    if (mode === 'brief') {
      // Studio's S10 (Marketing's ask 20261113-0108): every number on screen, word for word, then the whole page.
      Object.assign(result.brief, await companion.evaluate(() => {
        const t = (n) => n?.innerText.replace(/\s+/g, ' ').trim() ?? null;
        const r = document.querySelector('.agent-review');
        return { reviewHead: t(r?.querySelector('.agent-review__head')), reviewFirst: [...(r?.querySelectorAll('.agent-review__checks > li') ?? [])].map(t),
          whatMatters: [...(r?.querySelectorAll('.agent-review__files > li') ?? [])].map((li) => ({ path: li.querySelector('code')?.textContent.trim(), reason: li.querySelector('small')?.textContent.trim(), counts: li.querySelector(':scope > span')?.textContent.trim() })),
          areas: [...(r?.querySelectorAll('.agent-review__areas > span') ?? [])].map(t),
          agentReviewFull: t(r) };
      }));
      say('BRIEF_REVIEW', JSON.stringify({ reviewHead: result.brief.reviewHead, whatMatters: result.brief.whatMatters, areas: result.brief.areas }));
      shot1x('briefs-window-1x.png');
      result.briefs2x = await shot2x('briefs-open-2x.png', '.briefings');
      // The whole page in one viewport: as tall as the page scroller's content, so nothing is scrolled out of view. Then
      // checked: nothing left to scroll, no text cut, no mask on the page or its parents, and at every point of a 16 px
      // grid over the two brief cards the topmost element is the card itself (so the Ask Vibe dock, the buddy or any
      // other floating element covers none of it). Positioned elements over the cards that don't take the pointer, and
      // gradient ::before/::after layers on the page's parents (possible fades), are listed as notes for the eye check.
      const full = async (file, scale) => {
        await cdpSession.send('Emulation.setDeviceMetricsOverride', { width: emuW, height: emuH, deviceScaleFactor: scale, mobile: false });
        await sleep(1000);
        const need = await companion.evaluate(() => { const p = document.querySelector('.briefings').closest('.page'); p.scrollTop = 0; return { sh: p.scrollHeight, ch: p.clientHeight, ih: innerHeight }; });
        const h = need.ih + need.sh - need.ch + 8;
        await cdpSession.send('Emulation.setDeviceMetricsOverride', { width: emuW, height: h, deviceScaleFactor: scale, mobile: false });
        await sleep(1500);
        const seen = await companion.evaluate(() => {
          const p = document.querySelector('.briefings').closest('.page');
          const cardEls = [...document.querySelectorAll('.agent-review, .briefings__card')];
          const cards = cardEls.map((n) => n.getBoundingClientRect());
          const name = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`;
          const covers = new Set();
          cardEls.forEach((card, i) => {
            const c = cards[i];
            for (let y = c.top + 2; y < c.bottom - 1; y += 16) for (let x = c.left + 2; x < c.right - 1; x += 16) {
              const top = document.elementFromPoint(x, y);
              // The card's own parents show through its rounded corners; only something else on top covers it.
              if (top && !card.contains(top) && !top.contains(card)) covers.add(name(top));
            }
          });
          const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          const over = [];
          for (const el of document.querySelectorAll('body *')) {
            if (p.contains(el) || el.contains(p)) continue;
            const s = getComputedStyle(el);
            if (!['fixed', 'absolute', 'sticky'].includes(s.position) || s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) continue;
            const b = el.getBoundingClientRect();
            if (b.width && b.height && cards.some((c) => hit(b, c))) over.push(`${name(el)} (pointer-events ${s.pointerEvents}, z ${s.zIndex})`);
          }
          const masks = [];
          const layers = [];
          for (let n = p; n; n = n.parentElement) {
            for (const pseudo of [null, '::before', '::after']) {
              const s = getComputedStyle(n, pseudo);
              if ((s.maskImage && s.maskImage !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none')) masks.push(`${name(n)}${pseudo ?? ''}`);
              if (pseudo && s.content !== 'none' && /gradient/.test(s.backgroundImage)) layers.push(`${name(n)}${pseudo}`);
            }
          }
          return { leftToScroll: p.scrollHeight - p.clientHeight, scrollTop: p.scrollTop, viewport: [innerWidth, innerHeight, devicePixelRatio], cards: cards.map((c) => [Math.round(c.top), Math.round(c.bottom)]), covers: [...covers], masks, over, layers };
        });
        const cut = await clippedText('.briefings');
        const { data } = await cdpSession.send('Page.captureScreenshot', { format: 'png' });
        writeFileSync(path.join(out, file), Buffer.from(data, 'base64'));
        await cdpSession.send('Emulation.clearDeviceMetricsOverride');
        await sleep(800);
        const whole = seen.leftToScroll <= 1 && seen.scrollTop === 0 && !cut.length && !seen.covers.length && !seen.masks.length;
        say(whole ? 'SHOT_FULL' : 'ERROR SHOT_FULL', `${file} viewport ${seen.viewport.join('x')} (CSS px, dpr); left to scroll ${seen.leftToScroll} px; cards top-bottom ${JSON.stringify(seen.cards)}; clipped text: ${cut.length ? cut.join(' | ') : 'none'}; covered by: ${seen.covers.join(', ') || 'nothing'}; masks: ${seen.masks.join(', ') || 'none'}`);
        say('NOTE_FULL', `${file} positioned elements over the cards: ${seen.over.join(', ') || 'none'}; gradient layers on the page's parents: ${seen.layers.join(', ') || 'none'}`);
        return { file, ...seen, clipped: cut, whole };
      };
      result.full2x = await full('briefs-full-2x.png', 2);
      result.full1x = await full('briefs-full-1x.png', 1);
      if (!result.full2x.whole || !result.full1x.whole) throw new Error('the whole brief is not in one unobstructed viewport');
    } else {
      shot1x('briefs-open-1x.png');
      result.briefs2x = await shot2x('briefs-open-2x.png', '.briefings');

      // Settings → Privacy & Data.
      await companion.locator('.side-settings').click({ timeout: 10000 });
      const overlay = companion.locator('.overlay[aria-label="Settings"]');
      await overlay.waitFor({ timeout: 10000 });
      await overlay.getByRole('button', { name: 'Privacy & Data' }).click({ timeout: 10000 });
      await sleep(1200);
      result.privacy = await companion.evaluate(() => [...document.querySelectorAll('.overlay .mbody .setrow')].map((row) => ({
        label: row.querySelector('.sl')?.textContent.trim(), control: row.querySelector('[role="switch"], .toggle, button, input')?.outerHTML.slice(0, 120) ?? null })));
      say('PRIVACY_ROWS', JSON.stringify(result.privacy.map((r) => r.label)));
      shot1x('settings-privacy-1x.png');
      result.privacy2x = await shot2x('settings-privacy-2x.png', '.overlay');
    }
  }
} catch (e) {
  result.error = e.message.split('\n')[0];
  say('ERROR', result.error);
}
writeFileSync(path.join(out, `cdp-${label}.json`), `${JSON.stringify(result, null, 2)}\n`);
await browser.close().catch(() => {}); // disconnects only; the app keeps running
process.exit(result.error ? 1 : 0);
