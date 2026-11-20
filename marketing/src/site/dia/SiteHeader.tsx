"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { D_NAV, D_NAV_CTA } from "./content";
import { DownloadCta } from "./DownloadCta";

/**
 * The one header on every page (Option A, Design §3): a 64 px white bar. Vibe and "Unvibe" on the left, the links
 * centred, "Download free" as an ink pill on the right. It gets its shadow only once the page has scrolled (the one
 * thing that floats). At ≤ 820 px the links and the pill fold into the menu button. /activate is a full-screen card:
 * no header there.
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
      el.toggleAttribute("data-scrolled", window.scrollY > 4);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
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
    <header ref={root} className={open ? "dh is-open" : "dh"}>
      <nav className="dh__bar" aria-label="Primary">
        <Link href="/" className="dh__mark" aria-label="Unvibe home">
          {/* eslint-disable-next-line @next/next/no-img-element -- Vibe, our own mark */}
          <img src="/brand/vibe.svg" width={26} height={26} alt="" />
          <span className="dh__word" aria-hidden="true">Unvibe</span>
        </Link>
        <ul className="dh__links">
          {D_NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} {...(active(item.href) ? { "aria-current": "page" as const } : {})}>{item.label}</Link>
            </li>
          ))}
        </ul>
        <DownloadCta surface="nav" className="dh__cta">{D_NAV_CTA}</DownloadCta>
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
            <li key={item.href}><Link href={item.href} {...(active(item.href) ? { "aria-current": "page" as const } : {})} onClick={() => setOpen(false)}>{item.label}</Link></li>
          ))}
        </ul>
        <DownloadCta surface="nav" className="d-cta dh__menu-cta" onClick={() => setOpen(false)}>{D_NAV_CTA}</DownloadCta>
      </div>
    </header>
  );
}
