"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { openAnalyticsSettings } from "@/lib/analyticsConsent";
import { trackDownloadClick, trackDownloadPageClick, type DownloadSurface } from "@/lib/downloadTracking";
import { OS_BOOT, OsClass } from "@/site/parts";
import { D_ART_CREDITS, D_DOWNLOAD, D_FOOT, D_HERO, D_NAV, D_NAV_CTA, type Title } from "./content";
import { BtnDot } from "./effects";
import { DiaMotion } from "./motion/DiaMotion";

/** LAB ONLY: Design's type round 2 switch, ?type=1|2|3 (default 1), on <html> before paint, plus a preload of that
 * option's display faces (they're font-display: optional, so they must be in by the first frame; CLS 0). */
const TYPE_FONTS: Record<string, string[]> = {
  "1": ["playfair-display-latin-400-normal", "playfair-display-latin-400-italic"],
  "2": ["cormorant-garamond-latin-500-normal", "cormorant-garamond-latin-500-italic", "dm-sans-latin-400-normal", "dm-sans-latin-500-normal"],
  "3": ["pinyon-script-latin-400-normal", "instrument-serif-latin-400-normal", "instrument-serif-latin-400-italic"],
};
const TYPE_BOOT = `;(function(){var m=/[?&]type=([123])/.exec(location.search),t=m?m[1]:"1",f=${JSON.stringify(TYPE_FONTS)}[t];document.documentElement.setAttribute("data-dtype",t);f.forEach(function(n){var l=document.createElement("link");l.rel="preload";l.as="font";l.type="font/woff2";l.crossOrigin="anonymous";l.href="/d/fonts/"+n+".woff2";document.head.appendChild(l)})})();`;

/** The page root (Motion's contract: .d-page + data-d-bgswap-root): OS classes before paint, then the page. */
export function DiaRoot({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`d d-page ${className}`.trim()} data-d-bgswap-root="">
      {/* type 1 (the default) in the server HTML, so the preload scanner finds it before any script runs */}
      {TYPE_FONTS["1"].map((n) => <link key={n} rel="preload" as="font" type="font/woff2" crossOrigin="anonymous" href={`/d/fonts/${n}.woff2`} />)}
      <script dangerouslySetInnerHTML={{ __html: OS_BOOT + TYPE_BOOT }} />
      <OsClass />
      <DiaMotion />
      {children}
    </div>
  );
}

/** A title with its one italic serif word (kynejang). */
export function T({ t }: { t: Title }) {
  return <>{t.before} <em>{t.em}</em>{t.after ?? ""}</>;
}

/** The nav pill: ghost + 3 links (the current one carries the three-dot indicator) + the "Download free" pill that pops
 * from a dot once the statement is 40 % read (Halden). */
export function DiaNav({ active }: { active: "Product" | "Pricing" }) {
  return (
    <nav className="d-nav" aria-label="Main">
      <Link href="/lab/d" className="d-nav__mark" aria-label="Unvibe home">
        {/* eslint-disable-next-line @next/next/no-img-element -- our own mark */}
        <img src="/brand/vibe.svg" width={26} height={26} alt="" />
      </Link>
      {D_NAV.map((item) => (
        <Link key={item.href} href={item.href} {...(item.label === active ? { "data-d-nav-active": "", "aria-current": "page" as const } : {})}>{item.label}</Link>
      ))}
      <Link href={D_DOWNLOAD.mac} className="d-navcta d-btn lx-mac" data-d-navcta="" data-on={active === "Pricing" ? "" : undefined} onClick={() => trackDownloadPageClick("nav")}><span>{D_NAV_CTA}</span><BtnDot /></Link>
      <a href={D_DOWNLOAD.windows} className="d-navcta d-btn lx-win" data-d-navcta="" data-on={active === "Pricing" ? "" : undefined} onClick={() => trackDownloadClick("nav", "windows")}><span>{D_NAV_CTA}</span><BtnDot /></a>
    </nav>
  );
}

/** "Download Unvibe for free": a Mac opens /beta (the Terminal path), Windows downloads the .exe. Black pill with the
 * Halden dot that grows into a chevron on hover. */
export function DiaCta({ surface, label = D_HERO.cta, swap = false, light = false }: { surface: DownloadSurface; label?: string; swap?: boolean; light?: boolean }) {
  const cls = `d-cta d-btn${light ? " d-cta--light" : ""}`;
  const trigger = swap ? { "data-d-bgswap-trigger": "" } : {};
  return (
    <>
      <Link href={D_DOWNLOAD.mac} className={`${cls} lx-mac`} onClick={() => trackDownloadPageClick(surface)} {...trigger}>
        {label}<BtnDot />
      </Link>
      <a href={D_DOWNLOAD.windows} className={`${cls} lx-win`} onClick={() => trackDownloadClick(surface, "windows")} {...trigger}>
        {label}<BtnDot />
      </a>
    </>
  );
}

/** Motion's dock: the LAST child of [data-d-dock-scope]; sticky at ≥ 800 px, resting under the close section. */
export function DiaDock() {
  return (
    <div data-d-cta-dock="" className="d-dock">
      <div data-d-dock-arc="" aria-hidden="true" />
      <div data-d-dock-pill="" data-d-hero-rise="dock">
        <DiaCta surface="hero" />
        <p className="d-avail">{D_HERO.available}</p>
      </div>
    </div>
  );
}

export function DiaFoot() {
  return (
    <footer className="d-foot">
      <div className="d-foot__cols">
        {D_FOOT.map((col) => (
          <nav key={col.h} aria-label={col.h}>
            <h2>{col.h}</h2>
            <ul>
              {col.links.map(([label, href]) => <li key={href}><Link href={href}>{label}</Link></li>)}
              {col.h === "Company" ? <li><button type="button" onClick={openAnalyticsSettings}>Analytics settings</button></li> : null}
            </ul>
          </nav>
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element -- our own mark */}
        <img className="d-foot__ghost" src="/brand/vibe.svg" width={56} height={56} alt="" />
      </div>
      <div className="d-foot__base">
        <span>© {new Date().getFullYear()} Unvibe</span>
        <span>{D_ART_CREDITS}</span>
      </div>
    </footer>
  );
}
