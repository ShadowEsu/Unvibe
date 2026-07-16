import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "./Logo";

interface LegalLayoutProps {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}

/**
 * Shared frame for the concise legal / policy pages. These summarize the source policy
 * documents in docs/legal in plain language. They are not a substitute for the full,
 * attorney-reviewed policies and do not claim certifications the product does not hold.
 */
export function LegalLayout({ title, updated, intro, children }: LegalLayoutProps) {
  return (
    <article className="container-page max-w-prose py-16 sm:py-24">
      <Link href="/" className="mb-12 inline-flex rounded-md" aria-label="Unvibe home">
        <Logo />
      </Link>
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-fluid-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Back to Unvibe
      </Link>
      <h1 className="text-balance text-fluid-3xl font-semibold text-fg">{title}</h1>
      <p className="mt-2 text-fluid-sm text-fg-faint">Last updated {updated}</p>
      <p className="mt-6 text-pretty text-fluid-lg leading-relaxed text-fg-muted">
        {intro}
      </p>
      <div className="legal-prose mt-10 space-y-8">{children}</div>
      <div className="mt-14 rounded-card border border-line bg-surface-2/60 p-5 text-fluid-sm text-fg-muted">
        This page summarizes our policies in plain language. Questions? Email{" "}
        <a
          href="mailto:hello@unvibe.app"
          className="text-fg underline underline-offset-2"
        >
          hello@unvibe.app
        </a>
        .
      </div>
    </article>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-fluid-xl font-semibold text-fg">{heading}</h2>
      <div className="mt-3 space-y-3 text-pretty text-fluid-base leading-relaxed text-fg-muted [&_a]:text-primary [&_a:hover]:underline [&_li]:ml-1 [&_strong]:text-fg">
        {children}
      </div>
    </section>
  );
}
