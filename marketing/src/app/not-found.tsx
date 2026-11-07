import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

/** Where people who land on a missing page most likely meant to go (Design W15). */
const LIKELY = [
  ["Download", "/beta"],
  ["Help", "/help"],
  ["Install help", "/install-help"],
  ["Pricing", "/pricing"],
  ["Changelog", "/releases"],
] as const;

/** Says plainly what happened, never blames the visitor, and offers the likely destinations and search. */
export default function NotFound() {
  return (
    <section className="nf">
      <img src="/hero/golden-gate-band-1600.webp" srcSet="/hero/golden-gate-band-800.webp 800w, /hero/golden-gate-band-1600.webp 1600w" sizes="100vw" alt="" />
      <div className="paper-hero__veil" />
      <div className="nf__card paper-glass">
        <h1>We can&apos;t find that page.</h1>
        <p>Check the address, or try one of these.</p>
        <ul className="nf__actions">
          {LIKELY.map(([label, href], index) => (
            <li key={href}>
              <Link href={href} className={index === 0 ? "nf__btn nf__btn--ink" : "nf__btn"}>{label}</Link>
            </li>
          ))}
        </ul>
        <p className="nf__search">
          Press <kbd>⌘K</kbd> or <kbd>Ctrl+K</kbd> to search the site.
        </p>
        <p className="nf__code" aria-hidden="true">
          <span>const</span> page = routes.find(r =&gt; r.path === <span className="nf__str">&quot;here&quot;</span>); <span>{"// undefined"}</span>
        </p>
      </div>
    </section>
  );
}
