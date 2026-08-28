"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListingBadges } from "@/components/paper/ListingBadges";
import { SocialFollowLinks } from "@/components/paper/SocialFollow";
import { Logo } from "@/components/Logo";

const product = [
  ["Product", "/"],
  ["Pricing", "/pricing"],
  ["Join waitlist", "/waitlist"],
  ["Change Log", "/releases"],
  ["Growth", "/build"],
];

const company = [
  ["Investors", "/investors"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
];

export function Footer() {
  const pathname = usePathname();

  return (
    <footer className="paper-footer">
      <div className="paper-wrap grid gap-10 py-14 sm:grid-cols-[1fr_auto_auto]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed">
            Select the code. Press Command U. Keep what you learned on this Mac.
          </p>
          <SocialFollowLinks includeMail />
        </div>
        <FooterLinks heading="Product" links={product} />
        <FooterLinks heading="Company" links={company} />
      </div>
      {pathname !== "/" ? (
        <div className="paper-wrap pb-10">
          <ListingBadges />
        </div>
      ) : null}
      <div className="paper-footer__legal paper-wrap py-5 text-sm">
        <p>© {new Date().getFullYear()} Unvibe. Perth, Australia.</p>
      </div>
    </footer>
  );
}

function FooterLinks({ heading, links }: { heading: string; links: readonly string[][] }) {
  return (
    <nav aria-label={heading} className="grid content-start gap-2">
      <strong className="mb-1 text-sm text-[color:var(--ink)]">{heading}</strong>
      {links.map(([label, href]) => (
        <Link key={href} href={href!} className="text-sm hover:text-[color:var(--ink)]">{label}</Link>
      ))}
    </nav>
  );
}
