"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { DownloadLink } from "@/components/paper/DownloadLink";

const links = [
  { label: "Product", href: "/#product" },
  { label: "Resources", href: "/resources" },
  { label: "Pricing", href: "/pricing" },
  { label: "Change Log", href: "/releases" },
  { label: "Founder", href: "/about" },
];

/**
 * One dark bar pinned to the top of every page. On phones the menu opens inside the bar
 * (no overlay sheet); Escape or any link closes it and focus returns to the toggle.
 */
export function Nav() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={open ? "mnav is-open" : "mnav"}>
      <nav className="mnav__bar paper-wrap" aria-label="Primary">
        <Link href="/" aria-label="Unvibe home" className="mnav__home"><Logo /></Link>
        <ul className="mnav__links">
          {links.map((link) => (
            <li key={link.href}><Link href={link.href}>{link.label}</Link></li>
          ))}
        </ul>
        <div className="mnav__end">
          <button
            type="button"
            className="nav-kbd"
            aria-label="⌘K, search the site"
            aria-keyshortcuts="Meta+K Control+K"
            onClick={() => window.dispatchEvent(new Event("unvibe:palette"))}
          >
            <kbd>{"⌘"}K</kbd>
          </button>
          <DownloadLink href="/beta" surface="nav" size="nav" className="mnav__cta" />
          <button
            ref={toggle}
            type="button"
            className="mnav__toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mnav-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span aria-hidden="true" />
          </button>
        </div>
      </nav>
      <div id="mnav-menu" className="mnav__menu paper-wrap" hidden={!open}>
        <ul>
          {links.map((link) => (
            <li key={link.href}><Link href={link.href} onClick={() => setOpen(false)}>{link.label}</Link></li>
          ))}
        </ul>
        <DownloadLink href="/beta" surface="nav" size="nav" className="mnav__cta mnav__cta--menu" onClick={() => setOpen(false)} />
      </div>
    </header>
  );
}
