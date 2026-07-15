import Link from "next/link";
import { Logo } from "./Logo";

interface FooterColumn {
  heading: string;
  links: { label: string; href: string }[];
}

const columns: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Works where you do", href: "#works-where" },
      { label: "Watch demo", href: "#demo" },
      { label: "Join waitlist", href: "#waitlist" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { label: "Languages", href: "#learn" },
      { label: "Depth levels", href: "#depth" },
      { label: "Study from projects", href: "#study" },
      { label: "For students", href: "#students" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Contact", href: "mailto:hello@unvibe.app" },
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
    <footer className="border-t border-line bg-surface-2/40">
      <div className="container-page py-16 sm:py-20">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 max-w-xs">
            <Logo />
            <p className="mt-4 text-fluid-sm leading-relaxed text-fg-muted">
              AI can write the code. Unvibe helps you understand it.
            </p>
          </div>
          {columns.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className="font-sans text-fluid-sm font-semibold tracking-tight text-fg">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => {
                  const external = link.href.startsWith("mailto:");
                  const internal = link.href.startsWith("/");
                  return (
                    <li key={link.label}>
                      {internal && !external ? (
                        <Link
                          href={link.href}
                          className="hover-underline text-fluid-sm text-fg-muted transition-colors hover:text-fg"
                        >
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          className="hover-underline text-fluid-sm text-fg-muted transition-colors hover:text-fg"
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

        <div className="mt-14 flex flex-col gap-3 border-t border-line pt-8 text-fluid-sm text-fg-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {year} Unvibe. Mac first. Made for people who want to
            understand their code.
          </p>
          <p>
            Questions?{" "}
            <a
              href="mailto:hello@unvibe.app"
              className="hover-underline text-fg-muted"
            >
              hello@unvibe.app
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
