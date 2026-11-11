"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Title } from "./content";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A title with its one italic serif word (kynejang). The word gets the lime highlight that sweeps in behind it like a
 * code selection when the heading enters (ANIMATIONS #5; CSS on [data-d-words][data-in] .d-hl).
 */
export function T({ t }: { t: Title }) {
  return <>{t.before} <em className="d-hl">{t.em}</em>{t.after ?? ""}</>;
}

/** A string, or a Mac/Windows pair (both in the HTML; the pre-paint OS class shows one). */
export function Os({ v }: { v: string | { readonly mac: string; readonly windows: string } }) {
  return typeof v === "string" ? <>{v}</> : <><span className="lx-mac">{v.mac}</span><span className="lx-win">{v.windows}</span></>;
}

/** A pixel cluster (violet, one lime pixel; plan rev 3): drawn on pixel by pixel when it enters (ANIMATIONS #10). */
export function Pixels({ size = 6 }: { size?: number }) {
  const cells = [[0, 0], [1, 0], [1, 1], [2, 1], [0, 2], [2, 2]];
  return (
    <svg className="d-px" viewBox="0 0 3 3" width={size * 3} height={size * 3} data-d-pixel="" style={{ "--d-rows": 3 } as CSSProperties} aria-hidden="true">
      {cells.map(([x, y], i) => <rect key={i} x={x} y={y} width="1" height="1" fill={i === 3 ? "#d6f45a" : "#8b6cf0"} />)}
    </svg>
  );
}

/** Vibe, our ghost, as a 12 × 12 pixel sprite (the cards corner, the FAQ tile; ANIMATIONS #10). */
const VIBE_ROWS = [
  "....XXXX....",
  "..XXLLLLXX..",
  ".XLLLLLLLLX.",
  ".XLLLLLLLLX.",
  "XLLLKLLKLLLX",
  "XLLLKLLKLLLX",
  "XLLLLLLLLLLX",
  "XLLLLLLLLLLX",
  "XLLLLLLLLLLX",
  "XLLLLLLLLLLX",
  "XLLXLLLXLLLX",
  "XXX.XXX.XXXX",
];
export function PixelVibe({ size = 4, className = "" }: { size?: number; className?: string }) {
  const fill = { X: "#17131f", L: "#b8a6ff", K: "#17131f" } as const;
  return (
    <svg className={`d-pxvibe ${className}`} viewBox="0 0 12 12" width={size * 12} height={size * 12} data-d-pixel="" style={{ "--d-rows": 12 } as CSSProperties} shapeRendering="crispEdges" aria-hidden="true">
      {VIBE_ROWS.flatMap((row, y) => Array.from(row).map((c, x) => (c === "." ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={fill[c as keyof typeof fill]} />)))}
    </svg>
  );
}

/**
 * The lime ribbon (ANIMATIONS #4): a 7 px stroke with a twist (a second, thinner strand crossing it) that draws itself
 * along its curve with the scroll as it crosses the view, then fades. Stroke offset + opacity only, no layout.
 * Reduced motion: not shown (CSS).
 */
export function Ribbon({ flip = false }: { flip?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || reduced()) return undefined;
    let raf = 0;
    let near = false;
    const apply = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the ribbon's top meets the viewport's bottom, 1 when it reaches 25 % from the top
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.75 + r.height)));
      el.style.setProperty("--d-draw", p.toFixed(4));
      el.style.setProperty("--d-fade", Math.min(1, Math.max(0, (1 - p) / 0.25 + (p < 0.75 ? 1 : 0))).toFixed(3));
    };
    const onScroll = () => { if (near && !raf) raf = requestAnimationFrame(apply); };
    const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; onScroll(); }, { rootMargin: "10% 0px" });
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  const d = flip ? "M-20 150 C 260 40, 520 210, 760 110 S 1240 20, 1460 120" : "M-20 60 C 280 170, 560 10, 800 100 S 1220 190, 1460 70";
  return (
    <div ref={root} className="d-ribbon" aria-hidden="true">
      <svg viewBox="0 0 1440 200" preserveAspectRatio="none">
        <path d={d} pathLength={1} className="d-ribbon__a" />
        <path d={d} pathLength={1} className="d-ribbon__b" transform="translate(0 6)" />
      </svg>
    </div>
  );
}

/**
 * The pixel-checker wipe into the violet section (ANIMATIONS #11; the IG reel's B9 move): 48 px cream squares cover the
 * section's top and flip away in a diagonal sweep, 450 ms, once, when the section's top passes 70 % of the view.
 * Opacity only. Reduced motion or no JavaScript: no squares (a plain cut).
 */
export function PixelWipe() {
  const root = useRef<HTMLDivElement>(null);
  const [grid, setGrid] = useState<{ cols: number; rows: number } | null>(null);
  useEffect(() => {
    const el = root.current;
    if (!el || reduced()) return undefined;
    setGrid({ cols: Math.ceil(el.clientWidth / 48), rows: Math.ceil(el.clientHeight / 48) });
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      el.setAttribute("data-go", "");
    }, { rootMargin: "0px 0px -30% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={root} className="d-wipe" aria-hidden="true">
      {grid
        ? Array.from({ length: grid.cols * grid.rows }, (_, i) => {
            const x = i % grid.cols;
            const y = Math.floor(i / grid.cols);
            // the sweep runs from the top-left; ~450 ms across the diagonal, with a little scatter
            const delay = ((x + y) / (grid.cols + grid.rows)) * 360 + ((x * 7 + y * 13) % 5) * 18;
            return <i key={i} style={{ left: x * 48, top: y * 48, "--wd": `${delay.toFixed(0)}ms` } as CSSProperties} />;
          })
        : null}
    </div>
  );
}

/**
 * Short answers (mock 17; ANIMATIONS #30): <button aria-expanded> rows, the first open. Every answer is in the HTML
 * (crawlable, FAQPage JSON-LD unchanged in shape); a closed answer is collapsed to 0 rows and inert. The + turns into
 * a − and the answer opens in 200 ms (CSS grid rows); reduced motion: at once.
 */
export function Faq({ items }: { items: ReadonlyArray<{ id: string; question: string; answer: ReactNode }> }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);
  const base = useId();
  return (
    <div className="d-faq">
      {items.map((item) => {
        const on = open === item.id;
        return (
          <div key={item.id} className="d-faq__item" data-open={on ? "" : undefined}>
            <h3>
              <button type="button" id={`${base}-${item.id}-q`} aria-expanded={on} aria-controls={`${base}-${item.id}-a`} onClick={() => setOpen(on ? null : item.id)}>
                {item.question}
                <span className="d-faq__pm" aria-hidden="true" />
              </button>
            </h3>
            {/* React 18 has no typed `inert`; an unknown lowercase attribute passes through as is */}
            <div className="d-faq__a" id={`${base}-${item.id}-a`} role="region" aria-labelledby={`${base}-${item.id}-q`} {...((on ? {} : { inert: "" }) as object)}>
              <div>{item.answer}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
