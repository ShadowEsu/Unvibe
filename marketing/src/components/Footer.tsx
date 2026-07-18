import Link from "next/link";
import { Logo } from "./Logo";
import {
  FOUNDER_EMAIL,
  SUPPORT_EMAIL,
  founderMailto,
  supportMailto,
} from "@/lib/contact";

interface FooterColumn {
  heading: string;
  links: { label: string; href: string }[];
}

const columns: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Explanation levels", href: "#learn" },
      { label: "Context ladder", href: "#context" },
      { label: "Watch demo", href: "#demo" },
      { label: "Pricing", href: "#pricing" },
      { label: "Join private beta", href: "#waitlist" },
    ],
  },
  {
    heading: "Explore",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Project curriculum", href: "#curriculum" },
      { label: "Works beside tools", href: "#tools" },
      { label: "Privacy", href: "#privacy" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Support", href: supportMailto },
      { label: "Preston", href: founderMailto },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Data controls", href: "/data-controls" },
      { label: "Delete account", href: "/account-deletion" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-surface-2/60">
      <div className="container-page py-16">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 max-w-xs">
            <Logo />
            <p className="mt-4 text-fluid-sm leading-relaxed text-fg-muted">
              Don&apos;t feel guilty about vibe coding. Make the code yours.
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className="font-sans text-fluid-sm font-semibold tracking-tight text-fg">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => {
                  const external = link.href.startsWith("mailto:");
                  const internal = link.href.startsWith("/");
                  return (
                    <li key={link.label}>
                      {internal && !external ? (
                        <Link
                          href={link.href}
                          className="text-fluid-sm text-fg-muted transition-colors hover:text-fg"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className="text-fluid-sm text-fg-muted transition-colors hover:text-fg"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-6 text-fluid-sm text-fg-faint sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} Unvibe. Mac first. AI writes it; you learn it.</p>
          <p>
            Support:{" "}
            <a
              href={supportMailto}
              className="text-fg-muted underline underline-offset-2 hover:text-fg"
            >
              {SUPPORT_EMAIL}
            </a>
            {" · "}
            <a
              href={founderMailto}
              className="text-fg-muted underline underline-offset-2 hover:text-fg"
            >
              {FOUNDER_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
