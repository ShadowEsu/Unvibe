"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ListingBadges } from "@/components/paper/ListingBadges";
import { SocialFollowLinks } from "@/components/paper/SocialFollow";
import { Logo } from "@/components/Logo";
import { trackDownloadPageClick } from "@/lib/downloadTracking";
import { observeMotion } from "@/lib/motionInView";
import { ThemeToggle } from "@/components/ThemeToggle";

const product = [
  ["Product", "/#product"],
  ["Explain code", "/explain"],
  ["Download", "/beta"],
  ["Pricing", "/pricing"],
  ["Change log", "/releases"],
  ["Install help", "/install-help"],
  ["Resources", "/resources"],
];

const company = [
  ["About", "/about"],
  ["Building Unvibe", "/build"],
  ["Investors", "/investors"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Contact", "mailto:support@unvibe.site"],
];

export function Footer() {
  const pathname = usePathname();
  const statusRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => (statusRef.current ? observeMotion(statusRef.current) : undefined), []);

  // /activate is a full-screen card over the page; a footer under it would only add hidden Tab stops.
  if (pathname?.startsWith("/activate")) return null;

  return (
    <footer className="paper-footer">
      <div className="paper-wrap grid gap-10 py-14 sm:grid-cols-[1fr_auto_auto]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed">
            Select code in any app and Vibe explains it beside your editor, at your level. Free for Mac and Windows.
          </p>
          <SocialFollowLinks includeMail />
        </div>
        <FooterLinks heading="Product" links={product} />
        <FooterLinks heading="Company" links={company} />
      </div>
      {/* The homepage gets the plain links only: directories such as Startup Fame check for a visible, followed link there. */}
      <div className="paper-wrap pb-10">
        <ListingBadges textOnly={pathname === "/"} />
      </div>
      <div className="paper-footer__legal paper-wrap py-5 text-sm">
        <p>© {new Date().getFullYear()} Unvibe. Pleasant Hill, California.</p>
        {/* This site's own shortcuts (SitePalette, SelectionExplain), not the desktop app's. */}
        <p className="paper-footer__status" ref={statusRef}>
          <span className="paper-footer__dot" aria-hidden="true" /> Live for Mac and Windows · Press <kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd> to search this site, or select text here and press <kbd>⌘U</kbd> / <kbd>Ctrl+U</kbd>
        </p>
        <ThemeToggle className="paper-footer__theme" />
      </div>
    </footer>
  );
}

/** The download page link counts as a download call to action. */
export function FooterLinks({ heading, links }: { heading: string; links: readonly string[][] }) {
  return (
    <nav aria-label={heading} className="grid content-start gap-2">
      <strong className="mb-1 text-sm text-[color:var(--ink)]">{heading}</strong>
      {links.map(([label, href]) => (
        <Link key={href} href={href!} className="text-sm hover:text-[color:var(--ink)]" onClick={href === "/beta" ? () => trackDownloadPageClick("footer") : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
