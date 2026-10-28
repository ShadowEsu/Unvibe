import type { Metadata } from "next";
import { ResourcesHub } from "@/components/paper/ResourcesHub";
import "./resources.css";

export const metadata: Metadata = {
  title: "Resources and guides",
  description:
    "Get started with Unvibe: the five explanation depths, keyboard shortcuts, how your code is handled, and brand colors.",
  alternates: { canonical: "/resources" },
  openGraph: {
    title: "Resources and guides",
    description:
      "Get started with Unvibe: the five explanation depths, keyboard shortcuts, how your code is handled, and brand colors.",
    url: "https://unvibe.site/resources",
    siteName: "Unvibe",
    images: [
      {
        url: "/og/og-home.png",
        width: 1200,
        height: 630,
        alt: "Unvibe resources and guides",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Resources and guides",
    description:
      "Get started with Unvibe: the five explanation depths, keyboard shortcuts, how your code is handled, and brand colors.",
    images: ["/og/og-home.png"],
  },
};

export default function ResourcesPage() {
  return (
    <article className="launch-subpage paper-resources-page">
      <header className="paper-photo-band paper-photo-band--short">
        <img src="/hero/golden-gate-band-1600.webp" srcSet="/hero/golden-gate-band-800.webp 800w, /hero/golden-gate-band-1600.webp 1600w" sizes="100vw" alt="" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Resources</p>
          <h1>Resources and <em>guides.</em></h1>
          <p>
            Get set up, choose an explanation depth, and see exactly how your code is handled.
          </p>
        </div>
      </header>

      <section className="paper-section">
        <div className="paper-wrap">
          <ResourcesHub />
        </div>
      </section>
    </article>
  );
}
