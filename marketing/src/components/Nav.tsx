"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

interface NavLink {
  label: string;
  href: string;
  id: string;
}

const links: NavLink[] = [
  { label: "Product", href: "#product", id: "product" },
  { label: "How it works", href: "#how-it-works", id: "how-it-works" },
  { label: "Depth", href: "#learn", id: "learn" },
  { label: "Privacy", href: "#privacy", id: "privacy" },
  { label: "FAQ", href: "#faq", id: "faq" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track which section is in view for active-link styling.
  useEffect(() => {
    const observed = links
      .map((l) => document.getElementById(l.id))
      .filter((el): el is HTMLElement => el !== null);
    if (observed.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.25, 0.5] }
    );
    observed.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Lock body scroll when the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-standard",
        scrolled
          ? "border-b border-line bg-bg/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      )}
    >
      <nav
        className="container-page flex h-16 items-center justify-between gap-4"
        aria-label="Primary"
      >
        <Link href="/" className="rounded-md" aria-label="Unvibe home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                aria-current={active === link.id ? "true" : undefined}
                className={cn(
                  "rounded-pill px-3 py-2 text-fluid-sm transition-colors duration-micro",
                  active === link.id
                    ? "text-fg"
                    : "text-fg-muted hover:text-fg"
                )}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Button href="#demo" variant="ghost" size="sm">
            Watch demo
          </Button>
          <Button href="#waitlist" size="sm">
            Join waitlist
          </Button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-pill border border-line text-fg"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(20rem,86vw)] flex-col bg-bg p-6 shadow-lift">
            <div className="mb-8 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-pill border border-line text-fg"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-3 text-fluid-lg text-fg hover:bg-surface-2"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col gap-3 pt-6">
              <Button href="#demo" variant="secondary" onClick={() => setOpen(false)}>
                Watch demo
              </Button>
              <Button href="#waitlist" onClick={() => setOpen(false)}>
                Join waitlist
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
