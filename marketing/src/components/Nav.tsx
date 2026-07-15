"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { durations, easing } from "@/lib/motion";

interface NavLink {
  label: string;
  href: string;
  id: string;
}

const links: NavLink[] = [
  { label: "Product", href: "#product", id: "product" },
  { label: "How it works", href: "#demo", id: "demo" },
  { label: "Learn", href: "#depth", id: "depth" },
  { label: "Privacy", href: "#privacy", id: "privacy" },
  { label: "FAQ", href: "#faq", id: "faq" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);

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

  // A modal navigation should behave like a native sheet: Escape closes it,
  // Tab stays within it, and focus returns to the button that opened it.
  useEffect(() => {
    if (!open) return;

    const focusFrame = window.requestAnimationFrame(() => {
      closeMenuRef.current?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab" || !menuRef.current) return;
      const focusable = Array.from(
        menuRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled
          ? "border-b border-line/60 bg-bg/80 shadow-[0_1px_3px_rgb(0,0,0,0.04)] backdrop-blur-xl"
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
                  "relative rounded-pill px-3 py-2 text-fluid-sm transition-colors duration-micro",
                  active === link.id
                    ? "text-fg"
                    : "text-fg-muted hover:text-fg"
                )}
              >
                {active === link.id && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-pill bg-surface-2"
                    transition={{
                      duration: durations.standard,
                      ease: easing.emphatic,
                    }}
                  />
                )}
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
          <Button href="#waitlist" size="sm" className="btn-magnetic">
            Join beta
          </Button>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            ref={menuTriggerRef}
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-pill border border-line text-fg transition-colors hover:bg-surface-2"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
        </div>
      </nav>

      {/* Mobile sheet */}
      <AnimatePresence onExitComplete={() => menuTriggerRef.current?.focus()}>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 lg:hidden"
          >
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{
                duration: durations.standard,
                ease: easing.emphatic,
              }}
              ref={menuRef}
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              className="absolute right-0 top-0 flex h-full w-[min(22rem,88vw)] flex-col bg-bg p-6 shadow-lift"
            >
              <div className="mb-8 flex items-center justify-between">
                <Logo />
                <button
                  ref={closeMenuRef}
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-pill border border-line text-fg transition-colors hover:bg-surface-2"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {links.map((link, i) => (
                  <motion.li
                    key={link.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.08 + i * 0.04,
                      duration: durations.standardFast,
                      ease: easing.emphatic,
                    }}
                  >
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-3 py-3 text-fluid-lg text-fg transition-colors hover:bg-surface-2"
                    >
                      {link.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-3 pt-6">
                <Button
                  href="#demo"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                >
                  Watch demo
                </Button>
                <Button href="#waitlist" onClick={() => setOpen(false)}>
                  Join the private beta
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
