"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const links = [
  { label: "Product", href: "/#product" },
  { label: "Releases", href: "/#releases" },
  { label: "Pricing", href: "/pricing" },
  { label: "Investors", href: "/investors" },
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
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className={cn(
      "sticky top-0 z-40 border-b transition-colors duration-standard",
      scrolled ? "border-line bg-bg/90 backdrop-blur-lg" : "border-transparent bg-bg/70 backdrop-blur-md",
    )}>
      <nav className="container-page flex h-16 items-center justify-between gap-4" aria-label="Primary">
        <Link href="/" aria-label="Unvibe home"><Logo /></Link>
        <div className="hidden items-center gap-2 md:flex">
          {links.map((link) => <Link key={link.href} href={link.href} className="rounded-pill px-3 py-2 text-fluid-sm text-fg-muted hover:text-fg">{link.label}</Link>)}
          <Link href="/beta" className="rounded-pill bg-primary px-4 py-2 text-fluid-sm font-semibold text-on-primary hover:bg-primary-strong">Download</Link>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <button type="button" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-full border border-line text-fg"><Menu size={18} /></button>
        </div>
      </nav>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-fg/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[min(21rem,88vw)] flex-col gap-2 border-l border-line bg-bg p-6 shadow-lift">
            <div className="mb-6 flex items-center justify-between"><Logo /><button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-line text-fg"><X size={18} /></button></div>
            {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-fluid-lg text-fg hover:bg-surface-2">{link.label}</Link>)}
            <Link href="/beta" onClick={() => setOpen(false)} className="mt-2 rounded-xl bg-primary px-4 py-3 text-center font-semibold text-on-primary">Download</Link>
          </div>
        </div>
      )}
    </header>
  );
}
