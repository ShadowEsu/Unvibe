"use client";

/**
 * The redesigned site's sections (Design package-1106, round 10): home, /pricing and /beta are built from these over
 * site/content.ts, styled by site.css (structure) and home.css (the package look) under the page root `.site`.
 * Motion is Motion's kit (motion/sections, data attributes), started once per page by <SiteMotion />; the three
 * motion moments live in site/moments.
 */
import Link from "next/link";
import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ExpandRows } from "@/components/paper/ExpandRows";
import { EmailMeLink } from "@/components/paper/EmailMeLink";
import { INSTALL_COPY, InstallBox } from "@/components/paper/InstallBox";
import { recordBetaSiteEvent, track } from "@/lib/analytics";
import { AI_MAINTENANCE, AI_MAINTENANCE_NOTE } from "@/lib/aiMaintenance";
import { FREE_MONTHLY_ALLOWANCE, TRIAL_ALLOWANCE } from "@/lib/allowance";
import { proSentence } from "@/lib/proOffer";
import { openAnalyticsSettings } from "@/lib/analyticsConsent";
import { trackDownloadClick, trackDownloadPageClick, type DownloadSurface } from "@/lib/downloadTracking";
import { TryIt } from "@/components/paper/TryIt";
import { Vibe } from "@/components/paper/Vibe";
import { initSections } from "@/motion/sections.js";
import { SHORTCUTS, detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";
import {
  CAPTION, FAQ, HERO, KEYS, KEY_CHECK_SHOT, NAV, PRICING, PRIVACY_CAPTION, PRIVACY_LINE, PRIVACY_SHOT,
  TRY, WORKS, type Shot,
} from "@/site/content";

export const d = (ms: number) => ({ "--d": ms }) as CSSProperties;

/**
 * html.os-win on Windows and html.os-phone on a phone or tablet (lib/shortcuts detectVisitorDevice's rules; ?os=win or
 * ?os=mac previews that computer, as Design's renders do). The server's HTML carries every variant and CSS shows one
 * (`lx-win`/`lx-mac`, `lx-phone-only`/`lx-desk-only`), so nothing swaps after hydration. Self-contained: OS_BOOT
 * inlines its source.
 */
function applyOsClasses() {
  const forced = new URLSearchParams(window.location.search).get("os");
  const ua = navigator.userAgent;
  const phone = forced !== "win" && forced !== "mac" && (/iPhone|iPad|iPod|Android|Mobile/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1));
  const win = !phone && (forced === "win" || (forced !== "mac" && /Windows/i.test(ua)));
  document.documentElement.classList.toggle("os-win", win);
  document.documentElement.classList.toggle("os-phone", phone);
}

/** Runs inline before the first paint of a page loaded from the server. */
export const OS_BOOT = `(${applyOsClasses.toString()})()`;

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Client navigation runs no inline script, so a page reached by a link sets the same classes before it paints. */
export function OsClass() {
  useBeforePaint(applyOsClasses, []);
  return null;
}

export interface Visitor {
  device: VisitorDevice;
  /** False until the browser has been asked (the server and the first render assume a Mac). */
  known: boolean;
  /** An Intel Mac on Chromium (Safari can't tell), which gets the Intel .dmg as its file link. */
  intelMac: boolean;
}

export function useVisitor(): Visitor {
  const [visitor, setVisitor] = useState<Visitor>({ device: "mac", known: false, intelMac: false });
  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).get("os");
    const device = forced === "win" ? "windows" : forced === "mac" ? "mac" : detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints);
    setVisitor({ device, known: true, intelMac: false });
    if (device !== "mac" || forced) return;
    let live = true;
    const uaData = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string; platform?: string }> } }).userAgentData;
    void uaData?.getHighEntropyValues?.(["architecture", "platform"]).then((values) => {
      if (live && values.platform === "macOS" && values.architecture === "x86") setVisitor((current) => ({ ...current, intelMac: true }));
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return visitor;
}

/** Starts Motion's section kit once, and flips each tone band's text colour at the middle of its change. */
export function SiteMotion() {
  useEffect(() => {
    const stop = initSections();
    const tones = Array.from(document.querySelectorAll<HTMLElement>("[data-tone]"));
    let frame = 0;
    // After the kit's own scroll tick has set --tp: mark the first half of each tone band's change, so its text
    // colour switches once at 50 % instead of sitting in a grey between two grounds.
    const mark = () => {
      frame = 0;
      for (const band of tones) {
        const tp = Number.parseFloat(band.style.getPropertyValue("--tp"));
        band.toggleAttribute("data-tone-early", Number.isFinite(tp) && tp < 0.5);
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => requestAnimationFrame(mark));
    };
    mark();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      stop();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
  return null;
}

/**
 * Vibe as the page's guide (Design, Preston 01:1x): only at the hero (looks at the selection, blinks), the tour's
 * "read" step (a happy hop when the panel lands) and Download (a wave). Its gaze is fixed toward what it watches;
 * reduced motion and no JS show it at rest.
 */
export function VibeGuide({ mood, size, look = [0, 0], className = "" }: { mood: "watch" | "happy" | "wave"; size: number; look?: readonly [number, number]; className?: string }) {
  return (
    <span className={`lx-vibe lx-vibe--${mood} ${className}`.trim()} aria-hidden="true" style={{ "--look-x": `${look[0]}px`, "--look-y": `${look[1]}px` } as CSSProperties}>
      <Vibe size={size} follow={false} />
    </span>
  );
}

export function Img({ shot, eager, decorative, className }: { shot: Shot; eager?: boolean; decorative?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size real captures
    <img className={className} src={shot.src} width={shot.width} height={shot.height} alt={decorative ? "" : shot.alt} loading={eager ? undefined : "lazy"} decoding="async" />
  );
}

export function Cap({ children }: { children: ReactNode }) {
  return <span className="lx-cap">{children}</span>;
}

export function Logo() {
  return (
    <Link href="/" className="lx-logo" aria-label="Unvibe home">
      {/* eslint-disable-next-line @next/next/no-img-element -- our own mark */}
      <img src="/brand/vibe.svg" width={20} height={20} alt="" />
      <span>Unvibe</span>
    </Link>
  );
}

/**
 * A redesigned sub-page (/pricing, /beta): the site header, its sections in the page's <main> (the root layout leaves
 * <main> to these pages, components/ClassicChrome), the footer.
 */
export function SitePage({ children }: { children: ReactNode }) {
  return (
    <div className="site n-home" id="top">
      {/* the visitor's computer before the first paint, as on home (every variant is in the HTML) */}
      <script dangerouslySetInnerHTML={{ __html: OS_BOOT }} />
      <OsClass />
      <div className="lx-wrap"><SiteHeader /></div>
      <main id="main" tabIndex={-1} className="lx-wrap"><div className="lx-sub-page">{children}</div></main>
      <div className="lx-wrap"><FinePrint /></div>
      <SiteMotion />
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="lx-header">
      <Logo />
      <nav className="lx-nav" aria-label="Primary">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="lx-nav__a">{item.label}</Link>
        ))}
      </nav>
      <Link href="/#email-link" className="lx-btn lx-btn--solid lx-btn--sm sx-btn lx-phone-only">Email me the link</Link>
      <Link href="/beta" className="lx-btn lx-btn--solid lx-btn--sm sx-btn lx-desk-only" onClick={() => trackDownloadPageClick("nav")}>Download free</Link>
    </header>
  );
}

/**
 * The download button (Council R06 / CODE-SPEC §1b.4, Security 0152): on a Mac it opens /beta, where the Terminal line
 * leads (the .dmg isn't notarized yet); on Windows it is the .exe itself. /beta (`page`) shows only the Windows one,
 * since its Mac action is the box beside it.
 */
export function DownloadButtons({ surface, page = false, magnet = false }: { surface: Extract<DownloadSurface, "hero" | "home_install" | "beta">; page?: boolean; magnet?: boolean }) {
  const pull = magnet ? { "data-magnet": "" } : {};
  return (
    <>
      {page ? null : (
        <Link href="/beta" className="lx-btn lx-btn--solid sx-btn lx-mac lx-desk-only" {...pull} onClick={() => trackDownloadPageClick(surface)}>{HERO.download.mac}</Link>
      )}
      <a href={INSTALL_COPY.windows.fileHref} className="lx-btn lx-btn--solid sx-btn lx-win lx-desk-only" {...pull} onClick={() => trackDownloadClick(surface, "windows")}>{HERO.download.windows}</a>
    </>
  );
}

/** The H1 lines move by translate inside a clip (appear--mask style), never by opacity: the H1 is the LCP. */
export function HeroTitle({ id = "hero-title", lines = HERO.h1 }: { id?: string; lines?: readonly ReactNode[] }) {
  return (
    <h1 id={id} className="lx-h1">
      {lines.map((line, index) => (
        <span key={index} className="lx-h1__line"><span className="lx-h1__in" style={{ "--i": index } as CSSProperties}>{line}</span>{index < lines.length - 1 ? " " : null}</span>
      ))}
    </h1>
  );
}

export function HeroLede() {
  // Both computers' shortcuts are in the HTML; OS_BOOT marks Windows before the first paint and CSS shows one, so
  // nothing swaps after hydration (a swap would shift the fold). Phones read the Mac one.
  return (
    <p className="lx-lede">
      {HERO.ledeBefore}{" "}
      <span className="lx-nowrap lx-mac"><kbd>{SHORTCUTS.mac.anywhere}</kbd>.</span>
      <span className="lx-nowrap lx-win"><kbd>{SHORTCUTS.windows.anywhere}</kbd>.</span>{" "}
      <span className="lx-lede__after">{HERO.ledeAfter}</span>
    </p>
  );
}

/**
 * Phones (Design round 06): one violet "Email me the link" button; a tap opens the live email form in its place
 * (a tap-driven change, so it never counts as a layout shift). Shown only on phones (html.os-phone).
 */
export function PhoneEmail({ surface }: { surface: "phone_hero" | "phone_install" }) {
  const [open, setOpen] = useState(false);
  if (open) return <div className="lx-phone lx-phone-only"><EmailMeLink surface={surface} /></div>;
  const tap = () => {
    track("email_link_cta_clicked", { surface });
    setOpen(true);
  };
  return <button type="button" className="lx-btn lx-btn--solid sx-btn lx-phone-cta lx-phone-only" onClick={tap}>Email me the link</button>;
}


/** The live InstallBox's Terminal one-liner with a copy button (the label reads "Copied" for 1.6 s), measured as
 * InstallBox's copy is (beta_install_copied with the surface). */
export function InstallCmd({ os, surface }: { os: "mac" | "windows"; surface: DownloadSurface }) {
  const [copied, setCopied] = useState(false);
  const command = INSTALL_COPY[os].command;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      track("beta_install_copied", { os, surface });
      recordBetaSiteEvent("copied");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="lx-truth__cmd">
      {/* it scrolls sideways on narrow screens, so the keyboard can reach it (axe scrollable-region-focusable) */}
      <code tabIndex={0} aria-label={`Install command: ${command}`}>{command}</code>
      <button type="button" className="lx-truth__copy sx-btn" onClick={() => void copy()} aria-live="polite">{copied ? "Copied" : "Copy"}</button>
    </div>
  );
}

/** A frame around one real capture, with its caption under it (outside the picture). */
export function Fig({ shot, caption, className, rise, style, children }: { shot: Shot; caption: string; className?: string; rise?: boolean | "wipe"; style?: CSSProperties; children?: ReactNode }) {
  return (
    <figure className={`lx-fig${className ? ` ${className}` : ""}`} data-rise={rise === "wipe" ? "wipe" : rise ? "image" : undefined} style={style}>
      <div className="lx-fig__frame"><Img shot={shot} /></div>
      {children}
      <figcaption><Cap>{caption}</Cap></figcaption>
    </figure>
  );
}

export function SectionHead({ id, title, lede, center }: { id: string; title: string; lede?: string; center?: boolean }) {
  return (
    <div className={`lx-head${center ? " lx-head--center" : ""}`}>
      <h2 id={id} data-rise="mask">{title}</h2>
      {lede ? <p className="lx-sub" data-rise="fade" style={d(140)}>{lede}</p> : null}
    </div>
  );
}

export function TryBlock() {
  return (
    <div className="lx-try" data-reveal>
      <SectionHead id="try-it-title" title={TRY.h2} lede={TRY.lede} />
      <div className="lx-try__box ntry__box"><TryIt /></div>
    </div>
  );
}

export function KeysBlock({ dark, privacy }: { dark?: boolean; privacy?: boolean }) {
  return (
    <div className="lx-keysec" data-reveal>
      <div className="lx-keysec__text">
        <SectionHead id="keys-title" title={KEYS.h2} lede={`${KEYS.lede} ${KEYS.never}`} />
        <p data-rise style={d(520)}><Link className="lx-link sx-link" href={KEYS.more.href}>{KEYS.more.label}</Link></p>
      </div>
      <Fig shot={KEY_CHECK_SHOT} caption={CAPTION.v0149} className={`lx-keysec__fig${dark ? " is-dark" : ""}`} rise="wipe" style={d(250)} />
      {/* Design CODE-SPEC §1b.3: the Privacy settings, wide under the key check, with Security's line under it. */}
      {privacy ? (
        <Fig shot={PRIVACY_SHOT} caption={PRIVACY_CAPTION} className="lx-keysec__privacy" rise="wipe">
          <p className="lx-keysec__line">{PRIVACY_LINE}</p>
        </Fig>
      ) : null}
    </div>
  );
}

export function WorksBlock({ center }: { center?: boolean }) {
  return (
    <div className="lx-works" data-reveal>
      <SectionHead id="works-title" title={WORKS.h2} center={center} />
      <ul className="lx-chips" aria-label="Apps">
        {WORKS.chips.map((chip, index) => <li key={chip} className="lx-chip" data-rise style={d(120 + index * 70)}>{chip}</li>)}
      </ul>
    </div>
  );
}

/**
 * The home's price card. "Payments open soon. Nothing is billed today." holds only while checkout is off
 * (lib/paymentsStatus), so it goes when payments open; while hosted AI is paused the Try box's pause note sits
 * under it too (Security SHOULD-H3).
 */
export function PricingBlock({ paymentsOpen, paused = AI_MAINTENANCE }: { paymentsOpen: boolean; paused?: boolean }) {
  return (
    <div className="lx-price" data-reveal>
      <h2 id="pricing-title" data-rise="mask">{PRICING.h2}</h2>
      {paymentsOpen ? null : <p className="lx-sub" data-rise="fade" style={d(140)}>{PRICING.closedLine}</p>}
      <p data-rise="fade" style={d(220)}><Link className="lx-link sx-link" href={PRICING.link.href}>{PRICING.link.label}</Link></p>
      {paused ? <p className="lx-sub" role="status">{AI_MAINTENANCE_NOTE}</p> : null}
    </div>
  );
}

export function FaqBlock() {
  return (
    <div className="lx-faq" data-reveal>
      <SectionHead id="faq-title" title={FAQ.h2} center />
      <div className="lx-faq__rows" data-rise="fade" style={d(160)}>
        <ExpandRows rows={FAQ.items.map((item) => ({ id: item.id, question: item.question, answer: <p>{item.answer}</p> }))} />
        <p className="lx-fine"><Link className="lx-link sx-link" href={FAQ.more.href}>{FAQ.more.label}</Link></p>
      </div>
    </div>
  );
}

/**
 * Get Unvibe (Design round 06): Vibe's wave, the heading, one line, the one primary and the file line Security GO'd
 * (file 0152), beside the live InstallBox (Growth E2: its words unchanged), which opens on the visitor's computer.
 * On /beta the heading is the page's H1 and the box's first-open steps move to their own band.
 */
export function GetUnvibe({ visitor, page }: { visitor: Visitor; page?: boolean }) {
  const Heading = page ? "h1" : "h2";
  const { device, known, intelMac } = visitor;
  // The install card's view, once the visitor's computer is known (BetaInstall's measure, for the viewed → copied funnel).
  useEffect(() => {
    if (known) track("beta_install_viewed", { surface: "page", os: device === "windows" ? "windows" : "mac" });
  }, [known, device]);
  // Both computers' boxes and words ship in the HTML; OS_BOOT shows one before the first paint (no swap, CLS 0).
  return (
    <div className={`lx-get${page ? " lx-get--page" : ""}`} data-reveal>
      <div className="lx-get__side">
        <VibeGuide mood="wave" size={96} look={[1.2, 0.4]} />
        <Heading id="install-title" className="lx-get__h" data-rise="mask">Get Unvibe.</Heading>
        <p className="lx-get__line" data-rise="fade" style={d(140)}>Download, open the app, then press the shortcut in any app.</p>
        <div className="lx-get__cta" data-rise style={d(220)}>
          <PhoneEmail surface="phone_install" />
          <DownloadButtons surface={page ? "beta" : "home_install"} page={page} />
        </div>
        <p className="lx-get__file" data-rise style={d(180)}><span className="lx-mac">Free · .dmg · Apple silicon and Intel</span><span className="lx-win">Free · .exe · Windows, 64-bit</span></p>
      </div>
      <div className="lx-get__box" data-rise="image" style={d(200)}>
        {(["mac", "windows"] as const).map((os) => (
          <div key={os} className={os === "mac" ? "lx-mac" : "lx-win"}>
            <InstallBox os={os} surface={page ? "beta" : "home_install"} intelMac={os === "mac" && intelMac} />
            {/* Design round 06 (/download): the script link, and on a Mac what the Terminal line checks (the box's own note). */}
            {page ? (
              <p className="lx-get__read">
                <a className="lx-link" href={os === "windows" ? "/install.ps1" : "/install.sh"}>Read {os === "windows" ? "install.ps1" : "install.sh"}</a>
                {os === "mac" ? <span>{INSTALL_COPY.mac.note}</span> : null}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const mac = SHORTCUTS.mac;
const win = SHORTCUTS.windows;

/** The live /beta's quick fixes, word for word, as rows like the home's questions (built at render: JSX). */
const helpRows = () => [
  {
    id: "google-wait",
    question: "The app says “Waiting for Google sign-in…”",
    answer: (
      <p>
        Unvibe opened a sign-in page in your browser. Sign in with Google there, then click <strong>Connect this device</strong>.
        The app finishes a few seconds after that click, not after the Google step alone. If no browser opened, go to{" "}
        <a className="lx-link" href="https://api.unvibe.site/activate">api.unvibe.site/activate</a>, sign in, and type the code shown in
        the app. Codes expire after 10 minutes, so restart sign-in if it has been a while.
      </p>
    ),
  },
  {
    id: "mac-first-open",
    question: "macOS won’t open Unvibe the first time",
    answer: (
      <>
        <p>Unvibe is not verified by Apple yet, so macOS blocks the first open. Do this once:</p>
        <ol>
          <li>Press <strong>Done</strong> on the warning.</li>
          <li>Open System Settings, click Privacy &amp; Security, and scroll down to Security.</li>
          <li>Press <strong>Open Anyway</strong>, then confirm when macOS asks again.</li>
          <li>Enter your Mac password, then press <strong>OK</strong>.</li>
        </ol>
        <p>
          The Open Anyway button stays for about an hour after you try to open Unvibe. If it’s gone, open Unvibe again first.
          On macOS 14 or older, you can instead Control-click (right-click) Unvibe in Applications, choose <strong>Open</strong>,
          then press <strong>Open</strong> again.
        </p>
      </>
    ),
  },
  {
    id: "browser-warns",
    question: "Your browser warns about the Windows download",
    answer: (
      <p>
        In Edge, press <strong>…</strong> next to the download, then <strong>Keep</strong>, then <strong>Show more</strong>, then{" "}
        <strong>Keep anyway</strong>. Chrome also lets you keep a file after it warns.
      </p>
    ),
  },
  {
    id: "smartscreen",
    question: "Windows shows “Windows protected your PC”",
    answer: (
      <>
        <p>
          The Windows build is not code-signed yet, so SmartScreen warns about it. Click <strong>More info</strong>, then{" "}
          <strong>Run anyway</strong>. Only do this for the file downloaded from unvibe.site or our GitHub releases.
        </p>
        <p>
          No Run anyway button? Work and school PCs can remove it. If Smart App Control is turned on (Windows 11), it blocks
          unsigned apps like Unvibe and can’t make an exception for one app. Email{" "}
          <a className="lx-link" href="mailto:support@unvibe.site?subject=Unvibe%20Windows%20install">support@unvibe.site</a> and we’ll help.
        </p>
      </>
    ),
  },
  {
    id: "shortcut",
    question: "The shortcut does nothing",
    answer: (
      <p>
        The shortcut that works in every app is {mac.anywhere} on Mac and {win.anywhere} on Windows. On Mac, turn on Unvibe in
        System Settings → Privacy &amp; Security → Accessibility. {mac.editor} ({win.editor} on Windows) only works in Cursor and
        VS Code after you install the editor bridge from Unvibe’s Settings, Integrations. If another app already uses the
        shortcut, change it in Unvibe’s Settings.
      </p>
    ),
  },
  {
    id: "no-sign-in",
    question: "You can start without signing in",
    answer: (
      <>
        <p>
          Skip sign-in on the first screen and you get {TRIAL_ALLOWANCE}. Signing in gives you {FREE_MONTHLY_ALLOWANCE} on Free
          and syncs your history across devices. {proSentence()}
        </p>
        {AI_MAINTENANCE ? <p role="status">{AI_MAINTENANCE_NOTE}</p> : null}
      </>
    ),
  },
] as const;

/**
 * /beta's quick fixes (#help), kept from the live page: the desktop app's Help item and /activate's Help link land
 * here, and /install-help doesn't cover sign-in or the shortcut.
 */
export function HelpBlock() {
  return (
    <div className="lx-faq" data-reveal>
      <SectionHead id="help-title" title="Stuck? Quick fixes." center />
      <div className="lx-faq__rows" data-rise="fade" style={d(160)}>
        <ExpandRows rows={helpRows()} />
        <p className="lx-fine">Need help? <a className="lx-link sx-link" href="mailto:support@unvibe.site?subject=Unvibe%20help">Email us</a></p>
      </div>
    </div>
  );
}

/** Design round 06's step titles over the live InstallBox steps (same order). */
const FIRST_OPEN_TITLES = { mac: ["Drag to Applications", "Open it once", "Open Anyway"], windows: ["Run it", "More info", "Run anyway"] } as const;

/**
 * /beta below Get Unvibe (Design round 06): the first-open steps with titles and real screens, the help
 * link, then the shortcut and the update note (the live /beta words, BetaInstall).
 */
export function FirstOpenBand() {
  // Both computers' steps ship in the HTML; OS_BOOT shows the visitor's before the first paint (Design r09: /download
  // on Windows leads with Windows).
  return (
    <>
      {(["mac", "windows"] as const).map((os) => {
        const copy = INSTALL_COPY[os];
        return (
          <div key={os} className={`lx-first ${os === "mac" ? "lx-mac" : "lx-win"}`} data-reveal>
            <h2 data-rise="mask">{copy.stepsTitle}</h2>
            <ol className="lx-first__steps">
              {copy.steps.map((step, index) => {
                const shot = copy.stepShots[index];
                return (
                  <li key={step} className="lx-first__step" data-rise style={d(80 + index * 90)}>
                    <i>{index + 1}</i>
                    <h3>{FIRST_OPEN_TITLES[os][index]}</h3>
                    <p>{step}</p>
                    {/* eslint-disable-next-line @next/next/no-img-element -- real fixed-size screens, as in InstallBox */}
                    {shot ? <figure><img src={shot.src} width={shot.width} height={shot.height} alt={shot.alt} loading="lazy" /><figcaption>{shot.caption}</figcaption></figure> : null}
                  </li>
                );
              })}
            </ol>
            {os === "windows" ? <p className="lx-first__note" data-rise="fade">{copy.note}</p> : null}
            <p className="lx-first__help" data-rise="fade"><Link className="lx-link sx-link" href="/install-help">More help with the first open <span aria-hidden="true">→</span></Link></p>
          </div>
        );
      })}
      <div className="lx-after" data-reveal>
        <div>
          <h2 data-rise="mask">Select code in any app</h2>
          <p data-rise="fade">{SHORTCUTS.mac.anywhere} on a Mac, {SHORTCUTS.windows.anywhere} on Windows, in any app.</p>
          <p className="lx-after__apps" data-rise="fade">{["Cursor", "VS Code", "Xcode", "Terminal"].map((app) => <span key={app}>{app}</span>)}</p>
        </div>
        <div>
          <h2 data-rise="mask">Updating?</h2>
          <p data-rise="fade">From v0.1.30 on, Unvibe updates from inside the app with one click.</p>
          <p className="lx-mac" data-rise="fade">On an older version, quit it from the menu bar, drag the new one into Applications and choose Replace.</p>
          <p className="lx-win" data-rise="fade">On an older version, quit it from the tray icon, then run the new .exe.</p>
        </div>
      </div>
    </>
  );
}

/* The site-wide footer's links (components/Footer). */
const FOOT_EXPLAIN = [["Product", "/#product"], ["Explain code", "/explain"], ["Code explainer for Mac", "/code-explainer-mac"], ["Code explainer for Windows", "/code-explainer-windows"], ["Use cases", "/use-cases"], ["Download", "/beta"], ["Pricing", "/pricing"], ["Changelog", "/releases"], ["Install help", "/install-help"], ["FAQ", "/faq"], ["Resources", "/resources"]] as const;
const FOOT_COMPANY = [["About", "/about"], ["Building Unvibe", "/build"], ["Investors", "/investors"], ["Privacy", "/privacy"], ["Terms", "/terms"], ["Refunds", "/refund"], ["Open-source notices", "/licenses"], ["Listed on", "/listed-on"], ["Contact", "mailto:support@unvibe.site"]] as const;

/** The footer (Design round 05): the mark and one line, two link lists, then the year and Feedback, which opens the
 * site's own dialog (its tab stays hidden). */
export function FinePrint() {
  return (
    <footer className="lx-foot">
      <div className="lx-foot__grid">
        <div>
          <Link href="/" className="lx-logo">
            {/* eslint-disable-next-line @next/next/no-img-element -- our own mark */}
            <img src="/brand/vibe.svg" width={24} height={24} alt="" /><span>Unvibe</span>
          </Link>
          <p className="lx-foot__blurb">Select code in any app and Vibe explains it beside your editor, at your level. Free for Mac and Windows.</p>
        </div>
        {([["Explain code", FOOT_EXPLAIN], ["Company", FOOT_COMPANY]] as const).map(([heading, links]) => (
          <nav key={heading} aria-label={heading} className="lx-foot__col">
            <h2 className="lx-foot__h">{heading}</h2>
            <ul>
              {links.map(([label, href]) => <li key={href}><Link href={href} className="sx-link" onClick={href === "/beta" ? () => trackDownloadPageClick("footer") : undefined}>{label}</Link></li>)}
              {heading === "Company" ? <li><button type="button" className="lx-foot__fb" onClick={openAnalyticsSettings}>Analytics settings</button></li> : null}
            </ul>
          </nav>
        ))}
      </div>
      <div className="lx-foot__base">
        <span>© {new Date().getFullYear()} Unvibe.</span>
        <button type="button" className="lx-foot__fb" onClick={() => document.querySelector<HTMLButtonElement>(".fb-tab")?.click()}>Feedback</button>
      </div>
    </footer>
  );
}
