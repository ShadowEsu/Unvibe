"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { FounderClock } from "@/components/FounderClock";
import { Logo } from "@/components/Logo";

const links = [
  { label: "Pricing", href: "/pricing" },
  { label: "Investors", href: "/investors" },
  { label: "How it works", href: "/#how-it-works" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={`launch-nav${scrolled ? " launch-nav--scrolled" : ""}`}>
      <nav className="container-page launch-nav__inner" aria-label="Primary">
        <Link href="/" aria-label="Unvibe home">
          <Logo />
        </Link>
        <div className="launch-nav__links">
          {links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
          <Link href="/beta" className="launch-nav__download">Download beta</Link>
          <FounderClock />
        </div>
        <button
          type="button"
          className="launch-nav__menu"
          aria-label="Open navigation"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu size={18} />
        </button>
      </nav>

      {open && (
        <div className="launch-drawer">
          <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <div>
            <div className="launch-drawer__head">
              <Logo />
              <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <FounderClock compact onNavigate={() => setOpen(false)} />
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link href="/releases" onClick={() => setOpen(false)}>Releases</Link>
            <Link href="/beta" onClick={() => setOpen(false)} className="launch-nav__download">
              Download beta
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
