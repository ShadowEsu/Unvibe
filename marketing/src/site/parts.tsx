"use client";

/**
 * The redesigned site's sections (Design package-1106, round 10): home, /pricing and /beta are built from these over
 * site/content.ts, styled by site.css (structure) and home.css (the package look) under the page root `.site`.
 * Motion is Motion's kit (motion/sections, data attributes), started once per page by <SiteMotion />; the three
 * motion moments live in site/moments.
 */
import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ExpandRows } from "@/components/paper/ExpandRows";
import { EmailMeLink } from "@/components/paper/EmailMeLink";
import { INSTALL_COPY, InstallBox } from "@/components/paper/InstallBox";
import { recordBetaSiteEvent, track } from "@/lib/analytics";
import { AI_MAINTENANCE, AI_MAINTENANCE_NOTE } from "@/lib/aiMaintenance";
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
 * Runs inline before the first paint: html.os-win when the visitor is on Windows (or ?os=win), so the server's HTML,
 * which carries both computers' words, shows the right ones without a swap after hydration.
 */
export const OS_BOOT = `(function(){var q=new URLSearchParams(location.search).get("os");var w=q==="win"||(q!=="mac"&&/Windows/i.test(navigator.userAgent));document.documentElement.classList.toggle("os-win",w)})()`;

export function useDevice(): VisitorDevice {
  const [device, setDevice] = useState<VisitorDevice>("mac");
  useEffect(() => {
    // ?os=win / ?os=mac preview the other computer's page (Design's renders use the same switch).
    const forced = new URLSearchParams(window.location.search).get("os");
    setDevice(forced === "win" ? "windows" : forced === "mac" ? "mac" : detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints));
  }, []);
  return device;
}

export function keysFor(device: VisitorDevice): readonly string[] {
  return device === "windows" ? ["Ctrl", "Alt", "U"] : ["Control", "U"];
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

/** A redesigned sub-page (/pricing, /beta): the site header, its sections, the footer. */
export function SitePage({ children }: { children: ReactNode }) {
  const device = useDevice();
  return (
    <div className="site n-home" id="top">
      {/* the visitor's computer before the first paint, as on home (both computers' words are in the HTML) */}
      <script dangerouslySetInnerHTML={{ __html: OS_BOOT }} />
      <div className="lx-wrap"><SiteHeader device={device} /></div>
      <div className="lx-wrap"><div className="lx-sub-page">{children}</div><FinePrint /></div>
      <SiteMotion />
    </div>
  );
}

export function SiteHeader({ device }: { device: VisitorDevice }) {
  const phone = device === "phone";
  return (
    <header className="lx-header">
      <Logo />
      <nav className="lx-nav" aria-label="Primary">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="lx-nav__a">{item.label}</Link>
        ))}
      </nav>
      <Link href={phone ? "/#email-link" : "/beta"} className="lx-btn lx-btn--solid lx-btn--sm sx-btn" onClick={phone ? undefined : () => trackDownloadPageClick("nav")}>{phone ? "Email me the link" : "Download free"}</Link>
    </header>
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

export function HeroLede({ device }: { device: VisitorDevice }) {
  // Both computers' shortcuts are in the HTML; OS_BOOT marks Windows before the first paint and CSS shows one, so
  // nothing swaps after hydration (a swap would shift the fold). Phones read the Mac one.
  void device;
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
 * (a tap-driven change, so it never counts as a layout shift).
 */
export function PhoneEmail() {
  const [open, setOpen] = useState(false);
  if (open) return <div className="lx-phone"><EmailMeLink /></div>;
  return <button type="button" className="lx-btn lx-btn--solid sx-btn lx-phone-cta" onClick={() => setOpen(true)}>Email me the link</button>;
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
export function GetUnvibe({ device, page }: { device: VisitorDevice; page?: boolean }) {
  const Heading = page ? "h1" : "h2";
  // Both computers' boxes and words ship in the HTML; OS_BOOT shows one before the first paint (no swap, CLS 0).
  return (
    <div className={`lx-get${page ? " lx-get--page" : ""}`} data-reveal>
      <div className="lx-get__side">
        <VibeGuide mood="wave" size={96} look={[1.2, 0.4]} />
        <Heading id="install-title" className="lx-get__h" data-rise="mask">Get Unvibe.</Heading>
        <p className="lx-get__line" data-rise="fade" style={d(140)}>Download, open the app, then press the shortcut in any app.</p>
        {/* Home: the button opens /beta. On /beta itself the box beside it is the Mac action (the Terminal line first;
            the .dmg isn't notarized yet, so no button downloads it), and Windows' button is the .exe (Security 0152). */}
        <div className="lx-get__cta" data-rise style={d(220)}>
          {device === "phone" ? <PhoneEmail /> : page ? (
            <a href={INSTALL_COPY.windows.fileHref} className="lx-btn lx-btn--solid sx-btn lx-win" onClick={() => trackDownloadClick("beta", "windows")}>{HERO.download.windows}</a>
          ) : (
            <Link href="/beta" className="lx-btn lx-btn--solid sx-btn" onClick={() => trackDownloadPageClick("home_install")}><span className="lx-mac">{HERO.download.mac}</span><span className="lx-win">{HERO.download.windows}</span></Link>
          )}
        </div>
        <p className="lx-get__file" data-rise style={d(180)}><span className="lx-mac">Free · .dmg · Apple silicon and Intel</span><span className="lx-win">Free · .exe · Windows, 64-bit</span></p>
      </div>
      <div className="lx-get__box" data-rise="image" style={d(200)}>
        {(["mac", "windows"] as const).map((os) => (
          <div key={os} className={os === "mac" ? "lx-mac" : "lx-win"}>
            <InstallBox os={os} surface={page ? "beta" : "home_install"} />
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

/** Design round 06's step titles over the live InstallBox steps (same order). */
const FIRST_OPEN_TITLES = { mac: ["Drag to Applications", "Open it once", "Open Anyway"], windows: ["Run it", "More info", "Run anyway"] } as const;

/**
 * /beta below Get Unvibe (Design round 06): the first-open steps with titles and real screens, the help
 * link, then the shortcut and the update note (the live /beta words, BetaInstall).
 */
export function FirstOpenBand({ device }: { device: VisitorDevice }) {
  void device;
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

/* The site-wide footer's links (components/Footer), less its /#product anchor, which this home doesn't have. */
const FOOT_EXPLAIN = [["Explain code", "/explain"], ["Code explainer for Mac", "/code-explainer-mac"], ["Code explainer for Windows", "/code-explainer-windows"], ["Use cases", "/use-cases"], ["Download", "/beta"], ["Pricing", "/pricing"], ["Changelog", "/releases"], ["Install help", "/install-help"], ["FAQ", "/faq"], ["Resources", "/resources"]] as const;
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
