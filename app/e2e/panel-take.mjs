// Reads and captures Unvibe's review panel as 0.1.52's Mono redesign draws it, for marketing takes: used by
// s13-take.mjs on GitHub's macOS runner, and by QA's local check against a locally built app and a mock backend.
//
// Nothing here can ask the AI. The only things it presses are "Show code" / "Show less" (a toggle inside the panel)
// and a pointerdown on the panel's root (it wakes the clicked-away fade, Design ruling e). It never touches the depth
// row (a click there explains again), More detail, Explain differently, the tabs or the ask field.
//
// The real panel is 380 px wide and 360-560 px tall, sized by the app to its content (windows.ts PANEL_W,
// PANEL_MIN_H, PANEL_MAX_H); it is not resizable, so the stills are the panel at the size the app gives it.
import { shot } from './media-window.mjs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (b) => createHash('sha256').update(b).digest('hex');

/** Everything a take checks, read in one evaluate so the parts belong to the same moment. */
export const panelState = (page) => page.evaluate(() => {
  const root = document.querySelector('.ob');
  const phase = root ? ([...root.classList].find((c) => c.startsWith('ob--') && !c.startsWith('ob--view-')) ?? '').slice(4) : '';
  const answer = document.querySelector('.ob-answer:not(.more-detail__body)');
  const on = document.querySelector('.ob-depth__item.is-on');
  const depth = on ? on.cloneNode(true) : null;
  depth?.querySelector('.ob-pro')?.remove();
  const text = (el) => (el?.innerText ?? '').trim();
  const shortAnswer = !!answer?.querySelector('.short-answer');
  const typing = !!document.querySelector('.ob-answer .cursor');
  return {
    phase,
    // A short answer (every selection's first answer) shows More detail only once its last word is revealed.
    finished: phase === 'done' && !typing && text(answer).length > 0 && (!shortAnswer || !!document.querySelector('.more-detail__toggle')),
    failed: phase === 'error' || /Couldn't explain that/.test(document.body.innerText),
    depth: (depth?.textContent ?? '').trim().toLowerCase(),
    proChip: [...document.querySelectorAll('.ob-depth__item .ob-pro')].map((el) => (el.textContent ?? '').trim()),
    code: document.querySelector('.ob-code__all code')?.textContent ?? '',
    codeOpen: !!document.querySelector('.ob-code.is-open'),
    head: { title: text(document.querySelector('.ob-head__title')), meta: text(document.querySelector('.ob-head .ob-meta')) },
    answer: text(answer),
    unsure: text(answer?.querySelector('.short-answer__unsure')),
    detailOpen: document.querySelector('.more-detail__toggle')?.getAttribute('aria-expanded') === 'true',
    notes: [...document.querySelectorAll('.ob-body .ob-note, .ob-body [class*="pmf"]')].map(text).filter(Boolean),
    opacity: root ? getComputedStyle(root).opacity : '',
    size: [innerWidth, innerHeight],
  };
});

/**
 * The panel once it shows a finished answer at `depth` to code that includes `marker`, read the same twice 1 s
 * apart. `getPage` returns the panel's page or null (the window may not exist yet). Throws on a failed explanation.
 */
export async function finishedPanel(getPage, { depth, marker, timeout = 120000 }) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeout) {
    const page = getPage();
    const s = page ? await panelState(page).catch(() => null) : null;
    if (s?.failed) throw new Error(`the explanation failed: ${s.answer.slice(0, 160)}`);
    const ok = s && s.finished && s.depth === depth && s.code.includes(marker);
    if (ok && last && last.answer === s.answer && last.code === s.code) return { page, state: s };
    last = ok ? s : null;
    await sleep(1000);
  }
  throw new Error(`no finished ${depth} answer to the selection within ${timeout / 1000} s`);
}

/** A faded panel (clicked away) is woken the way a press on it does; returns the panel's opacity afterwards. */
export async function wake(page) {
  let { opacity } = await panelState(page);
  if (opacity !== '1') {
    await page.evaluate(() => document.querySelector('.ob')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await sleep(500);
    ({ opacity } = await panelState(page));
  }
  return opacity;
}

/** Opens or closes the selected-code block with its own "Show code" / "Show less" link. */
async function setCodeOpen(page, open) {
  if ((await panelState(page)).codeOpen === open) return;
  await page.locator('.ob-code .ob-link').first().click();
  await page.waitForFunction((want) => !!document.querySelector('.ob-code.is-open') === want, open, { timeout: 5000 });
  await sleep(300);
}

/** Geometry of the panel's parts, in CSS px of the page, plus the scroller's state. */
const layout = (page) => page.evaluate(() => {
  const rect = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) };
  };
  const scroll = document.querySelector('.ob-scroll');
  const all = document.querySelector('.ob-code__all');
  const answer = document.querySelector('.ob-answer:not(.more-detail__body)');
  // The answer's blocks (paragraphs, list items, the "Not sure:" line): a still may only end between two of them.
  const blocks = answer ? [...answer.querySelectorAll('.short-answer > :not(.short-answer__unsure), .short-answer__unsure, :scope > p, :scope > ul, :scope > ol, :scope > pre, :scope > h1, :scope > h2, :scope > h3')] : [];
  return {
    viewport: [innerWidth, innerHeight],
    scroll: rect(scroll),
    scrollTop: scroll?.scrollTop ?? 0,
    scrollMax: scroll ? scroll.scrollHeight - scroll.clientHeight : 0,
    head: rect(document.querySelector('.ob-head')),
    depthRow: rect(document.querySelector('.ob-depth')),
    code: rect(document.querySelector('.ob-code')),
    codeAll: all ? { ...rect(all), scrollWidth: all.scrollWidth, clientWidth: all.clientWidth, scrollHeight: all.scrollHeight, clientHeight: all.clientHeight } : null,
    answer: rect(answer),
    blocks: blocks.map((el) => ({ ...rect(el), text: (el.innerText ?? '').trim().slice(0, 40) })),
  };
});

const setScroll = async (page, top) => {
  await page.evaluate((y) => { const s = document.querySelector('.ob-scroll'); if (s) s.scrollTop = y; }, top);
  await sleep(400);
};

/**
 * Still A (the hook: header, depth row, the whole selected code) and still B (the whole answer, its "Not sure:" line
 * included; split into parts at block edges if the panel can't show it at once), each at every scale in `scales`.
 * The panel must keep the same answer, depth and code throughout; `expectCode` is the selection, compared exactly.
 * Returns the stills (file, size, sha256) and the checks, each { ok, what, why }.
 */
export async function captureStills(page, { dir, prefix, scales = [2, 3], expectCode }) {
  const checks = [];
  const check = (ok, what, why = '') => checks.push({ ok, what, why });
  const stills = [];
  const take = async (name, part) => {
    for (const scale of scales) {
      const file = path.join(dir, `${prefix}-${name}@${scale}x.png`);
      const [w, h] = await shot(page, file, { scale });
      stills.push({ still: name, part, scale, file: path.basename(file), size: [w, h], sha256: sha(readFileSync(file)) });
    }
  };
  const before = await panelState(page);
  check(before.code === expectCode, 'the panel holds exactly the selected code', `sha ${sha(Buffer.from(before.code, 'utf8')).slice(0, 12)}`);
  check(before.size[0] === 380, 'the panel is the app\'s own 380 px width', `${before.size.join('x')} CSS px`);

  // --- Still A: from the top, the code opened with its own link.
  check((await wake(page)) === '1', 'the panel is fully opaque (not faded) for still A');
  await setScroll(page, 0);
  await setCodeOpen(page, true);
  const a = await layout(page);
  const sa = await panelState(page);
  check(sa.depth === 'beginner', 'still A: the depth row shows Beginner lit', sa.depth);
  check(sa.proChip.includes('Pro'), 'still A: Expert\'s Pro chip shows as the app draws it', sa.proChip.join(', ') || 'none');
  check(Boolean(a.head && a.head.top >= 0), 'still A: the panel header is in the still', JSON.stringify(a.head));
  check(Boolean(a.depthRow && a.depthRow.bottom <= a.scroll.bottom), 'still A: the depth row is in the still', JSON.stringify(a.depthRow));
  check(Boolean(a.code && a.code.top >= a.scroll.top && a.code.bottom <= a.scroll.bottom), 'still A: the whole selected-code block is inside the panel\'s view', JSON.stringify(a.code));
  check(Boolean(a.codeAll && a.codeAll.scrollHeight <= a.codeAll.clientHeight + 1), 'still A: all 7 lines show without the code block scrolling', a.codeAll ? `${a.codeAll.scrollHeight}/${a.codeAll.clientHeight} px` : 'no code block');
  // The code block keeps each line on one line (white-space: pre) and scrolls sideways: a wider line is cut at its
  // right edge. Reported, not failed: it is how the app shows this code.
  const cut = a.codeAll && a.codeAll.scrollWidth > a.codeAll.clientWidth + 1;
  check(null, 'still A: code lines wider than the panel', cut ? `cut at the right edge: content ${a.codeAll.scrollWidth} px in a ${a.codeAll.clientWidth} px block (it scrolls sideways)` : 'none: every line fits');
  await take('a-hook', 1);

  // --- Still B: the answer, with the code folded again (the panel's default after an answer).
  await setCodeOpen(page, false);
  await setScroll(page, 0);
  check((await wake(page)) === '1', 'the panel is fully opaque (not faded) for still B');
  let b = await layout(page);
  if (b.answer && b.answer.top >= b.scroll.top && b.answer.bottom <= b.scroll.bottom) {
    await take('b-answer', 1);
    check(true, 'still B: the whole answer, "Not sure:" line included, in one still', `answer ${b.answer.top}-${b.answer.bottom} px in view ${b.scroll.top}-${b.scroll.bottom}`);
  } else {
    // Parts: each starts at a block's top and holds every block that fits whole below it.
    const view = b.scroll.bottom - b.scroll.top;
    const base = b.scrollTop;
    const blocks = b.blocks.map((x) => ({ ...x, top: x.top - b.scroll.top + base, bottom: x.bottom - b.scroll.top + base }));
    let i = 0;
    let part = 0;
    while (i < blocks.length) {
      const start = Math.max(0, blocks[i].top - 8);
      let j = i;
      while (j < blocks.length && blocks[j].bottom - start <= view) j++;
      if (j === i) { check(false, `still B: block ${i + 1} fits the panel's view`, `${blocks[i].bottom - blocks[i].top} px in ${view} px`); break; }
      await setScroll(page, start);
      b = await layout(page);
      const shown = b.blocks.slice(i, j).every((x) => x.top >= b.scroll.top && x.bottom <= b.scroll.bottom);
      part += 1;
      check(shown, `still B part ${part}: blocks ${i + 1}-${j} of ${blocks.length} whole in view`, b.blocks.slice(i, j).map((x) => x.text).join(' | '));
      await take(`b-answer-${part}`, part);
      i = j;
    }
  }
  await setScroll(page, 0);

  const after = await panelState(page);
  check(after.phase === 'done' && after.answer === before.answer && after.depth === before.depth && after.code === before.code && !after.detailOpen,
    'nothing changed while the stills were taken (same answer, depth and code; More detail never opened)');
  return { stills, checks, state: after, layoutA: a };
}
