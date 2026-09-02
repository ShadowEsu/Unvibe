import Link from "next/link";
import { ListingBadges } from "@/components/paper/ListingBadges";
import { SocialFollowLinks } from "@/components/paper/SocialFollow";
import { Logo } from "@/components/Logo";

const product = [
  ["Product", "/#product"],
  ["Teams", "/teams"],
  ["Pricing", "/pricing"],
  ["Get Unvibe", "/#install"],
  ["Change Log", "/releases"],
];

const company = [
  ["Investors", "/investors"],
  ["Growth", "/build"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
];

export function Footer() {
  return (
    <footer className="paper-footer">
      <div className="paper-wrap grid gap-10 py-14 sm:grid-cols-[1fr_auto_auto]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed">
            Select code → AI explains it → save concepts → learn.
          </p>
          <SocialFollowLinks includeMail />
        </div>
        <FooterLinks heading="Product" links={product} />
        <FooterLinks heading="Company" links={company} />
      </div>
      <div className="paper-wrap pb-10">
        <ListingBadges />
      </div>
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
