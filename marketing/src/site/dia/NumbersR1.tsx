"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { compensationCreditsUsd, compensationTotalLabel, compensationTotalPhrase, formatUsd } from "@/data/compensation";
import { explainPages } from "@/lib/explainPages";
import { OceanBand } from "@/site/sharks/OceanBand";
import { D_STATS } from "./content";

/**
 * Ledger 598: three candidates for the homepage "Unvibe in numbers" section (Design's file 20261111-1137), rendered
 * from the code on site/numbers-r1 for Preston's pick in Slack. Money comes from data/compensation.ts only (Security
 * M6); the server HTML holds the final figure, the count-up is a client embellishment that ends on that exact value
 * and never runs under reduced motion (M5); the label, "Not cash. Not a round." and the /investors link sit in the
 * same card (M1, M2; the total needs the long form, Security 1232). None of the M4 words appear.
 */
export type NumbersVariant = "n1" | "n2" | "n3";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The four facts as N3's glass bar (also N1's row under the money card, Design S-1 r1). Same strings. */
function FactBar({ className = "" }: { className?: string }) {
  return (
    <ul className={`d-nb d-glass ${className}`.trim()} aria-label={D_STATS.label} data-d-enter="">
      <li style={d(0)}><strong>4 depths free,</strong><span className="d-nb__tail">New to Advanced</span></li>
      <li style={d(70)}><strong>Mac and Windows</strong></li>
      <li style={d(140)}><Keys /><span className="d-nb__tail">in any app</span></li>
      <li style={d(210)}><strong>No card, no API key</strong></li>
    </ul>
  );
}

/** Security 1232: after a total that includes "committed cash", only the long form is true. */
const DISCLAIMER_LONG = "Credits are not cash. Not a round.";
const WHERE = "Where it comes from";

function Keys() {
  return (
    <span className="d-keys d-nr__keys" aria-label={typeof D_STATS.items[2].label === "string" ? D_STATS.items[2].label : D_STATS.items[2].label.mac}>
      <span className="lx-mac"><kbd>Control</kbd><kbd>U</kbd></span>
      <span className="lx-win"><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>U</kbd></span>
    </span>
  );
}

/**
 * Counts a figure up from 0 once, when 40 % of the section is in view. The element's text is the final figure in the
 * server HTML and its aria-label; only the visible digits move (M5). Formatting follows the final label's grouping.
 */
function useCountUp(root: React.RefObject<HTMLElement | null>, ms: number) {
  useEffect(() => {
    const el = root.current;
    if (!el || reduced()) return undefined;
    const nums = Array.from(el.querySelectorAll<HTMLElement>("[data-nr-count]"));
    if (!nums.length) return undefined;
    const finals = nums.map((n) => n.textContent ?? "");
    const format = (final: string, k: number) => {
      const digits = final.replace(/[^0-9]/g, "");
      const value = Math.round(Number(digits) * k);
      let out = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, final.includes(",") ? "," : "");
      if (final.startsWith("$")) out = `$${out}`;
      return out;
    };
    nums.forEach((n, i) => { n.textContent = format(finals[i], 0); });
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        const eased = 1 - (1 - k) ** 3;
        nums.forEach((n, i) => { n.textContent = k >= 1 ? finals[i] : format(finals[i], eased); });
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      nums.forEach((n, i) => { n.textContent = finals[i]; });
    };
  }, [root, ms]);
}

/** A figure whose final value is in the HTML and the aria-label; the moving digits are aria-hidden. */
function Figure({ value, className }: { value: string; className?: string }) {
  return (
    <span className={className} aria-label={value} role="text">
      <span data-nr-count="" aria-hidden="true">{value}</span>
    </span>
  );
}

/* ───────────────────────── N1 "Ocean": the figure on glass, sharks behind ───────────────────────── */
export function NumbersN1() {
  const root = useRef<HTMLDivElement>(null);
  useCountUp(root, 1600);
  return (
    <section className="d-nr d-nr--n1" aria-labelledby="d-nr-h">
      <OceanBand className="d-nr__ocean" />
      <div ref={root} className="d-nr__wrap">
        <div className="d-nr__card d-glass" data-d-enter="">
          <h2 id="d-nr-h" className="d-label d-mono d-nr__label">({D_STATS.label})</h2>
          <Figure value={compensationTotalLabel()} className="d-nr__figure d-serif" />
          <p className="d-nr__phrase" data-d-enter="" style={d(80)}>{compensationTotalPhrase()}</p>
          <p className="d-nr__small" data-d-enter="" style={d(160)}>{DISCLAIMER_LONG}</p>
          <p className="d-nr__where" data-d-enter="" style={d(240)}>
            <Link href="/investors">{WHERE} <span aria-hidden="true">→</span></Link>
          </p>
        </div>
        <FactBar className="d-nr__bar" />
      </div>
    </section>
  );
}

/* ───────────────────────── N2 "Ledger": an itemised list, credits only ───────────────────────── */
function Row({ name, under, value, href, className = "" }: { name: ReactNode; under?: ReactNode; value: ReactNode; href?: string; className?: string }) {
  const inner = (
    <>
      <span className="d-nl__name">
        <span>{name}</span>
        {under ? <span className="d-nl__under">{under}</span> : null}
      </span>
      <span className="d-nl__leader" aria-hidden="true" />
      <span className="d-nl__value">{value}</span>
      <span className="d-nl__arrow" aria-hidden="true">{href ? "→" : ""}</span>
    </>
  );
  return (
    <li className={`d-nl__row ${className}`.trim()} data-d-enter="">
      {href ? <Link href={href} className="d-nl__link">{inner}</Link> : inner}
    </li>
  );
}

export function NumbersN2() {
  const root = useRef<HTMLDivElement>(null);
  useCountUp(root, 1400);
  const credits = formatUsd(compensationCreditsUsd());
  return (
    <section className="d-nr d-nr--n2" aria-labelledby="d-nr-h">
      <h2 id="d-nr-h" className="d-label d-mono" data-d-enter="">({D_STATS.label})</h2>
      <div ref={root} className="d-nl d-glass">
        <ol className="d-nl__rows">
          <Row
            className="d-nl__row--money"
            name="Startup-program credits and plan value"
            under={<>{DISCLAIMER_LONG} <span className="d-nl__where">{WHERE}</span></>}
            value={<Figure value={credits} className="d-nl__figure d-serif" />}
            href="/investors"
          />
          <Row name="Depths, free" under="Expert is part of Pro." value={<span className="d-nl__num d-serif">4 of 5</span>} />
          <Row name="Platforms" value={<span className="d-nl__text">Mac, Windows</span>} />
          <Row name="Shortcut" value={<Keys />} />
          <Row name="Card or API key needed" value={<span className="d-nl__text">None</span>} />
          <Row name="Languages and tools on the web explainer" value={<Figure value={String(explainPages.length)} className="d-nl__num d-serif" />} href="/explain" />
        </ol>
      </div>
    </section>
  );
}

/* ───────────────────────── N3 "Fact bar": no money, no section ───────────────────────── */
export function NumbersN3() {
  return (
    <div className="d-nb-wrap">
      <FactBar />
    </div>
  );
}
