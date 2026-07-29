import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/contact";

const product = [
  ["How it works", "/#how-it-works"],
  ["Pricing", "/pricing"],
  ["Download beta", "/beta"],
  ["Releases", "/releases"],
  ["Build in public", "/build"],
];

const company = [
  ["Investors", "/investors"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Data controls", "/data-controls"],
  ["Delete account", "/account-deletion"],
];

export function Footer() {
  return (
    <footer className="launch-footer">
      <div className="container-page launch-footer__grid">
        <div>
          <Logo />
          <p>AI writes the code. Unvibe helps you understand it.</p>
        </div>
        <FooterLinks heading="Product" links={product} />
        <FooterLinks heading="Company" links={company} />
        <div className="launch-footer__contact">
          <span>Questions or beta support</span>
          <a href={supportMailto}>{SUPPORT_EMAIL}</a>
        </div>
      </div>
      <div className="container-page launch-footer__bottom">
        <p>© {new Date().getFullYear()} Unvibe.</p>
        <p>Mac-first private beta · Perth, Australia</p>
      </div>
    </footer>
  );
}

function FooterLinks({ heading, links }: { heading: string; links: string[][] }) {
  return (
    <nav aria-label={heading}>
      <span>{heading}</span>
      {links.map(([label, href]) => (
        <Link key={href} href={href!}>{label}</Link>
      ))}
    </nav>
  );
}
