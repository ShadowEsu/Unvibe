"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { JoinWaitlistLink } from "@/components/paper/JoinWaitlistLink";

const links = [
  { label: "Product", href: "/" },
  { label: "Pricing", href: "/pricing" },
  { label: "Change Log", href: "/releases" },
  { label: "Growth", href: "/build" },
  { label: "Investors", href: "/investors" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const onHome = pathname === "/";

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

  const navClass = [
    "paper-nav",
    scrolled ? "paper-nav--scrolled" : "",
    onHome ? "" : "paper-nav--solid",
  ].filter(Boolean).join(" ");

  return (
    <header className={navClass}>
      <nav className="paper-wrap flex h-16 items-center justify-between gap-4" aria-label="Primary">
        <Link href="/" aria-label="Unvibe home"><Logo /></Link>
        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm">
              {link.label}
            </Link>
          ))}
          <JoinWaitlistLink href="/#waitlist" size="nav" />
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
            <JoinWaitlistLink href="/#waitlist" size="nav" className="mt-4 w-full" onClick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}
