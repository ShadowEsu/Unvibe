"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { D_NAV, D_NAV_CTA } from "./content";
import { DownloadCta } from "./DownloadCta";

/**
 * The one header on every page (Preston, 6 Nov: "make sure only 1 glass effect header"; plan rev 3 mock 19): a pinned
 * mirror-glass pill that blurs and tints whatever scrolls under it (blur 18 px, saturate 1.8, a lens edge, a sheen,
 * a white rim). Past 80 px it settles to 94 % and turns a little more solid (ANIMATIONS #2), and a 2 px lime line
 * inside its bottom edge grows with the page's scroll (#3). The home page pops its "Download free" from a dot once
 * the statement is 40 % read (#21, effects.tsx sets data-on); every other page shows it from the start. Phones get the
 * ghost + wordmark + a "+" that opens the links inside the glass. /activate is a full-screen card: no header there.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const home = pathname === "/";
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const el = root.current;
    if (!el) return undefined;
    let raf = 0;
    const apply = () => {
      raf = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.toggleAttribute("data-settled", y > 80);
      el.style.setProperty("--d-progress", (max > 0 ? Math.min(1, y / max) : 0).toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname.startsWith("/activate")) return null;

  const active = (href: string) => (href === "/" ? home : pathname.startsWith(href));
  return (
    <header ref={root} className={open ? "dh is-open" : "dh"} data-home={home ? "" : undefined}>
      <div className="dh__glass" aria-hidden="true" />
      <nav className="dh__bar" aria-label="Primary">
        <Link href="/" className="dh__mark" aria-label="Unvibe home">
          {/* eslint-disable-next-line @next/next/no-img-element -- Vibe, our own mark */}
          <img src="/brand/vibe.svg" width={28} height={28} alt="" />
          <span className="dh__word" aria-hidden="true">Unvibe</span>
        </Link>
        <ul className="dh__links">
          {D_NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} {...(active(item.href) ? { "data-d-nav-active": "", "aria-current": "page" as const } : {})}>{item.label}</Link>
            </li>
          ))}
        </ul>
        <DownloadCta surface="nav" className="dh__cta d-btn" data-d-navcta="" data-on={home ? undefined : ""}>
          <span>{D_NAV_CTA}</span>
        </DownloadCta>
        <button
          ref={toggle}
          type="button"
          className="dh__toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="dh-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true" />
        </button>
      </nav>
      <div id="dh-menu" className="dh__menu" hidden={!open}>
        <ul>
          {D_NAV.map((item) => (
            <li key={item.href}><Link href={item.href} onClick={() => setOpen(false)}>{item.label}</Link></li>
          ))}
        </ul>
        <DownloadCta surface="nav" className="d-cta d-btn dh__menu-cta" onClick={() => setOpen(false)}>{D_NAV_CTA}</DownloadCta>
      </div>
      <span className="dh__progress" aria-hidden="true" />
    </header>
  );
}
