"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { PricingCopy } from "@/lib/pricingCopy";
import { D_BRIEF, D_CARDS, D_CLOSE, D_FAQ, D_GET_TABLE, D_HERO, D_PRIVACY, D_SPLIT, D_STATEMENT, D_STATS, D_STEPS } from "./content";
import { BtnDot, Letters, Statement, Stats, VioletSplit } from "./effects";
import { Faq, Os, PixelVibe, PixelWipe, Pixels, Ribbon, T } from "./bits";
import { DownloadCta } from "./DownloadCta";
import { DiaMotion } from "./motion/DiaMotion";
import { UnvibeDemo } from "./UnvibeDemo";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

// A function, not a module-level array: no JSX runs at import time (the tests import pages before React is global).
const statIcon = (i: number) => [
  <svg key="depth" viewBox="0 0 24 24"><path d="M4 7l8-4 8 4-8 4-8-4zm0 5l8 4 8-4M4 17l8 4 8-4" /></svg>,
  <svg key="screen" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" /></svg>,
  <svg key="key" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M9 9v4.5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9" /></svg>,
  <svg key="nokey" viewBox="0 0 24 24"><circle cx="8" cy="12" r="3.5" /><path d="M11.5 12H20M17 12v3M4 20L20 4" /></svg>,
][i];

/** The live demo in its light frosted window (mock 01), with Security's caption under it. */
function DemoWindow({ step, rise }: { step?: 0 | 1 | 2; rise?: boolean }) {
  return (
    <figure className="d-win" {...(rise ? { "data-d-hero-rise": "window" } : {})}>
      <div className="d-win__frame">
        <UnvibeDemo step={step} />
      </div>
      <figcaption className="d-mono d-win__cap">{D_HERO.caption}</figcaption>
    </figure>
  );
}

/** The H1 is plain text, visible in the first frame; it only rises (ANIMATIONS #12). */
function Hero() {
  return (
    <section className="d-hero" aria-labelledby="d-hero-h">
      <div className="d-hero__bg" data-d-hero-bg="" aria-hidden="true" />
      <div className="d-hero__top" data-d-hero-rise="h1">
        <h1 id="d-hero-h" className="d-hero__h1 d-serif">{D_HERO.h1}</h1>
        <TryWeb />
      </div>
      <p className="d-hero__mark" aria-hidden="true" data-d-hero-rise="wordmark">{D_HERO.wordmark}</p>
      <DemoWindow rise />
    </section>
  );
}

/** "Or try it in your browser first →" (Design 2032 + 2050 pick d, Security 2033: plain /explain): one quiet text link
 *  10 px under the hero tagline at every width, above the wordmark, so no phone's dock ever covers it. */
function TryWeb() {
  return (
    <p className="d-try">
      <Link href="/explain">
        {D_HERO.tryIt}{" "}
        <span className="d-try__arrow" aria-hidden="true">→</span>
      </Link>
    </p>
  );
}

function Numbers() {
  return (
    <section className="d-statsec" aria-labelledby="d-stats-h" data-d-arch="">
      <h2 id="d-stats-h" className="d-label d-mono" data-d-enter="">({D_STATS.label})</h2>
      <Stats items={D_STATS.items.map((s, i) => ({ value: s.value, label: <Os v={s.label} />, fact: s.fact, icon: statIcon(i), pixels: <Pixels /> }))} />
    </section>
  );
}

/**
 * Steps (mock 04): at ≥ 821 px the list and ONE demo window are pinned together in a 300vh track; three invisible
 * markers ([data-d-shot]) are DiaMotion's triggers, so the step whose marker crosses the middle is active and the
 * window jumps to that step's part of the loop, with the panel's own status chip above it (ANIMATIONS #22-23).
 * At ≤ 820 px each step is followed by its own window.
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
    <section ref={root} className="d-steps" aria-labelledby="d-steps-h" data-d-steps="" data-d-arch="">
      <p className="d-label d-mono" data-d-enter="">{D_STEPS.label}</p>
      <h2 id="d-steps-h" className="d-h2 d-serif" data-d-words=""><T t={D_STEPS.h2} /></h2>
      <div className="d-steps__track">
        {D_STEPS.items.map((item, i) => <div key={item.n} id={`d-shot-${i}`} className="d-steps__mark" data-d-shot={i} aria-hidden="true" />)}
        <div className="d-steps__pin">
          <ol className="d-steps__list">
            {D_STEPS.items.map((item, i) => (
              <li key={item.n}>
                <a href={`#d-shot-${i}`} className="d-step" data-d-step={i}>
                  <span className="d-step__n d-mono">{item.n}</span>
                  <span className="d-step__t d-serif"><Os v={item.title} /></span>
                  <span className="d-step__b" data-d-step-body=""><Os v={item.body} /></span>
                </a>
                <div className="d-steps__mobile d-steps__card"><DemoWindow step={i as 0 | 1 | 2} /></div>
              </li>
            ))}
          </ol>
          <div className="d-steps__stage" data-d-stage={active}>
            {/* The panel's own status chip (plan §6, Giga): real panel UI, not a new string */}
            <p className="d-steps__status" aria-hidden="true"><span className="d-steps__dot" />{active === 1 ? "explaining" : "ready to learn"}</p>
            <div className="d-steps__card"><DemoWindow step={active} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Brief() {
  return (
    <section className="d-brief" aria-labelledby="d-brief-h">
      <div className="d-brief__art" aria-hidden="true">
        <picture>
          <source type="image/avif" srcSet="/d/art/wisteria-1200.avif 1200w, /d/art/wisteria-2400.avif 2400w" sizes="100vw" />
          {/* eslint-disable-next-line @next/next/no-img-element -- painting backdrop */}
          <img src="/d/art/wisteria-1200.webp" srcSet="/d/art/wisteria-1200.webp 1200w, /d/art/wisteria-2400.webp 2400w" sizes="100vw" alt="" width={1200} height={800} loading="lazy" decoding="async" data-d-zoom-slow="" />
        </picture>
      </div>
      <div className="d-brief__in">
        <p className="d-label d-mono d-brief__kick" data-d-enter="">{D_BRIEF.label} {D_BRIEF.kicker}</p>
        <h2 id="d-brief-h" className="d-h2 d-serif d-brief__h" data-d-words=""><T t={D_BRIEF.h2} /></h2>
        <figure className="d-brief__card" data-d-enter="" style={d(160)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a real capture at its own size */}
          <img src={D_BRIEF.shot.src} width={D_BRIEF.shot.width} height={D_BRIEF.shot.height} alt={D_BRIEF.shot.alt} loading="lazy" decoding="async" />
          <figcaption className="d-mono">{D_BRIEF.caption}</figcaption>
        </figure>
        <p className="d-brief__note d-serif" data-d-enter="" style={d(240)}><em>{D_BRIEF.note}</em></p>
      </div>
      <p className="d-credit d-mono">{D_BRIEF.credit}</p>
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
    <section className="d-cards" aria-labelledby="d-cards-h" data-d-arch="">
      <p className="d-label d-mono" data-d-enter="">{D_CARDS.label}</p>
      <div className="d-cards__head">
        <h2 id="d-cards-h" className="d-h2 d-serif" data-d-words=""><T t={D_CARDS.h2} /></h2>
        <PixelVibe className="d-cards__vibe" />
      </div>
      <div className="d-cards__grid">
        {D_CARDS.items.map((card, i) => (
          <article key={card.n} className="d-card" data-d-enter="" style={d(i * 50)}>
            <span className="d-card__x" aria-hidden="true" />
            <h3 className="d-card__k d-mono">{card.n} {card.title}</h3>
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
      <p className="d-cap">{D_CARDS.caption}</p>
    </section>
  );
}

function Split() {
  return (
    <div className="d-splitwrap">
      <PixelWipe />
      <VioletSplit
        labelledBy="d-split-h"
        left={
          <>
            <p className="d-label d-mono d-split__label">{D_SPLIT.label}</p>
            <h2 id="d-split-h" className="d-split__h d-serif">
              <Letters parts={[{ text: D_SPLIT.h2.before }, { text: D_SPLIT.h2.em, em: true, br: true }, { text: D_SPLIT.h2.after ?? "" }]} />
            </h2>
            <dl className="d-split__rows">
              {D_SPLIT.rows.map((row, i) => (
                <div key={row.title} className="d-split__row" data-d-enter="" style={d(i * 50)}>
                  <dt>{row.title}</dt>
                  <dd><Os v={row.body} /></dd>
                </div>
              ))}
            </dl>
            <figure className="d-split__lib" data-d-enter="" style={d(150)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a real capture at its own size */}
              <img src={D_SPLIT.library.src} width={D_SPLIT.library.width} height={D_SPLIT.library.height} alt={D_SPLIT.library.alt} loading="lazy" decoding="async" />
              <figcaption className="d-mono">{D_SPLIT.library.caption}</figcaption>
            </figure>
          </>
        }
        media={
          <div className="d-split__media">
            <div className="d-split__zoom" data-d-zoom="">
              <picture>
                <source type="image/avif" srcSet="/d/art/lilacs-1200.avif" />
                {/* eslint-disable-next-line @next/next/no-img-element -- painting backdrop */}
                <img className="d-split__paint" src="/d/art/lilacs-1200.webp" alt="" width={1200} height={924} loading="lazy" decoding="async" />
              </picture>
            </div>
            <figure className="d-split__shot">
              {/* eslint-disable-next-line @next/next/no-img-element -- a real capture at its own size */}
              <img src={D_SPLIT.shot.src} width={D_SPLIT.shot.width} height={D_SPLIT.shot.height} alt={D_SPLIT.shot.alt} loading="lazy" decoding="async" />
              <figcaption className="d-mono">{D_SPLIT.shot.caption}</figcaption>
            </figure>
            <p className="d-credit d-mono">{D_SPLIT.credit}</p>
          </div>
        }
      />
    </div>
  );
}

function Privacy() {
  return (
    <section className="d-privacy" aria-labelledby="d-privacy-h">
      <div className="d-privacy__l">
        <p className="d-label d-mono d-left" data-d-enter="">{D_PRIVACY.label}</p>
        <h2 id="d-privacy-h" className="d-h2 d-serif d-left" data-d-words=""><T t={D_PRIVACY.h2} /></h2>
        {D_PRIVACY.lines.map((line, i) => <p key={line} className="d-privacy__p" data-d-enter="" style={d(80 + i * 50)}>{line}</p>)}
        <div className="d-privacy__kept" data-d-enter="" style={d(200)}>
          <h3 className="d-mono">{D_PRIVACY.keptTitle}</h3>
          <ul>{D_PRIVACY.kept.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <Link className="d-pill-link d-btn" href={D_PRIVACY.more.href} data-d-enter="" style={d(260)}>{D_PRIVACY.more.label}<BtnDot /></Link>
      </div>
      <figure className="d-tile d-privacy__shot" data-d-enter="" style={d(120)}>
        <div className="d-tile__img">
          {/* eslint-disable-next-line @next/next/no-img-element -- a real capture at its own size */}
          <img src={D_PRIVACY.shot.src} width={D_PRIVACY.shot.width} height={D_PRIVACY.shot.height} alt={D_PRIVACY.shot.alt} loading="lazy" decoding="async" />
        </div>
        <figcaption className="d-mono">{D_PRIVACY.shot.caption}</figcaption>
        <Pixels />
      </figure>
    </section>
  );
}

/** What you get (mock 16): the Free and Pro rows are the live pricing-card features, word for word. */
function WhatYouGet({ copy }: { copy: PricingCopy }) {
  const free = copy.plans.find((p) => p.id === "free");
  const pro = copy.plans.find((p) => p.id === "pro");
  if (!free || !pro) return null;
  const proOnly = pro.features.filter((f) => !/^Everything in Free/.test(f));
  const rows = [...free.features.map((f) => ({ f, free: true })), ...proOnly.map((f) => ({ f, free: false }))];
  return (
    <section className="d-get" aria-labelledby="d-get-h">
      <div className="d-get__l">
        <p className="d-label d-mono d-left" data-d-enter="">{D_GET_TABLE.label}</p>
        <h2 id="d-get-h" className="d-h2 d-serif d-left" data-d-words=""><T t={D_GET_TABLE.h2} /></h2>
        <p className="d-get__lead" data-d-enter="" style={d(80)}>{D_GET_TABLE.lead}</p>
        <figure className="d-tile" data-d-enter="" style={d(160)}>
          <div className="d-tile__img">
            {/* eslint-disable-next-line @next/next/no-img-element -- a real capture at its own size */}
            <img src={D_GET_TABLE.library.src} width={D_GET_TABLE.library.width} height={D_GET_TABLE.library.height} alt={D_GET_TABLE.library.alt} loading="lazy" decoding="async" />
          </div>
          <figcaption className="d-mono">{D_GET_TABLE.library.caption}</figcaption>
        </figure>
      </div>
      <div className="d-get__r" data-d-enter="" style={d(120)}>
        <table className="d-table" data-d-ticks="">
          <thead>
            <tr><th scope="col"><span className="sr-only">Feature</span></th><th scope="col">{free.name}</th><th scope="col" className="d-table__pro">{pro.name}</th></tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.f} style={{ "--i": i } as CSSProperties}>
                <th scope="row">{row.f}</th>
                <td>{row.free ? <Tick /> : <span className="sr-only">No</span>}</td>
                <td className="d-table__pro"><Tick /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="d-get__fine">{free.detail}</p>
        <p className="d-get__fine">{copy.disclosure}</p>
        <Link className="d-pill-link d-btn" href={D_GET_TABLE.all.href}>{D_GET_TABLE.all.label}<BtnDot /></Link>
      </div>
    </section>
  );
}

function Tick() {
  return (
    <svg className="d-tick" viewBox="0 0 16 16" width="16" height="16" role="img" aria-label="Yes">
      <path d="M3 8.5l3.2 3L13 4.5" pathLength={1} />
    </svg>
  );
}

function ShortAnswers({ faq }: { faq: ReadonlyArray<{ id: string; question: string; answer: string }> }) {
  return (
    <section className="d-faqsec" id="faq" aria-labelledby="d-faq-h">
      <div className="d-faqsec__l">
        <p className="d-label d-mono d-left" data-d-enter="">{D_FAQ.label}</p>
        <h2 id="d-faq-h" className="d-h2 d-serif d-left" data-d-words="">{D_FAQ.h2}</h2>
        <Link className="d-faqsec__more" href={D_FAQ.more.href} data-d-enter="" style={d(80)}>{D_FAQ.more.label} <span aria-hidden="true">→</span></Link>
        <div className="d-faqsec__tile" aria-hidden="true" data-d-enter="" style={d(160)}>
          <PixelVibe size={6} />
          <Pixels size={8} />
        </div>
      </div>
      <Faq items={faq.map((item) => ({ id: item.id, question: item.question, answer: <p>{item.answer}</p> }))} />
    </section>
  );
}

function Close() {
  return (
    <>
      <div className="d-closebg" aria-hidden="true" />
      <section className="d-close" aria-labelledby="d-close-h" data-d-arch="">
        {/* eslint-disable-next-line @next/next/no-img-element -- our own mark */}
        <img className="d-close__ghost" src="/brand/vibe.svg" width={72} height={72} alt="" data-d-enter="" />
        <h2 id="d-close-h" className="d-h2 d-serif" data-d-words=""><T t={D_CLOSE.h2} /></h2>
      </section>
    </>
  );
}

/** Motion's dock: the LAST child of [data-d-dock-scope]; sticky, resting under the close section (ANIMATIONS #17). */
function Dock() {
  return (
    <div data-d-cta-dock="" className="d-dock">
      <div data-d-dock-arc="" aria-hidden="true" />
      <div data-d-dock-pill="" data-d-hero-rise="dock">
        <DownloadCta surface="hero" className="d-cta d-btn d-btn--lg">{D_HERO.cta}</DownloadCta>
        <p className="d-avail">{D_HERO.available}</p>
      </div>
    </div>
  );
}

/**
 * Direction D's home (PLAN rev 3, mocks 01-20): Dia's sections in Dia's order, in Unvibe purple. One DiaMotion per
 * page drives the scroll-linked parts; the rest is CSS (dia-motion.css). The H1, wordmark and demo window are painted
 * from the first frame and only rise.
 */
export function Home({ copy, faq }: { copy: PricingCopy; faq: ReadonlyArray<{ id: string; question: string; answer: string }> }) {
  return (
    <div className="d d-page d-home">
      <DiaMotion />
      <div data-d-dock-scope="">
        <Hero />
        <Ribbon />
        <Numbers />
        <Statement labelledBy="d-stmt-h">
          <p className="d-stmt__entity">{D_STATEMENT.entity}</p>
          <p className="d-label d-mono">{D_STATEMENT.label}</p>
          <h2 id="d-stmt-h" className="d-stmt__h d-serif">
            <Letters parts={[
              { text: D_STATEMENT.lines[0] },
              { text: D_STATEMENT.lines[1], br: true },
              { text: D_STATEMENT.lines[2], br: true },
              { text: D_STATEMENT.last, br: true },
              { text: " " + D_STATEMENT.em, em: true },
            ]} />
          </h2>
        </Statement>
        <Steps />
        <Ribbon flip />
        <Brief />
        <Cards />
        <Split />
        <Privacy />
        <Ribbon />
        <WhatYouGet copy={copy} />
        <ShortAnswers faq={faq} />
        <Close />
        <Dock />
      </div>
    </div>
  );
}
