"use client";

/**
 * Direction D's effects from Preston's prompts (unvibe-site's share; Motion owns hero rise, arches, dock, steps,
 * bgswap, section enter and the live demo):
 * - Halden: the canvas bowl glow (96 × 60, stretched; scroll keys + intro), the shared letter reveal, the pinned
 *   statement, the nav CTA pop at p > .4, the dark split's headline reveal, row fade and slow image zoom.
 * - Video hero: the count-up stats (easeOutCubic 1500 + i·80 ms after 480 + i·90 ms, once, at 25 % in view).
 * Reduced motion: final states, a static bowl at q = 0, no count (the numbers show).
 */
import { useEffect, useRef, type ReactNode } from "react";

type RGB = readonly [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c: RGB) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0})`;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ───────────── letter reveal (Halden, shared) ───────────── */

/** Per-character spans, words kept whole; `em` words are italic and end in the accent. `br` keeps line breaks. */
export function Letters({ parts }: { parts: ReadonlyArray<{ text: string; em?: boolean; br?: boolean }> }) {
  return (
    <>
      {parts.map((part, pi) => (
        <span key={pi}>
          {part.br ? <br /> : null}
          {part.text.split(/(\s+)/).map((word, wi) => (/^\s+$/.test(word) ? " " : word ? (
            <span key={wi} className={part.em ? "d-w d-w--em" : "d-w"}>
              {Array.from(word).map((ch, ci) => <span key={ci} className="d-ch" data-hi={part.em ? "" : undefined}>{ch}</span>)}
            </span>
          ) : null))}
        </span>
      ))}
    </>
  );
}

type Palette = { ghost: RGB; accent: RGB; final: RGB; hi: RGB; minOpacity?: number; maxBlur?: number };
/** Halden's mapping per character: 0-.35 fade in (blur 8 → 1.5), .35-.70 ghost → accent (blur → 0), .70-1 accent → final. */
function paint(chars: HTMLElement[], p: number, spread: number, pal: Palette) {
  const n = chars.length;
  const lo = pal.minOpacity ?? 0;
  const maxBlur = pal.maxBlur ?? 8;
  chars.forEach((el, i) => {
    const t = clamp((p * (1 + spread) - i / n) / spread);
    const final = el.dataset.hi !== undefined ? pal.hi : pal.final;
    let o = 1, c: RGB = pal.ghost, blur = 0;
    if (t < 0.35) { const k = t / 0.35; o = lo + (1 - lo) * k; blur = maxBlur - (maxBlur - 1.5 * (maxBlur / 8)) * k; }
    else if (t < 0.7) { const k = (t - 0.35) / 0.35; c = mix(pal.ghost, pal.accent, k); blur = 1.5 * (maxBlur / 8) * (1 - k); }
    else { c = mix(pal.accent, final, (t - 0.7) / 0.3); }
    el.style.opacity = o.toFixed(3);
    el.style.color = rgb(c);
    el.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "";
  });
}
function finish(chars: HTMLElement[], pal: Palette) { paint(chars, 1, 0.35, pal); }

/* ───────────── bowl glow (Halden) ───────────── */

const KEYS = { q: [0, 0.03, 0.08, 0.18, 0.4, 0.66, 0.87, 1.15, 1.43, 1.8], tip: [0.3, 0.45, 0.65, 0.8, 0.95, 1.05, 1.05, 1.1, 1.3, 2.4], half: [0.34, 0.38, 0.38, 0.38, 0.38, 0.46, 0.66, 0.9, 1.6, 3], soft: [0.22, 0.26, 0.22, 0.22, 0.19, 0.16, 0.13, 0.1, 0.1, 0.1] };
function key(arr: number[], q: number) {
  const qs = KEYS.q;
  if (q <= qs[0]) return arr[0];
  for (let i = 1; i < qs.length; i++) if (q <= qs[i]) { const k = (q - qs[i - 1]) / (qs[i] - qs[i - 1]); return arr[i - 1] + (arr[i] - arr[i - 1]) * k; }
  return arr[arr.length - 1];
}

/** Draws the bowl into a 96 × 60 canvas (CSS stretches it; bilinear upscaling keeps it smooth). */
function drawBowl(ctx: CanvasRenderingContext2D, img: ImageData, aspect: number, tip: number, half: number, soft: number, cols: { out: RGB; rim: RGB; core: RGB }) {
  const W = 96, H = 60, RND = 0.25;
  const pts: Array<[number, number]> = [];
  for (let k = 0; k < 48; k++) {
    const yy = -0.3 + ((tip + 0.3) * k) / 47;
    pts.push([half * aspect * Math.pow(Math.max(0, 1 - yy / tip), 0.72), yy]);
  }
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const py = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const px = Math.abs((x + 0.5) / W - 0.5) * aspect;
      let best = Infinity;
      for (let k = 1; k < pts.length; k++) {
        const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
        const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
        const t = clamp((wx * vx + wy * vy) / (vx * vx + vy * vy || 1));
        const dx = wx - vx * t, dy = wy - vy * t;
        const dist = dx * dx + dy * dy;
        if (dist < best) best = dist;
      }
      const inside = py < tip && px < half * aspect * Math.pow(Math.max(0, 1 - py / tip), 0.72);
      const sd = (inside ? -Math.sqrt(best) : Math.sqrt(best)) - RND;
      const g = 1 - smooth((sd + soft) / (2 * soft));
      const c = g < 0.38 ? mix(cols.out, cols.rim, smooth(g / 0.38)) : mix(cols.rim, cols.core, smooth((g - 0.38) / 0.62));
      const o = (y * W + x) * 4;
      d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const STATEMENT_PAL: Palette = { ghost: hex("#9a92b4"), accent: hex("#5a3fe0"), final: hex("#17131f"), hi: hex("#2c185c"), minOpacity: 0.15 };

/**
 * The pinned statement over the bowl (Halden scene 2): 306 vh tall, the pin is 100 vh. q is Halden's global q, as if
 * the hero sat right above: q = .69 when the section's top reaches the viewport top. The bowl deepens and floods,
 * the text rises (s) and reveals letter by letter with scroll (p, spread .16); at p > .4 the nav CTA pops.
 */
export function Statement({ id, labelledBy, children }: { id?: string; labelledBy: string; children: ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sec = section.current, cv = canvas.current, tx = text.current;
    if (!sec || !cv || !tx) return undefined;
    const ctx = cv.getContext("2d");
    if (!ctx) return undefined;
    const img = ctx.createImageData(96, 60);
    const css = getComputedStyle(sec);
    const cols = { out: hex(css.getPropertyValue("--bowl-out").trim() || "#faf8f5"), rim: hex(css.getPropertyValue("--bowl-rim").trim() || "#e4deff"), core: hex(css.getPropertyValue("--bowl-core").trim() || "#b8a6ff") };
    const chars = Array.from(tx.querySelectorAll<HTMLElement>(".d-ch"));
    const navctas = Array.from(document.querySelectorAll<HTMLElement>("[data-d-navcta]"));
    const setNav = (on: boolean) => navctas.forEach((n) => n.toggleAttribute("data-on", on));
    const rm = reduced();
    const q0 = () => 0.69 + (window.scrollY - (sec.getBoundingClientRect().top + window.scrollY)) / window.innerHeight;
    const cur = { tip: -0.3, half: 0.3, soft: 0.1 };
    let raf = 0, t0 = 0, visible = false;
    const frame = (now: number) => {
      raf = 0;
      if (!t0) t0 = now;
      const q = q0();
      const aspect = window.innerWidth / window.innerHeight;
      const tgt = { tip: key(KEYS.tip, q), half: key(KEYS.half, q), soft: key(KEYS.soft, q) };
      const intro = (now - t0 - 250) / 1050;
      if (rm) { Object.assign(cur, tgt); }
      else if (intro < 1) { const k = smooth(intro); cur.tip = -0.3 + (tgt.tip + 0.3) * k; cur.half = 0.3 + (tgt.half - 0.3) * k; cur.soft = 0.1 + (tgt.soft - 0.1) * k; }
      else { cur.tip += (tgt.tip - cur.tip) * 0.12; cur.half += (tgt.half - cur.half) * 0.12; cur.soft += (tgt.soft - cur.soft) * 0.12; }
      const drift = rm ? { tip: 0, half: 0 } : { tip: Math.sin(now * 0.00033 + 1.3) * 0.02, half: Math.sin(now * 0.0005) * 0.015 };
      drawBowl(ctx, img, aspect, cur.tip + drift.tip, cur.half + drift.half, cur.soft, cols);
      const s = clamp((q - 0.69) / 0.74);
      tx.style.transform = rm ? "" : `translate3d(0, ${(0.205 * (1 - s) ** 2 * window.innerHeight).toFixed(1)}px, 0)`;
      const p = clamp((q - 0.56) / 2.03);
      if (rm) finish(chars, STATEMENT_PAL); else paint(chars, p, 0.16, STATEMENT_PAL);
      setNav(p > 0.4 || q > 2.75);
      if (visible && !rm) raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    }, { rootMargin: "20% 0px" });
    io.observe(sec);
    const onScroll = () => { if (rm && !raf) raf = requestAnimationFrame(frame); };
    const onPast = () => { if (!visible) setNav(q0() > 1.2); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onPast, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); window.removeEventListener("scroll", onPast); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <section ref={section} id={id} className="d-stmt" aria-labelledby={labelledBy}>
      <div className="d-stmt__pin">
        <canvas ref={canvas} className="d-stmt__bowl" width={96} height={60} aria-hidden="true" />
        <div ref={text} className="d-stmt__text">{children}</div>
      </div>
    </section>
  );
}

/* ───────────── dark split (Halden scene 3) ───────────── */

const DARK_PAL: Palette = { ghost: hex("#5c5870"), accent: hex("#cfc4ff"), final: hex("#ffffff"), hi: hex("#cfc4ff") };

/** p2 = clamp((.8 − top/vh)/.65) drives the headline (spread .35); the row fades up past .92; the image zooms
 * 1.08 → 1 as the panel arrives (scale = 1.08 − .08 · clamp(1 − top/vh)). */
export function DarkSplit({ labelledBy, heading, row, media }: { labelledBy: string; heading: ReactNode; row: ReactNode; media: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const chars = Array.from(el.querySelectorAll<HTMLElement>(".d-split__h .d-ch"));
    const rowEl = el.querySelector<HTMLElement>(".d-split__row");
    const zoom = el.querySelector<HTMLElement>("[data-d-zoom]");
    if (reduced()) { finish(chars, DARK_PAL); rowEl?.setAttribute("data-on", ""); return undefined; }
    let raf = 0;
    const apply = () => {
      raf = 0;
      const top = el.getBoundingClientRect().top / window.innerHeight;
      const p2 = clamp((0.8 - top) / 0.65);
      paint(chars, p2, 0.35, DARK_PAL);
      rowEl?.toggleAttribute("data-on", p2 > 0.92);
      if (zoom) zoom.style.transform = `scale(${(1.08 - 0.08 * clamp(1 - top)).toFixed(4)})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <section ref={root} className="d-split" aria-labelledby={labelledBy}>
      <div className="d-split__left">
        <span className="d-split__guide" aria-hidden="true" />
        <h2 id={labelledBy} className="d-split__h d-serif">{heading}</h2>
        <div className="d-split__row">{row}</div>
      </div>
      <div className="d-split__right">{media}</div>
    </section>
  );
}

/* ───────────── count-up stats (video hero) ───────────── */

/** `value` counts up from 0; a `text` value (e.g. "No") shows as is and never counts. */
export function Stats({ items }: { items: ReadonlyArray<{ value: number | string; label: ReactNode; icon: ReactNode }> }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || reduced()) return undefined;
    const nums = Array.from(el.querySelectorAll<HTMLElement>("[data-count]"));
    nums.forEach((n) => { n.textContent = "0"; });
    const timers: number[] = [];
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      nums.forEach((n, i) => {
        const to = Number(n.dataset.count);
        const dur = 1500 + i * 80;
        timers.push(window.setTimeout(() => {
          const t0 = performance.now();
          const tick = (now: number) => {
            const k = clamp((now - t0) / dur);
            n.textContent = String(Math.round(to * (1 - (1 - k) ** 3)));
            if (k < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }, 480 + i * 90));
      });
    }, { threshold: 0.25 });
    io.observe(el);
    return () => { io.disconnect(); timers.forEach((t) => clearTimeout(t)); };
  }, []);
  return (
    <div ref={root} className="d-stats">
      {items.map((item, i) => (
        <div key={i} className="d-stat" data-d-enter="" style={{ "--d": `${500 + i * 80}ms` } as React.CSSProperties}>
          <span className="d-stat__icon" aria-hidden="true">{item.icon}</span>
          <span className="d-stat__value">{typeof item.value === "number" ? <span data-count={item.value}>{item.value}</span> : item.value}</span>
          <span className="d-stat__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/** The CTA's dot that grows into a circle holding a chevron (Halden button hover). */
export function BtnDot() {
  return (
    <span className="d-btn__dot" aria-hidden="true">
      <svg viewBox="0 0 12 12" width="12" height="12"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}
