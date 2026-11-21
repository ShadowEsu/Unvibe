"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PricingCopy } from "@/lib/pricingCopy";
import { D_BRIEF, D_CARDS, D_CLOSE, D_EXPLAIN, D_FAQ, D_GET_TABLE, D_HERO, D_PRIVACY, D_SPLIT, D_STATEMENT, D_STATS, D_STEPS } from "./content";
import { Faq, Os, T } from "./bits";
import { DownloadCta } from "./DownloadCta";
import { DiaMotion } from "./motion/DiaMotion";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** A real capture in the standard frame (Design §3: 1 px edge, radius 10, no tilt, glow or shadow). */
function Shot({ src, width, height, alt }: { src: string; width: number; height: number; alt: string }) {
  return (
    <div className="d-frame">
      {/* eslint-disable-next-line @next/next/no-img-element -- a real capture at its own size */}
      <img src={src} width={width} height={height} alt={alt} loading="lazy" decoding="async" />
    </div>
  );
}

/** The hero's capture: AVIF, then WebP, at the widths the layout needs; loaded first (it is the page's largest paint). */
function HeroShot() {
  const { base, widths, sizes, width, height, alt } = D_HERO.shot;
  const set = (ext: string) => widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
  return (
    <div className="d-frame">
      <picture>
        <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
        {/* eslint-disable-next-line @next/next/no-img-element -- a real capture, sized by the frame */}
        <img src={`${base}-1040.webp`} srcSet={set("webp")} sizes={sizes} width={width} height={height} alt={alt} decoding="async" fetchPriority="high" />
      </picture>
    </div>
  );
}

/** A Steps still (QA's real 0.1.54 screen) in the standard frame: AVIF, then WebP, at 1x and 2x of its CSS width. */
function StepShot({ i }: { i: 0 | 1 }) {
  const { base, widths, width, height, alt } = D_STEPS.shots[i];
  const set = (ext: string) => widths.map((w) => `${base}-${w}.${ext} ${w}w`).join(", ");
  const sizes = `${widths[0]}px`;
  return (
    <div className={`d-frame d-stepshot ${i === 0 ? "d-stepshot--wide" : "d-stepshot--tall"}`}>
      <picture>
        <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
        {/* eslint-disable-next-line @next/next/no-img-element -- a real capture, sized by the frame */}
        <img src={`${base}-${widths[1]}.webp`} srcSet={set("webp")} sizes={sizes} width={width} height={height} alt={alt} loading="lazy" decoding="async" />
      </picture>
    </div>
  );
}

/** The still step i shows (D_STEPS.stepShot: step 3 repeats still 2 until still 3 is re-shot). */
const stepShot = (i: number) => D_STEPS.stepShot[i] as 0 | 1;

/**
 * The hero (Design §3, frames a-5-hero-1440/390): centred H1 in two balanced lines, the audience line, one ink pill,
 * the try link and the platforms in one 13 px line, then a real Today capture with its caption above it. Nothing moves.
 */
function Hero() {
  return (
    <section className="d-hero" aria-labelledby="d-hero-h">
      <div className="d-hero__top">
        <h1 id="d-hero-h" className="d-hero__h1">{D_HERO.h1}</h1>
        <p className="d-hero__sub">{D_HERO.sub}</p>
        <DownloadCta surface="hero" className="d-cta d-hero__cta">{D_HERO.cta}</DownloadCta>
        <p className="d-hero__meta">
          <Link className="d-hero__try" href="/explain">{D_HERO.tryIt}</Link>
          <span aria-hidden="true"> · </span>
          <span>{D_HERO.available}</span>
        </p>
      </div>
      <figure className="d-hero__shot">
        <figcaption className="d-chipcap">{D_HERO.shotCaption}</figcaption>
        <HeroShot />
      </figure>
    </section>
  );
}

/** Label, h2, lead, one real screen, caption: the one section pattern (Design §4). The numbers sit in one row divided
 *  by 1 px rules, like Today's number row in the app; they render final (no count-up). */
function Numbers() {
  return (
    <section className="d-sec d-statsec" aria-labelledby="d-stats-h">
      <h2 id="d-stats-h" className="d-label d-left" data-d-enter="">({D_STATS.label})</h2>
      <div className="d-stats" data-d-enter="" style={d(80)}>
        {D_STATS.items.map((s, i) => (
          <div key={i} className="d-stat">
            <span className="d-stat__value">{s.value}</span>
            <span className="d-stat__label"><Os v={s.label} /></span>
            <span className="d-stat__fact">{s.fact}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Statement() {
  return (
    <section className="d-sec d-stmt" aria-labelledby="d-stmt-h">
      <p className="d-label d-left" data-d-enter="">{D_STATEMENT.label}</p>
      <h2 id="d-stmt-h" className="d-stmt__h" data-d-enter="" style={d(80)}>
        {D_STATEMENT.lines[0]}<br />{D_STATEMENT.lines[1]}<br />{D_STATEMENT.lines[2]}<br />{D_STATEMENT.last} {D_STATEMENT.em}
      </h2>
      <p className="d-stmt__entity" data-d-enter="" style={d(160)}>{D_STATEMENT.entity}</p>
    </section>
  );
}

/**
 * Steps: at ≥ 821 px the list and ONE stage are pinned together in a 300vh track; three invisible markers
 * ([data-d-shot]) are DiaMotion's triggers, so the step whose marker crosses the middle is active and the stage shows
 * that step's still (the stills stacked in one box, the others transparent), with the panel's own status chip above
 * it. At ≤ 820 px (and with reduced motion) each step is followed by its own still.
 */
function Steps() {
  const root = useRef<HTMLElement>(null);
  const [active, setActive] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    const steps = Array.from(el.querySelectorAll<HTMLElement>(".d-steps__list [data-d-step]"));
    const mo = new MutationObserver(() => {
      const on = steps.findIndex((s) => s.hasAttribute("data-on"));
      if (on >= 0) setActive(on as 0 | 1 | 2);
    });
    for (const s of steps) mo.observe(s, { attributes: true, attributeFilter: ["data-on"] });
    return () => mo.disconnect();
  }, []);
  return (
    <section ref={root} className="d-sec d-steps" aria-labelledby="d-steps-h" data-d-steps="">
      <p className="d-label d-left" data-d-enter="">{D_STEPS.label}</p>
      <h2 id="d-steps-h" className="d-h2 d-left" data-d-enter="" style={d(80)}><T t={D_STEPS.h2} /></h2>
      <div className="d-steps__track">
        {D_STEPS.items.map((item, i) => <div key={item.n} id={`d-shot-${i}`} className="d-steps__mark" data-d-shot={i} aria-hidden="true" />)}
        <div className="d-steps__pin">
          <ol className="d-steps__list">
            {D_STEPS.items.map((item, i) => (
              <li key={item.n}>
                <a href={`#d-shot-${i}`} className="d-step" data-d-step={i}>
                  <span className="d-step__n">{item.n}</span>
                  <span className="d-step__t"><Os v={item.title} /></span>
                  <span className="d-step__b" data-d-step-body=""><Os v={item.body} /></span>
                </a>
                <figure className="d-steps__mobile d-steps__card d-win">
                  <StepShot i={stepShot(i)} />
                  <figcaption className="d-chipcap d-win__cap">{D_STEPS.caption}</figcaption>
                </figure>
              </li>
            ))}
          </ol>
          <div className="d-steps__stage" data-d-stage={active}>
            {/* The panel's own status chip (plan §6, Giga): real panel UI, not a new string */}
            <p className="d-steps__status" aria-hidden="true"><span className="d-steps__dot" />{active === 1 ? "explaining" : "ready to learn"}</p>
            <figure className="d-steps__card d-win">
              <div className="d-steps__screens">
                {D_STEPS.shots.map((shot, j) => {
                  const on = stepShot(active) === j;
                  return (
                    <div key={shot.base} className="d-steps__screen" data-on={on ? "" : undefined} aria-hidden={on ? undefined : true}>
                      <StepShot i={j as 0 | 1} />
                    </div>
                  );
                })}
              </div>
              <figcaption className="d-chipcap d-win__cap">{D_STEPS.caption}</figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

function Brief() {
  return (
    <section className="d-sec d-side d-brief" aria-labelledby="d-brief-h">
      <div className="d-side__text">
        <p className="d-label d-left" data-d-enter="">{D_BRIEF.label} {D_BRIEF.kicker}</p>
        <h2 id="d-brief-h" className="d-h2 d-left" data-d-enter="" style={d(80)}><T t={D_BRIEF.h2} /></h2>
        <p className="d-brief__note" data-d-enter="" style={d(120)}>{D_BRIEF.note}</p>
      </div>
      <figure className="d-side__pic" data-d-enter="" style={d(160)}>
        <Shot {...D_BRIEF.shot} />
        <figcaption className="d-chipcap d-sec__cap">{D_BRIEF.caption}</figcaption>
      </figure>
    </section>
  );
}

/** The capture, cropped in CSS to `crop` (capture pixels of a 704 × 905 image) and scaled to the box's width. */
function Crop({ src, alt, crop }: { src: string; alt: string; crop: { x: number; y: number; w: number; h: number } }) {
  const style = { "--cx": crop.x, "--cy": crop.y, "--cw": crop.w, aspectRatio: `${crop.w} / ${crop.h}` } as CSSProperties;
  return (
    <div className="d-crop" style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a real capture, cropped to the part its card names */}
      <img src={src} width={704} height={905} alt={alt} loading="lazy" decoding="async" />
    </div>
  );
}

function Cards() {
  return (
    <section className="d-sec d-cards" aria-labelledby="d-cards-h">
      <p className="d-label d-left" data-d-enter="">{D_CARDS.label}</p>
      <h2 id="d-cards-h" className="d-h2 d-left" data-d-enter="" style={d(80)}><T t={D_CARDS.h2} /></h2>
      <div className="d-cards__grid">
        {D_CARDS.items.map((card, i) => (
          <article key={card.n} className="d-card" data-d-enter="" style={d(i * 50)}>
            <h3 className="d-card__k"><span className="d-card__n">{card.n}</span> {card.title}</h3>
            <p className="d-card__b"><Os v={card.body} /></p>
            <div className="d-card__shot">
              {"shot" in card ? <Crop {...card.shot} /> : (
                <div className="d-card__editors">
                  <ul className="d-chips">
                    {card.editors.map((e) => <li key={e.name} className={"macOnly" in e ? "d-chip lx-mac" : "d-chip"}>{e.name}</li>)}
                  </ul>
                  <p className="d-keys" aria-label="The shortcut">
                    <span className="lx-mac"><kbd>Control</kbd><kbd>U</kbd></span>
                    <span className="lx-win"><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>U</kbd></span>
                  </p>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="d-chipcap d-sec__cap">{D_CARDS.caption}</p>
    </section>
  );
}

/** Then prove it: the three rows, then the Library and Test me captures as two standard frames side by side. */
function Split() {
  return (
    <section className="d-sec d-split" aria-labelledby="d-split-h">
      <p className="d-label d-left" data-d-enter="">{D_SPLIT.label}</p>
      <h2 id="d-split-h" className="d-h2 d-left" data-d-enter="" style={d(80)}><T t={D_SPLIT.h2} /></h2>
      <dl className="d-split__rows">
        {D_SPLIT.rows.map((row, i) => (
          <div key={row.title} className="d-split__row" data-d-enter="" style={d(i * 50)}>
            <dt>{row.title}</dt>
            <dd><Os v={row.body} /></dd>
          </div>
        ))}
      </dl>
      <div className="d-split__pics">
        {[D_SPLIT.library, D_SPLIT.shot].map((shot, i) => (
          <figure key={shot.caption} data-d-enter="" style={d(120 + i * 80)}>
            <Shot src={shot.src} width={shot.width} height={shot.height} alt={shot.alt} />
            <figcaption className="d-chipcap d-sec__cap">{shot.caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Privacy() {
  return (
    <section className="d-sec d-side d-privacy" aria-labelledby="d-privacy-h">
      <div className="d-side__text">
        <p className="d-label d-left" data-d-enter="">{D_PRIVACY.label}</p>
        <h2 id="d-privacy-h" className="d-h2 d-left" data-d-enter="" style={d(80)}><T t={D_PRIVACY.h2} /></h2>
        {D_PRIVACY.lines.map((line, i) => <p key={line} className="d-privacy__p" data-d-enter="" style={d(80 + i * 50)}>{line}</p>)}
        <div className="d-privacy__kept" data-d-enter="" style={d(200)}>
          <h3>{D_PRIVACY.keptTitle}</h3>
          <ul>{D_PRIVACY.kept.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <Link className="d-pill-link" href={D_PRIVACY.more.href} data-d-enter="" style={d(260)}>{D_PRIVACY.more.label}</Link>
      </div>
      <figure className="d-side__pic d-privacy__shot" data-d-enter="" style={d(120)}>
        <Shot {...D_PRIVACY.shot} />
        <figcaption className="d-chipcap d-sec__cap">{D_PRIVACY.shot.caption}</figcaption>
      </figure>
    </section>
  );
}

/** What you get: the Free and Pro rows are the live pricing-card features, word for word. */
function WhatYouGet({ copy }: { copy: PricingCopy }) {
  const free = copy.plans.find((p) => p.id === "free");
  const pro = copy.plans.find((p) => p.id === "pro");
  if (!free || !pro) return null;
  const proOnly = pro.features.filter((f) => !/^Everything in Free/.test(f));
  const rows = [...free.features.map((f) => ({ f, free: true })), ...proOnly.map((f) => ({ f, free: false }))];
  return (
    <section className="d-sec d-side d-get" aria-labelledby="d-get-h">
      <div className="d-side__text">
        <p className="d-label d-left" data-d-enter="">{D_GET_TABLE.label}</p>
        <h2 id="d-get-h" className="d-h2 d-left" data-d-enter="" style={d(80)}><T t={D_GET_TABLE.h2} /></h2>
        <p className="d-get__lead" data-d-enter="" style={d(120)}>{D_GET_TABLE.lead}</p>
        <figure data-d-enter="" style={d(160)}>
          <Shot {...D_GET_TABLE.library} />
          <figcaption className="d-chipcap d-sec__cap">{D_GET_TABLE.library.caption}</figcaption>
        </figure>
      </div>
      <div className="d-get__r" data-d-enter="" style={d(120)}>
        <table className="d-table">
          <thead>
            <tr><th scope="col"><span className="sr-only">Feature</span></th><th scope="col">{free.name}</th><th scope="col">{pro.name}</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.f}>
                <th scope="row">{row.f}</th>
                <td>{row.free ? <Tick /> : <span className="sr-only">No</span>}</td>
                <td><Tick /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="d-get__fine">{free.detail}</p>
        <p className="d-get__fine">{copy.disclosure}</p>
        <Link className="d-pill-link" href={D_GET_TABLE.all.href}>{D_GET_TABLE.all.label}</Link>
      </div>
    </section>
  );
}

function Tick() {
  return (
    <svg className="d-tick" viewBox="0 0 16 16" width="16" height="16" role="img" aria-label="Yes">
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

function ShortAnswers({ faq }: { faq: ReadonlyArray<{ id: string; question: string; answer: string }> }) {
  return (
    <section className="d-sec d-faqsec" id="faq" aria-labelledby="d-faq-h">
      <div className="d-faqsec__l">
        <p className="d-label d-left" data-d-enter="">{D_FAQ.label}</p>
        <h2 id="d-faq-h" className="d-h2 d-left" data-d-enter="" style={d(80)}>{D_FAQ.h2}</h2>
        <Link className="d-link d-faqsec__more" href={D_FAQ.more.href} data-d-enter="" style={d(120)}>{D_FAQ.more.label}</Link>
      </div>
      <Faq items={faq.map((item) => ({ id: item.id, question: item.question, answer: <p>{item.answer}</p> }))} />
    </section>
  );
}

/** Links to 8 /explain pages; each label is that page's own H1 (explainHeadingText), built on the server in app/page.tsx. */
function ExplainLinks({ links }: { links: ReadonlyArray<{ href: string; label: string }> }) {
  return (
    <section className="d-sec d-explain" aria-labelledby="d-explain-h">
      <h2 id="d-explain-h" className="d-label d-left" data-d-enter="">{D_EXPLAIN.h2}</h2>
      <ul className="d-explain__list" data-d-enter="" style={d(80)}>
        {links.map((link) => (
          <li key={link.href}><Link className="d-link" href={link.href}>{link.label}</Link></li>
        ))}
        <li><Link className="d-link d-explain__all" href={D_EXPLAIN.all.href}>{D_EXPLAIN.all.label}</Link></li>
      </ul>
    </section>
  );
}

function Close() {
  return (
    <section className="d-sec d-close" aria-labelledby="d-close-h">
      {/* eslint-disable-next-line @next/next/no-img-element -- our own mark */}
      <img className="d-close__ghost" src="/brand/vibe.svg" width={72} height={72} alt="" data-d-enter="" />
      <h2 id="d-close-h" className="d-h2" data-d-enter="" style={d(80)}><T t={D_CLOSE.h2} /></h2>
      <div className="d-close__cta" data-d-enter="" style={d(160)}>
        <DownloadCta surface="hero" className="d-cta">{D_HERO.cta}</DownloadCta>
        <p className="d-avail">{D_HERO.available}</p>
      </div>
    </section>
  );
}

/**
 * The home in Option A (ledger 633/639; Design spec requests/unvibe-site/20261119-1611-design-633-a-site-spec.md):
 * every section and string of direction D, on a white page with black type and real screens in one plain frame.
 * DiaMotion runs the one-time section reveal and the Steps switch; the hero doesn't move.
 */
export function Home({ copy, faq, explain }: {
  copy: PricingCopy;
  faq: ReadonlyArray<{ id: string; question: string; answer: string }>;
  explain: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div className="d d-page d-home">
      <DiaMotion />
      <Hero />
      <Numbers />
      <Statement />
      <Steps />
      <Brief />
      <Cards />
      <Split />
      <Privacy />
      <WhatYouGet copy={copy} />
      <ShortAnswers faq={faq} />
      <ExplainLinks links={explain} />
      <Close />
    </div>
  );
}
