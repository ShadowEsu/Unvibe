"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { INCIDENTS, PROBLEM_STATS, VERDICTS, VERDICT_ORDER, formatStat, verdictCounts, type Source } from "@/data/problem";
import { D_PROBLEM } from "./content";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** Ease out cubic, k in 0..1. */
const easeOut = (k: number) => 1 - (1 - k) ** 3;

/** Counts each stat up from zero once the strip is 40 % in view; reduced motion keeps the printed values. */
function useCountUp(root: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const nums = Array.from(el.querySelectorAll<HTMLElement>("[data-pb-count]"));
    const stat = (n: HTMLElement) => PROBLEM_STATS[Number(n.dataset.pbCount)];
    nums.forEach((n) => { const s = stat(n); if (s) n.textContent = formatStat(s, 0); });
    const timers: number[] = [];
    let raf = 0;
    const run = (n: HTMLElement, i: number) => {
      const s = stat(n);
      if (!s) return;
      const t0 = performance.now();
      const dur = 1400 + i * 120;
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const v = s.value * easeOut(k);
        n.textContent = formatStat(s, s.decimals ? v : Math.round(v));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      io.disconnect();
      nums.forEach((n, i) => timers.push(window.setTimeout(() => run(n, i), 200 + i * 120)));
    }, { threshold: 0.4 });
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach((t) => clearTimeout(t));
      cancelAnimationFrame(raf);
      nums.forEach((n) => { const s = stat(n); if (s) n.textContent = formatStat(s, s.value); });
    };
  }, [root]);
}

/** "Source: A, B" with each source linked to its public original when there is one; `prefix={null}` drops the label. */
export function SourceLine({ sources, prefix = "Source" }: { sources: readonly Source[]; prefix?: string | null }) {
  return (
    <span className="pb-src">
      {prefix && `${prefix}: `}
      {sources.map((s, i) => (
        <Fragment key={s.name}>
          {i > 0 && ", "}
          {s.href ? <a href={s.href} target="_blank" rel="noopener noreferrer">{s.name}</a> : s.name}
        </Fragment>
      ))}
    </span>
  );
}

/** The note's four headline numbers; each counts up as the strip arrives (the HTML holds the real value). */
export function ProblemStats() {
  const root = useRef<HTMLUListElement>(null);
  useCountUp(root);
  return (
    <ul ref={root} className="pb-stats">
      {PROBLEM_STATS.map((s, i) => (
        <li key={s.label} className="pb-stat" data-d-enter="" style={d(i * 90)}>
          <p className="pb-stat__value">
            <span className="sr-only">{formatStat(s, s.value)}</span>
            <span aria-hidden="true" data-pb-count={i}>{formatStat(s, s.value)}</span>
          </p>
          <p className="pb-stat__label">{s.label}</p>
          <p className="pb-stat__detail">{s.detail}</p>
          <p className="pb-stat__src"><SourceLine sources={s.sources} /></p>
        </li>
      ))}
    </ul>
  );
}

/** The ledger scored 6 · 4 · 4: one column per verdict, each incident with its date and damage. */
export function VerdictBoard({ level = 4 }: { level?: 3 | 4 }) {
  const counts = verdictCounts();
  const Head = level === 3 ? "h3" : "h4";
  return (
    <div className="pb-verdicts">
      {VERDICT_ORDER.map((v, col) => (
        <section key={v} className="pb-verdict" data-verdict={v} data-d-enter="" style={d(col * 110)} aria-labelledby={`pb-v-${v}`}>
          <Head id={`pb-v-${v}`} className="pb-verdict__head">
            <span className="pb-verdict__n">{counts[v]}</span>
            <span className="pb-verdict__label">{VERDICTS[v].label}</span>
          </Head>
          <p className="pb-verdict__meaning">{VERDICTS[v].meaning}</p>
          <ul className="pb-verdict__list">
            {INCIDENTS.filter((incident) => incident.verdict === v).map((incident) => (
              <li key={incident.who}>
                <span className="pb-verdict__who">{incident.who}</span>
                <span className="pb-verdict__meta">{incident.when} · {incident.damage}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Home: the problem in one screen and a half, then the founder's note at /why for every source. */
export function ProblemSection() {
  return (
    <section className="pb" aria-labelledby="pb-h" data-d-arch="">
      <div className="pb__in">
        <p className="d-label d-mono pb__label" data-d-enter="">({D_PROBLEM.label})</p>
        <h2 id="pb-h" className="pb__h" data-d-words="">{D_PROBLEM.title}</h2>
        <p className="pb__lead" data-d-enter="" style={d(120)}>{D_PROBLEM.lead}</p>
        <ProblemStats />
        <div className="pb__ledger">
          <h3 className="pb__h3" data-d-enter="">{D_PROBLEM.ledgerTitle}</h3>
          <p className="pb__ledger-lead" data-d-enter="" style={d(80)}>{D_PROBLEM.ledgerLead}</p>
          <VerdictBoard />
        </div>
        <div className="pb__more" data-d-enter="">
          <Link href="/why" className="pb__link">{D_PROBLEM.cta}<span aria-hidden="true">→</span></Link>
          <p className="pb__more-note">{D_PROBLEM.ctaNote}</p>
        </div>
      </div>
    </section>
  );
}
