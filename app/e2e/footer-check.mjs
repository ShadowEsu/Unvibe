// First-run footer in view (Unvibe QA for the lead and Design, 0.1.50 RC df9c5497): the Back/forward row
// (`.ob2 .ob__actions`) and each button in it that is shown must be fully in view with nothing scrolled:
// inside the window and the card, not clipped by any overflow ancestor, and on top at its centre. A button
// that is not rendered (step 1's disabled Back: visibility hidden) is listed as hidden, not judged.
// Measured once the row has held still for 1.5 s (the step's entrance and Vibe's typewriter are done).
// Playwright's click scrolls first and its visibility check ignores clipping, so neither proves this.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function footerInView(page, forwardName) {
  const row = page.locator('.ob2 .ob__actions').first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  if (forwardName) await row.getByRole('button', { name: forwardName, exact: true }).first().waitFor({ state: 'attached', timeout: 10000 });
  // Wait until the whole card holds still for 1.5 s: every child's box and Vibe's speech text (its typewriter
  // can wrap the bubble to a second line seconds after the step appears, which moves the body).
  let last = '';
  let since = Date.now();
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const box = await row.evaluate((el) => {
      const card = el.closest('.ob2__card') || el;
      const rects = [...card.children, ...el.querySelectorAll('button')].map((e) => {
        const r = e.getBoundingClientRect();
        return [r.top, r.left, r.bottom, r.right].map(Math.round).join(',');
      }).join(';');
      return `${rects}|${card.querySelector('.ob2__speech')?.textContent.length ?? ''}`;
    });
    if (box !== last) { last = box; since = Date.now(); } else if (Date.now() - since >= 1500) break;
    await sleep(250);
  }
  return row.evaluate((rowEl, name) => {
    const round = (r) => ({ top: Math.round(r.top), left: Math.round(r.left), bottom: Math.round(r.bottom), right: Math.round(r.right) });
    const tagOf = (a) => `${a.tagName.toLowerCase()}${typeof a.className === 'string' && a.className.trim() ? `.${a.className.trim().split(/\s+/).join('.')}` : ''}`;
    const shown = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.visibility === 'visible' && s.display !== 'none' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
    };
    const card = rowEl.closest('.ob2__card');
    const cardRect = card?.getBoundingClientRect();
    const measure = (el) => {
      const b = el.getBoundingClientRect();
      const within = (o) => b.top >= o.top - 0.5 && b.left >= o.left - 0.5 && b.bottom <= o.bottom + 0.5 && b.right <= o.right + 0.5;
      const clippedBy = [];
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
        const r = a.getBoundingClientRect();
        const inner = { top: r.top + a.clientTop, left: r.left + a.clientLeft, bottom: r.top + a.clientTop + a.clientHeight, right: r.left + a.clientLeft + a.clientWidth };
        if (!within(inner)) clippedBy.push(tagOf(a));
      }
      const hit = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
      return {
        what: el === rowEl ? 'footer row' : `button "${el.innerText.trim()}"`,
        rect: round(b),
        inWindow: within({ top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth }),
        inCard: !!cardRect && within(cardRect),
        clippedBy,
        onTop: !!hit && (hit === el || el.contains(hit)),
      };
    };
    const buttons = [...rowEl.querySelectorAll('button')];
    const visible = buttons.filter(shown);
    const forward = name ? visible.find((b) => b.innerText.trim() === name) : visible.at(-1);
    const scrolled = [];
    for (let a = rowEl; a; a = a.parentElement) if (a.scrollTop > 0 || a.scrollLeft > 0) scrolled.push(`${tagOf(a)} ${a.scrollTop}`);
    const body = rowEl.closest('.ob2')?.querySelector('.ob2__body');
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      forward: forward ? forward.innerText.trim() : null,
      card: cardRect ? round(cardRect) : null,
      parts: [rowEl, ...visible].map(measure),
      hidden: buttons.filter((b) => !shown(b)).map((b) => b.textContent.trim() || b.className),
      scrolled,
      bodyOverflow: body ? Math.max(0, body.scrollHeight - body.clientHeight) : null,
      // What the overflow hides: how far the body's own content reaches past its visible (padding) box. An
      // overflow that is only the body's bottom padding hides nothing but still gives a small scroll range.
      bodyContentCut: body ? Math.max(0, Math.round(Math.max(...[...body.children].map((c) => c.getBoundingClientRect().bottom), -Infinity)
        - (body.getBoundingClientRect().top + body.clientTop + body.clientHeight))) : null,
      bodyPaddingBottom: body ? parseFloat(getComputedStyle(body).paddingBottom) : null,
      speech: rowEl.closest('.ob2__card')?.querySelector('.ob2__speech')?.textContent.trim() ?? null,
    };
  }, forwardName);
}

/**
 * Checks per step: the footer is in view; nothing in the step's body is cut off; the body needs no scrolling at
 * all (the raw overflow, padding included); plus the window size when `size` is given. A failing step gets a
 * still in `shotDir`.
 */
export async function checkFooter(page, label, forwardName, { log, size = null, shotDir = null }) {
  const m = await footerInView(page, forwardName).catch((e) => ({ error: e.message.split('\n')[0] }));
  if (m.error) { log(false, `${label}: footer measured`, m.error); return; }
  const bad = m.parts.filter((p) => !p.inWindow || !p.inCard || p.clippedBy.length || !p.onTop);
  const fwd = m.parts.find((p) => p.what === `button "${m.forward}"`);
  const results = [
    [!!m.forward && !bad.length && !m.scrolled.length, `${label}: "${m.forward}" and the footer row fully in view without scrolling (${m.viewport})`,
      JSON.stringify({ forward: fwd?.rect, card: m.card, hidden: m.hidden, bad, scrolled: m.scrolled })],
    [m.bodyContentCut === 0, `${label}: nothing in the step is cut off`, `content past the visible body ${m.bodyContentCut}px`],
    [m.bodyOverflow === 0, `${label}: the step fits whole (its body needs no scrolling)`,
      `body scroll range ${m.bodyOverflow}px (its bottom padding is ${m.bodyPaddingBottom}px); speech "${m.speech}"`],
  ];
  if (size) results.push([m.viewport === size, `${label}: measured at the default Mac window ${size}`, m.viewport]);
  for (const [ok, name, detail] of results) log(ok, name, detail);
  if (shotDir && results.some(([ok]) => !ok)) {
    await page.screenshot({ path: `${shotDir}/footer-${label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}.png` }).catch(() => {});
  }
}
