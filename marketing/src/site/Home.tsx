"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type UIEvent } from "react";
import { INSTALL_COPY } from "@/components/paper/InstallBox";
import { track } from "@/lib/analytics";
import { AI_MAINTENANCE } from "@/lib/aiMaintenance";
import { watchDownloadCtaView } from "@/lib/downloadTracking";
import { BRIEFS_CAPTION, BRIEFS_SHOT, CAPTION, GALLERY_H2, HERO, HERO_RECORDING, SHOTS } from "@/site/content";
import type { VisitorDevice } from "@/lib/shortcuts";
import { CountUp } from "@/site/moments/CountUp";
import { HeroStage } from "@/site/moments/HeroStage";
import { SelectExplain } from "@/site/moments/SelectExplain";
import {
  Cap, DownloadButtons, FaqBlock, FinePrint, GetUnvibe, HeroLede, HeroTitle, Img, InstallCmd, KeysBlock, OS_BOOT, OsClass,
  PhoneEmail, PricingBlock, SiteHeader, SiteMotion, TryBlock, WorksBlock, useVisitor,
} from "@/site/parts";

const BOOT = `document.documentElement.classList.add("site-load");${OS_BOOT}`;

const GAL = [
  { title: "Beginner", shot: SHOTS.beginner, crop: "depth" },
  { title: "Advanced", shot: SHOTS.advanced, crop: "depth" },
  { title: "Follow-up", shot: SHOTS.followUp, crop: "follow" },
  { title: "Test me", shot: SHOTS.testMe, crop: "test" },
] as const;

/**
 * A reading crop. On phones (Design r09/R10) it is a sideways swipe area at 0.75 (text ≥ 11 px) that starts at the
 * panel's own left edge inside 16 px of padding, with a right-edge fade and two dots that follow the scroll.
 */
function SwipeCrop({ crop, label, phone, children }: { crop: "depth" | "follow"; label: string; phone: boolean; children: ReactNode }) {
  const [end, setEnd] = useState(false);
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    setEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };
  return (
    <>
      <div className={`a-gal__crop a-gal__crop--${crop}`} data-end={end ? "" : undefined} onScroll={onScroll}
        {...(phone ? { role: "region", "aria-label": `${label}: scroll to read`, tabIndex: 0 } : {})}>
        {children}
      </div>
      {/* Design (Council R10): a quiet two-dot hint on phones, following the scroll */}
      {phone ? <p className="a-gal__dots" aria-hidden="true"><i data-on={end ? undefined : ""} /><i data-on={end ? "" : undefined} /></p> : null}
    </>
  );
}

/** React 18 drops a boolean `inert`; the empty string is the attribute (hidden tabs leave the Tab order). */
const INERT = { inert: "" } as unknown as { inert: boolean };

const TABS = [
  { id: "explain", label: "Explain" },
  { id: "follow-up", label: "Follow-up", shot: SHOTS.followUp, caption: CAPTION.v0149 },
  { id: "test-me", label: "Test me", shot: SHOTS.testMe, caption: CAPTION.v0149 },
  // Design r10 (Council R09, agent-builders): the first view names Briefs too; the gallery card stays.
  { id: "briefs", label: "Briefs", shot: BRIEFS_SHOT, caption: BRIEFS_CAPTION, phoneSrc: "/unvibe/real/0150/briefs-phone.webp" },
] as const;

/**
 * The product in the first view (package SPEC §5, ElevenLabs' tabbed demo): Explain plays the real 0.1.49 recording
 * on Motion's stage; Follow-up and Test me show their real 0.1.49 stills on the same lit ground. All three share one
 * grid cell, so the cell is always the tallest of them and a tab switch never moves the page.
 */
function DemoTabs({ device }: { device: VisitorDevice }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("explain");
  // WAI-ARIA tabs: one tab stop; arrows, Home and End move between tabs and select them.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length
      : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`at-tab-${TABS[next].id}`)?.focus();
  };
  return (
    <div className="at">
      <div className="at__bar" role="tablist" aria-label="See it work">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`at-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`at-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1} className="at__tab" onClick={() => setTab(t.id)} onKeyDown={onTabKey}>{t.label}</button>
        ))}
      </div>
      <div className="at__cells">
        {TABS.map((t) => (
          <div key={t.id} role="tabpanel" id={`at-panel-${t.id}`} aria-labelledby={`at-tab-${t.id}`} className="at__cell" data-on={tab === t.id ? "" : undefined} {...(tab === t.id ? {} : INERT)}>
            {"shot" in t ? (
              <figure className="at__still">
                <div className={`at__ground${"phoneSrc" in t ? " at__ground--briefs" : ""}`}>
                  {"phoneSrc" in t ? (
                    <picture>
                      <source media="(max-width: 600px)" srcSet={t.phoneSrc} width={380} height={444} />
                      <Img shot={t.shot} />
                    </picture>
                  ) : <Img shot={t.shot} />}
                </div>
                <figcaption><Cap>{t.caption}</Cap></figcaption>
              </figure>
            ) : <HeroStage device={device} caption={HERO_RECORDING.caption} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The home page (Design package-1106, round 10): the hero with the tabbed product stage, the pinned select → explain
 * tour, Try it, the gallery, Keys, Works with and Pricing, questions and Get Unvibe. Motion's moments carry it: the
 * hero stage with Vibe and the keys pressing in sync with the recording (HeroStage), the tour's scrub
 * (SelectExplain) and the count-up (CountUp).
 */
export function Home({ paymentsOpen }: { paymentsOpen: boolean }) {
  const visitor = useVisitor();
  const { device, known } = visitor;
  const ctas = useRef<HTMLDivElement>(null);
  // download_cta_viewed once the hero's download button is half in view (the live hero's measure), and only once the
  // visitor's computer is known, so the platform is the real one.
  useEffect(() => (known && device !== "phone" && ctas.current ? watchDownloadCtaView(ctas.current, "hero", device) : undefined), [known, device]);
  return (
    <div className="site n-home" id="top">
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <OsClass />
      <div className="lx-wrap"><SiteHeader /></div>
      {/* the page's own <main>: the root layout leaves it to these pages (components/ClassicChrome) */}
      <main id="main" tabIndex={-1}>
      {/* Hero: a split header (H1 on 2 lines, the lede bottom-aligned beside it), one action row with the Terminal
          line, the install truth, then Motion's stage. Phones: H1, lede, the stage, then the email form and trust. */}
      <section className="ah lx-wrap" aria-labelledby="hero-title">
        <div className="ah__title"><HeroTitle /></div>
        {/* Design round 05: the right column carries the lede, one violet button + a text link, then the OS's own
            install line (Terminal or PowerShell) with its truth line and a link to read the script. */}
        <div className="ah__side">
          <HeroLede />
          {/* Every variant is in the HTML and html.os-phone / os-win (OS_BOOT) shows one before the first paint, so the
              stage under this row never moves after hydration (it did on phones: CLS 0.066 at 4x CPU, slow 4G). */}
          <div className="ah__ctas" id="email-link" ref={ctas}>
            <PhoneEmail surface="phone_hero" />
            <DownloadButtons surface="hero" magnet />
            {AI_MAINTENANCE ? null : <a href="#try-it" className="ah__textlink lx-desk-only" onClick={() => track("hero_try_clicked", { device })}>{HERO.tryIt} <span aria-hidden="true">→</span></a>}
          </div>
          {/* Council R06 / CODE-SPEC §1b.4: on Windows the .exe button is the primary, with its file line (Security 0152). */}
          <p className="ah__file lx-win lx-desk-only">Free · .exe · Windows, 64-bit</p>
          {AI_MAINTENANCE ? null : <a href="#try-it" className="ah__textlink ah__textlink--phone lx-phone-only" onClick={() => track("hero_try_clicked", { device })}>{HERO.tryIt} <span aria-hidden="true">→</span></a>}
          <div className="ah__install lx-desk-only">
            {/* "On Windows?" / "On a Mac?" open /beta as that computer (a full load, so OS_BOOT runs with ?os=). */}
            <div className="lx-mac">
              <InstallCmd os="mac" surface="hero" />
              <p className="ah__truth">{HERO.installLine} <a className="lx-link" href="/install.sh">Read install.sh</a> · <a className="lx-link" href="/beta?os=win">On Windows?</a></p>
            </div>
            <div className="lx-win">
              <InstallCmd os="windows" surface="hero" />
              <p className="ah__truth">{INSTALL_COPY.windows.line} <a className="lx-link" href="/install.ps1">Read install.ps1</a> · <a className="lx-link" href="/beta?os=mac">On a Mac?</a></p>
            </div>
          </div>
        </div>
        <div className="ah__stage-wrap"><DemoTabs device={device} /></div>
        {/* SPEC §6 count-up (Security file 0118: "4 depths" while Pro is closed; "5" only in the release Pro opens): the one
            true number counts up as the stage lands; the two facts are words, so they only fade in. No latency number. */}
        <div className="ah__facts">
          <CountUp items={[{ value: 4, label: "depths" }, { value: 2, label: "platforms, Mac and Windows" }, { value: 1, label: "shortcut" }]} after="No API key" delayMs={900} />
        </div>
      </section>

      <div className="lx-wrap">
        <div className="lx-sec" id="product"><SelectExplain device={device} /></div>
        <section className="lx-sec a-band" id="try-it" aria-labelledby="try-it-title"><TryBlock /></section>
        {/* Design round 06: four tight 1:1-ish crops of the real 0.1.49 panel (whole lines, text ≥ 13 px), titles on top. */}
        <section className="lx-sec" id="see-it" aria-labelledby="see-it-title">
          <div className="lx-head" data-reveal><h2 id="see-it-title" data-rise="mask">{GALLERY_H2}</h2></div>
          {/* CODE-SPEC §1b.1 (Council R06): Briefs first, full width, a readable change summary from a real 0.1.50 screen. */}
          <figure className="a-gal__card a-gal__card--briefs" data-reveal>
            <figcaption><h3>Briefs</h3></figcaption>
            <div className="a-gal__crop a-gal__crop--briefs">
              {/* Phones (Design r08): the brief's two columns stacked (header, Review first, What matters), at reading size. */}
              <picture>
                <source media="(max-width: 600px)" srcSet="/unvibe/real/0150/briefs-phone.webp" width={380} height={444} />
                <Img shot={BRIEFS_SHOT} />
              </picture>
            </div>
            <p className="a-gal__label"><Cap>{BRIEFS_CAPTION}</Cap></p>
          </figure>
          <div className="a-gal" data-reveal>
            {GAL.map((card) => (
              <figure key={card.title} className="a-gal__card" data-scroll>
                <figcaption><h3>{card.title}</h3></figcaption>
                {card.crop === "test" ? <div className="a-gal__crop a-gal__crop--test"><Img shot={card.shot} /></div> : <SwipeCrop crop={card.crop} label={card.title} phone={device === "phone"}><Img shot={card.shot} /></SwipeCrop>}
              </figure>
            ))}
          </div>
          <p className="a-gal__also">Also in the app: Library, Quiz and Momentum.</p>
          <p className="lx-center"><Cap>{CAPTION.v0149}</Cap></p>
        </section>
      </div>

      <section className="lx-band ab-keys" data-tone style={{ "--tone-from": "#ffffff", "--tone-to": "#1a1a1a" } as CSSProperties} aria-labelledby="keys-title">
        <div className="lx-wrap"><KeysBlock dark privacy /></div>
      </section>

      <div className="lx-wrap">
        {/* Design round 05: Works with and Pricing as two hairline cards side by side. */}
        <div className="lx-sec">
          <div className="a-split">
            <section className="a-card" aria-labelledby="works-title"><WorksBlock /></section>
            <section className="a-card" aria-labelledby="pricing-title"><PricingBlock paymentsOpen={paymentsOpen} /></section>
          </div>
        </div>
        <section className="lx-sec a-band a-faq" id="faq" aria-labelledby="faq-title"><FaqBlock /></section>
        <section className="lx-sec" id="install" aria-labelledby="install-title"><GetUnvibe visitor={visitor} /></section>
      </div>
      </main>
      <div className="lx-wrap"><FinePrint /></div>
      <SiteMotion />
    </div>
  );
}
