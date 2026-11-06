// sections.js: drives sections.css. initSections(root) → cleanup. Stages only what starts below the fold, with motion
// allowed and IntersectionObserver present; everything else keeps its final frame (server HTML = no-JS = reduced motion).
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
const delayOf = (el) => +(getComputedStyle(el).getPropertyValue("--d") || 0);
const below = (el) => el.getBoundingClientRect().top > innerHeight;
const clamp = (v) => Math.min(1, Math.max(0, v));

// types el's text at 100 ms a character, +200 ms after a space, from `delay` ms; returns the undo
function typeText(el, delay) {
  const text = el.textContent, spans = [];
  el.textContent = "";
  for (const ch of text) {
    const s = el.appendChild(document.createElement("span"));
    s.textContent = ch;
    s.style.visibility = "hidden";
    spans.push(s);
  }
  let t = delay;
  const ids = spans.map((s, i) => {
    const id = setTimeout(() => (s.style.visibility = ""), t);
    t += 100 + (text[i] === " " ? 200 : 0);
    return id;
  });
  return () => { ids.forEach(clearTimeout); el.textContent = text; };
}

// segmented control: the pill sits on [data-seg-from] now; the returned function slides it to [data-seg-to]
function segPill(el) {
  const pill = el.querySelector("[data-seg-pill]"), from = el.querySelector("[data-seg-from]"), to = el.querySelector("[data-seg-to]");
  if (!pill || !from || !to) return null;
  const put = (item) => { pill.style.setProperty("--seg-x", item.offsetLeft + "px"); pill.style.setProperty("--seg-w", item.offsetWidth + "px"); };
  put(from);
  el.setAttribute("data-seg-live", "");
  return () => put(to);
}

/**
 * Presses every .sx-key in `keys` once (U --press-d ms after Control, if set) and fires "sx:keys" on `keys` at the
 * bottom of the press (120 ms), the frame to start a recording on. Call it from your own shortcut listener too.
 */
export function pressKeys(keys) {
  for (const k of keys.querySelectorAll(".sx-key")) { k.removeAttribute("data-pressing"); void k.offsetWidth; k.setAttribute("data-pressing", ""); }
  setTimeout(() => keys.dispatchEvent(new CustomEvent("sx:keys", { bubbles: true })), reduced() ? 0 : 120);
}

export function initSections(root = document) {
  const off = [];
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); off.push(() => t.removeEventListener(ev, fn, o)); };

  // copy buttons work with or without motion: label → "Copied" for 1.6 s (the label is aria-live)
  for (const b of root.querySelectorAll("[data-copy]")) on(b, "click", () => {
    navigator.clipboard?.writeText(b.dataset.copy);
    const label = b.querySelector(".sx-copy-label");
    if (!label) return;
    const was = label.dataset.was ??= label.textContent;
    label.textContent = "Copied";
    b.setAttribute("data-copied", "");
    clearTimeout(b._sx);
    b._sx = setTimeout(() => { label.textContent = was; b.removeAttribute("data-copied"); }, 1600);
  });
  // [data-keys]: a click presses the keys; with motion allowed they press themselves once at data-keys ms after init
  for (const k of root.querySelectorAll("[data-keys]")) {
    on(k, "click", () => pressKeys(k));
    if (!reduced() && k.dataset.keys) { const id = setTimeout(() => pressKeys(k), +k.dataset.keys); off.push(() => clearTimeout(id)); }
  }
  if (reduced() || typeof IntersectionObserver === "undefined") return () => off.forEach((f) => f());

  // reveal groups
  const groups = [...root.querySelectorAll("[data-reveal]")].filter(below);
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const g = e.target;
      if (!e.isIntersecting || e.intersectionRatio < Math.min(+(g.dataset.at || 0.15), innerHeight / e.boundingClientRect.height / 2)) continue;
      io.unobserve(g);
      if (g.hasAttribute("data-scroll")) { g.setAttribute("data-scroll", "go"); continue; }
      g.setAttribute("data-reveal", "go");
      for (const el of g.querySelectorAll("[data-typing]")) { off.push(typeText(el, delayOf(el))); el.style.visibility = ""; }
      for (const el of g.querySelectorAll("[data-seg]")) {
        const go = segPill(el);
        if (go) { const id = setTimeout(go, delayOf(el)); off.push(() => clearTimeout(id)); }
      }
    }
  }, { threshold: [0, 0.15, 0.3, 0.5] });
  off.push(() => io.disconnect());
  for (const g of groups) {
    g.setAttribute("data-reveal", "wait");
    g.querySelectorAll("[data-answer]").forEach((a) => [...a.children].forEach((c, i) => c.style.setProperty("--i", i)));
    for (const el of g.querySelectorAll("[data-typing]")) el.style.visibility = "hidden"; // no full-text flash before typing
    io.observe(g);
    off.push(() => g.setAttribute("data-reveal", ""));
  }

  // #3 scroll-linked rise: view() timeline where supported, else a one-shot at 30 %
  const live = CSS.supports?.("animation-timeline: view()");
  for (const el of [...root.querySelectorAll("[data-scroll]")].filter(below)) {
    if (live) el.setAttribute("data-scroll", "live");
    else { el.setAttribute("data-scroll", "wait"); el.dataset.at ||= "0.3"; io.observe(el); }
    off.push(() => el.setAttribute("data-scroll", ""));
  }

  // #2 sticky stage: the step crossing the viewport's middle picks the stage item
  for (const s of root.querySelectorAll("[data-sticky]")) {
    const items = [...s.querySelectorAll("[data-stage-item]")], steps = [...s.querySelectorAll("[data-step]")];
    if (!items.length) continue;
    s.setAttribute("data-sticky-live", "");
    let cur = -1;
    const show = (k) => {
      if (k === cur) return;
      items.forEach((it, i) => { it.toggleAttribute("data-on", i === k); it.toggleAttribute("data-was", i === cur); });
      cur = k;
    };
    show(0);
    const sio = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(steps.indexOf(e.target))), { rootMargin: "-45% 0px -45% 0px" });
    steps.forEach((st) => sio.observe(st));
    off.push(() => { sio.disconnect(); s.removeAttribute("data-sticky-live"); });
  }

  // scroll-tied custom properties: --p on [data-scrub] and [data-sticky] (its rail), --tp on [data-tone]
  const scrubs = [...root.querySelectorAll("[data-scrub], [data-sticky]")], tones = [...root.querySelectorAll("[data-tone]")];
  let raf = 0;
  const tick = () => {
    raf = 0;
    for (const el of scrubs) {
      const r = el.getBoundingClientRect();
      const p = el.hasAttribute("data-sticky") ? (innerHeight / 2 - r.top) / r.height : (innerHeight - r.top) / (innerHeight + r.height);
      el.style.setProperty("--p", clamp(p).toFixed(4));
    }
    // a "return" band goes to --tone-to over its first 20vh in view and back to --tone-from over its last 20vh
    for (const el of tones) {
      const r = el.getBoundingClientRect(), into = (innerHeight - r.top) / (0.2 * innerHeight);
      el.style.setProperty("--tp", clamp(el.dataset.tone === "return" ? Math.min(into, r.bottom / (0.2 * innerHeight)) : into).toFixed(4));
    }
  };
  if (scrubs.length || tones.length) { on(window, "scroll", () => (raf ||= requestAnimationFrame(tick)), { passive: true }); tick(); }

  // #5 pointer parts, fine pointers only
  if (fine()) {
    for (const el of root.querySelectorAll("[data-spot]")) on(el, "pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${(e.clientX - r.left) | 0}px`);
      el.style.setProperty("--my", `${(e.clientY - r.top) | 0}px`);
    });
    // tilt (≤ 3°) and magnet (≤ 6 px within 80 px): eased toward the target with a 120 ms lerp in one rAF loop
    const movers = [...root.querySelectorAll("[data-tilt], [data-magnet]")].map((el) => ({ el, tilt: el.hasAttribute("data-tilt"), cur: [0, 0], to: [0, 0] }));
    let loop = 0, last = 0;
    const step = (now) => {
      const k = 1 - Math.exp(-(now - (last || now)) / 120);
      last = now;
      let moving = false;
      for (const m of movers) {
        m.cur = m.cur.map((v, i) => v + (m.to[i] - v) * k);
        if (Math.abs(m.cur[0] - m.to[0]) + Math.abs(m.cur[1] - m.to[1]) > 0.01) moving = true;
        m.el.style.setProperty("--sx-t", m.tilt ? `perspective(1200px) rotateX(${m.cur[1].toFixed(2)}deg) rotateY(${m.cur[0].toFixed(2)}deg)` : `translate(${m.cur[0].toFixed(2)}px, ${m.cur[1].toFixed(2)}px)`);
      }
      loop = moving ? requestAnimationFrame(step) : (last = 0);
    };
    on(window, "pointermove", (e) => {
      for (const m of movers) {
        const r = m.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        if (m.tilt) {
          const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          m.to = inside ? [((e.clientX - cx) / r.width) * 6, ((cy - e.clientY) / r.height) * 6] : [0, 0];
        } else {
          const dx = e.clientX - cx, dy = e.clientY - cy, near = Math.max(0, Math.abs(dx) - r.width / 2) ** 2 + Math.max(0, Math.abs(dy) - r.height / 2) ** 2 < 6400;
          m.to = near ? [Math.max(-6, Math.min(6, dx * 0.12)), Math.max(-6, Math.min(6, dy * 0.12))] : [0, 0];
        }
      }
      loop ||= requestAnimationFrame(step);
    }, { passive: true });
    off.push(() => cancelAnimationFrame(loop));
  }
  off.push(() => cancelAnimationFrame(raf));
  return () => off.forEach((f) => f());
}
