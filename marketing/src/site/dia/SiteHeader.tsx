"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { D_NAV, D_NAV_CTA } from "./content";
import { DownloadCta } from "./DownloadCta";

const PHONE = "(max-width: 820px)";

/** The page regions behind the open phone menu: inert, so Tab and screen readers stay in the menu. */
function setBehindInert(on: boolean) {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("#main, footer"))) {
    if (on) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }
}

/** The visible, focusable controls inside `root`, in tab order. */
function focusables(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter((el) => el.offsetParent !== null);
}

/** Home's header is transparent over the violet hero until the page scrolls; every other page starts solid. */
function useSolid(home: boolean) {
  const [solid, setSolid] = useState(!home);
  useEffect(() => {
    if (!home) {
      setSolid(true);
      return undefined;
    }
    let raf = 0;
    const apply = () => {
      raf = 0;
      setSolid(window.scrollY > 8);
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
  }, [home]);
  return solid;
}

/** While the phone menu is open: page scroll locked, the page behind inert, Escape closes, wider than a phone closes. */
function useMenuLock(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    setBehindInert(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const phone = window.matchMedia(PHONE);
    const onWidth = () => {
      if (!phone.matches) close();
    };
    window.addEventListener("keydown", onKey);
    phone.addEventListener("change", onWidth);
    return () => {
      html.style.overflow = before;
      setBehindInert(false);
      window.removeEventListener("keydown", onKey);
      phone.removeEventListener("change", onWidth);
    };
  }, [open, close]);
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
      {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6.5h14M3 13.5h14" />}
    </svg>
  );
}

/**
 * The one header on every page: a bar across the page, transparent over home's hero and solid paper with a hairline once the
 * page scrolls (other pages are solid from the first frame). The bar's height never changes, so scrolling moves nothing.
 * Desktop: the mark, plain text links and one solid Download button. Phones: the mark and a labelled Menu button that
 * opens a sheet over the whole screen (focus kept inside, Escape closes, the page behind can't scroll). /activate has no header.
 */
export function SiteHeader() {
  const pathname = usePathname() ?? "/";
  const home = pathname === "/";
  const [open, setOpen] = useState(false);
  const solid = useSolid(home);
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const close = useRef(() => {
    setOpen(false);
    toggle.current?.focus();
  }).current;

  useEffect(() => setOpen(false), [pathname]);
  useMenuLock(open, close);
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>("a[href]")?.focus();
  }, [open]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!open || event.key !== "Tab" || !root.current) return;
    const items = focusables(root.current);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  if (pathname.startsWith("/activate")) return null;

  const active = (href: string) => (href === "/" ? home : pathname.startsWith(href));
  const state = open ? "open" : solid ? "solid" : "clear";
  return (
    <header ref={root} className="dh" data-state={state} onKeyDown={onKeyDown}>
      <nav className="dh__bar" aria-label="Primary">
        <Link href="/" className="dh__mark" aria-label="Unvibe home">
          {/* eslint-disable-next-line @next/next/no-img-element -- Vibe, our own mark */}
          <img src="/brand/vibe.svg" width={30} height={30} alt="" />
          <span className="dh__word" aria-hidden="true">Unvibe</span>
        </Link>
        <ul className="dh__links">
          {D_NAV.map((item) => (
            <li key={item.href} className={"wideOnly" in item ? "dh__wide" : undefined}>
              <Link href={item.href} {...(active(item.href) ? { "aria-current": "page" as const } : {})}>{item.label}</Link>
            </li>
          ))}
        </ul>
        <DownloadCta surface="nav" className="dh__cta" dot={false}>{D_NAV_CTA}</DownloadCta>
        <button
          ref={toggle}
          type="button"
          className="dh__toggle"
          aria-expanded={open}
          aria-controls="dh-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <MenuIcon open={open} />
          <span>{open ? "Close" : "Menu"}</span>
        </button>
      </nav>
      <div id="dh-menu" ref={menu} className="dh__menu" hidden={!open}>
        <ul>
          {D_NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} onClick={() => setOpen(false)} {...(active(item.href) ? { "aria-current": "page" as const } : {})}>{item.label}</Link>
            </li>
          ))}
        </ul>
        <DownloadCta surface="nav" className="d-cta d-btn dh__menu-cta" onClick={() => setOpen(false)}>{D_NAV_CTA}</DownloadCta>
      </div>
    </header>
  );
}
