"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { D_BRIEF, D_CARDS, D_CLOSE, D_HERO, D_PRIVACY, D_SPLIT, D_STATEMENT, D_STATS, D_STEPS } from "./content";
import { DiaDock, DiaFoot, DiaNav, DiaRoot, T } from "./DiaChrome";
import { BtnDot, DarkSplit, Letters, Statement, Stats } from "./effects";
import { UnvibeDemo } from "./UnvibeDemo";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** A string, or a Mac/Windows pair (both in the HTML; the pre-paint OS class shows one). */
function Os({ v }: { v: string | { mac: string; windows: string } }) {
  return typeof v === "string" ? <>{v}</> : <><span className="lx-mac">{v.mac}</span><span className="lx-win">{v.windows}</span></>;
}

const STAT_ICONS = [
  <svg key="depth" viewBox="0 0 24 24"><path d="M4 7l8-4 8 4-8 4-8-4zm0 5l8 4 8-4M4 17l8 4 8-4" /></svg>,
  <svg key="screen" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" /></svg>,
  <svg key="key" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M9 9v4.5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9" /></svg>,
  <svg key="nokey" viewBox="0 0 24 24"><circle cx="8" cy="12" r="3.5" /><path d="M11.5 12H20M17 12v3M4 20L20 4" /></svg>,
];

/** The demo in Dia's framed window, with Security's caption under it. */
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

/** The H1 is plain text, visible in the first frame (Design gate 1, MUST 1); it only rises (Motion's hero rise). */
function Hero() {
  return (
    <section className="d-hero" aria-labelledby="d-hero-h">
      <div className="d-hero__bg" data-d-hero-bg="" aria-hidden="true" />
      <h1 id="d-hero-h" className="d-hero__h1 d-serif" data-d-hero-rise="h1">{D_HERO.h1}</h1>
      <p className="d-hero__mark d-serif" aria-hidden="true" data-d-hero-rise="wordmark">{D_HERO.wordmark}</p>
      <DemoWindow rise />
    </section>
  );
}

const stepTitle = (t: string | { mac: string; windows: string }) => (typeof t === "string" ? t : <><span className="lx-mac">{t.mac}</span><span className="lx-win">{t.windows}</span></>);

/**
 * Steps (Design gate 1, MUST 3; plan mock 04): at ≥ 821 px the list and ONE demo window are pinned together inside a
 * 300vh track; three invisible markers ([data-d-shot], one viewport tall each) are Motion's scroll triggers, so the
 * step whose marker crosses the viewport's middle is active (DiaMotion sets data-on) and the window jumps to that
 * step's segment of the loop. The window is never blank. At ≤ 820 px each step is followed by its own window.
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
      <h2 id="d-steps-h" className="d-h2 d-serif" data-d-enter="" data-d-words="" style={d(80)}><T t={D_STEPS.h2} /></h2>
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
            {/* The panel's own status chip (Awwwards/Giga, plan §6): real panel UI, not a new string */}
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
    <section className="d-brief" aria-labelledby="d-brief-h" data-d-arch="">
      <div className="d-brief__art" aria-hidden="true">
        <picture>
          <source type="image/avif" srcSet="/d/art/wisteria-1200.avif 1200w, /d/art/wisteria-2400.avif 2400w" sizes="100vw" />
          {/* eslint-disable-next-line @next/next/no-img-element -- painting backdrop */}
          <img src="/d/art/wisteria-1200.webp" alt="" width={1200} height={800} loading="lazy" decoding="async" data-d-zoom-slow="" />
        </picture>
      </div>
      <div className="d-brief__in">
        <p className="d-label d-mono d-brief__kick" data-d-enter="">{D_BRIEF.label} {D_BRIEF.kicker}</p>
        <h2 id="d-brief-h" className="d-h2 d-serif d-brief__h" data-d-enter="" data-d-words="" style={d(80)}><T t={D_BRIEF.h2} /></h2>
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
      <h2 id="d-cards-h" className="d-h2 d-serif" data-d-enter="" data-d-words="" style={d(80)}><T t={D_CARDS.h2} /></h2>
      <div className="d-cards__grid">
        {D_CARDS.items.map((card, i) => (
          <article key={card.n} className="d-card" data-d-enter="" style={d(i * 50)}>
            <span className="d-card__x" aria-hidden="true" />
            <p className="d-card__k d-mono">{card.n} {card.title}</p>
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
    <DarkSplit
      labelledBy="d-split-h"
      heading={<Letters parts={[{ text: D_SPLIT.h2.before + " " }, { text: D_SPLIT.h2.em, em: true }, { text: D_SPLIT.h2.after ?? "" }]} />}
      row={<><h3 className="d-split__t">{D_SPLIT.title}</h3><p>{D_SPLIT.body}</p><p className="d-mono d-split__cap">{D_SPLIT.caption}</p></>}
      media={
        <div className="d-split__media">
          <div className="d-split__zoom" data-d-zoom="">
            <picture>
              <source type="image/avif" srcSet="/d/art/lilacs-1200.avif" />
              {/* eslint-disable-next-line @next/next/no-img-element -- painting backdrop */}
              <img className="d-split__paint" src="/d/art/lilacs-1200.webp" alt="" width={1200} height={924} loading="lazy" decoding="async" />
            </picture>
            {/* eslint-disable-next-line @next/next/no-img-element -- a real capture at its own size */}
            <img className="d-split__shot" src={D_SPLIT.shot.src} width={D_SPLIT.shot.width} height={D_SPLIT.shot.height} alt={D_SPLIT.shot.alt} loading="lazy" decoding="async" />
          </div>
          <p className="d-credit d-mono">{D_SPLIT.credit}</p>
        </div>
      }
    />
  );
}

function Privacy() {
  return (
    <section className="d-privacy" aria-labelledby="d-privacy-h" data-d-arch="">
      <p className="d-label d-mono" data-d-enter="">{D_PRIVACY.label}</p>
      <h2 id="d-privacy-h" className="d-h2 d-serif" data-d-enter="" data-d-words="" style={d(80)}><T t={D_PRIVACY.h2} /></h2>
      {D_PRIVACY.lines.map((line, i) => <p key={line} className="d-privacy__p" data-d-enter="" style={d(160 + i * 80)}>{line}</p>)}
      <Link className="d-pill-link d-btn" href={D_PRIVACY.more.href} data-d-enter="" style={d(320)}>{D_PRIVACY.more.label}<BtnDot /></Link>
    </section>
  );
}

function Close() {
  return (
    <section className="d-close" aria-labelledby="d-close-h" data-d-arch="">
      {/* eslint-disable-next-line @next/next/no-img-element -- our own mark */}
      <img className="d-close__ghost" src="/brand/vibe.svg" width={72} height={72} alt="" data-d-enter="" />
      <h2 id="d-close-h" className="d-h2 d-serif" data-d-enter="" data-d-words="" style={d(80)}><T t={D_CLOSE.h2} /></h2>
    </section>
  );
}

export function DiaHome() {
  return (
    <DiaRoot className="d-home">
      <DiaNav active="Product" />
      <main id="main" tabIndex={-1}>
        <div data-d-dock-scope="">
          <Hero />
          <section className="d-statsec" aria-label="Unvibe in numbers" data-d-arch="">
            <Stats items={D_STATS.map((s, i) => ({ value: s.value, label: <Os v={s.label} />, icon: STAT_ICONS[i] }))} />
          </section>
          <Statement labelledBy="d-stmt-h">
            <p className="d-label d-mono">{D_STATEMENT.label}</p>
            <h2 id="d-stmt-h" className="d-stmt__h d-serif">
              <Letters parts={[
                { text: D_STATEMENT.lines[0] },
                { text: D_STATEMENT.lines[1], br: true },
                { text: D_STATEMENT.lines[2], br: true },
                { text: "at", br: true },
                { text: " " + D_STATEMENT.em, em: true },
              ]} />
            </h2>
          </Statement>
          <Steps />
          <Brief />
          <Cards />
          <Split />
          <Privacy />
          <Close />
          <DiaDock />
        </div>
      </main>
      <DiaFoot />
    </DiaRoot>
  );
}
