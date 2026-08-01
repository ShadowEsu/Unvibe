import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/contact";

const product = [
  ["Watch demo", "/#demo"],
  ["Pricing", "/pricing"],
  ["Download beta", "/beta"],
  ["Build in public", "/build"],
];

const company = [
  ["Investors", "/investors"],
  ["Privacy", "/privacy"],
  ["Terms", "/terms"],
  ["Data controls", "/data-controls"],
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface-2/60">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-[1fr_auto_auto]">
        <div className="max-w-sm"><Logo /><p className="mt-4 text-fluid-sm leading-relaxed text-fg-muted">AI writes the code. Unvibe helps you learn what you shipped.</p></div>
        <FooterLinks heading="Product" links={product} />
        <FooterLinks heading="Company" links={company} />
      </div>
      <div className="container-page flex flex-col gap-2 border-t border-line py-5 text-fluid-sm text-fg-faint sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Unvibe · Perth, Australia</p>
        <a href={supportMailto} className="hover:text-fg">{SUPPORT_EMAIL}</a>
      </div>
    </footer>
  );
}

function FooterLinks({ heading, links }: { heading: string; links: readonly string[][] }) {
  return <nav aria-label={heading} className="grid content-start gap-2"><strong className="mb-1 text-fluid-sm text-fg">{heading}</strong>{links.map(([label, href]) => <Link key={href} href={href!} className="text-fluid-sm text-fg-muted hover:text-fg">{label}</Link>)}</nav>;
}
