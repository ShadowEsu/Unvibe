"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { DownloadLink } from "@/components/paper/DownloadLink";

const links = [
  { label: "Product", href: "/#product" },
  { label: "Resources", href: "/resources" },
  { label: "Pricing", href: "/pricing" },
  { label: "Change Log", href: "/releases" },
];

export function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // A plain header pinned to the top: same look on every page and scroll position, no motion.
  return (
    <header className="paper-nav paper-nav--solid paper-nav--static">
      <nav className="paper-wrap flex h-16 items-center justify-between gap-4" aria-label="Primary">
        <Link href="/" aria-label="Unvibe home"><Logo /></Link>
        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm">
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            className="nav-kbd"
            aria-label="Search the site"
            onClick={() => window.dispatchEvent(new Event("unvibe:palette"))}
          >
            <kbd>{"⌘"}K</kbd>
          </button>
          <DownloadLink href="/beta" size="nav" />
        </div>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center md:hidden"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          Menu
        </button>
      </nav>

      {open && (
        <div className="paper-sheet md:hidden">
          <button type="button" aria-label="Close menu" className="paper-sheet__scrim" onClick={() => setOpen(false)} />
          <div className="paper-sheet__panel">
            <div className="paper-sheet__head">
              <Logo />
              <button type="button" aria-label="Close menu" onClick={() => setOpen(false)}>Close</button>
            </div>
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="paper-sheet__link">
                {link.label}
              </Link>
            ))}
            <DownloadLink href="/beta" size="nav" className="mt-4 w-full" onClick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
