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
  { label: "Learn", href: "#learn", id: "learn" },
  { label: "Pricing", href: "#pricing", id: "pricing" },
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

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-all duration-standard",
        scrolled
          ? "border-line bg-bg/92 backdrop-blur-lg"
          : "border-line/70 bg-bg/82 backdrop-blur-md"
      )}
    >
      <nav
        className={cn("container-page flex items-center justify-between gap-4 transition-all duration-standard", scrolled ? "h-[3.25rem] sm:h-14" : "h-14 sm:h-16")}
        aria-label="Primary"
      >
        <Link href="/" className="rounded-md shrink-0" aria-label="Unvibe home">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                aria-current={active === link.id ? "true" : undefined}
                className={cn(
                  "rounded-pill px-3 py-1.5 text-fluid-sm transition-colors duration-micro",
                  active === link.id
                    ? "text-fg"
                    : "text-fg-faint hover:text-fg"
                )}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <Button href="#waitlist" size="sm" className="min-h-10 px-5">
            Join private beta
          </Button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-pill border border-line text-fg"
          >
            <Menu size={17} aria-hidden="true" />
          </button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-fg/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-[min(18rem,85vw)] flex-col bg-bg p-6 shadow-lift">
            <div className="mb-8 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-pill border border-line text-fg"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-2.5 text-fluid-base text-fg hover:bg-surface-2"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-auto flex flex-col gap-3 pt-6">
              <Button href="#waitlist" onClick={() => setOpen(false)}>
                Join private beta
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
