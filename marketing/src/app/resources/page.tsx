import type { Metadata } from "next";
import { ResourcesHub } from "@/components/paper/ResourcesHub";

export const metadata: Metadata = {
  title: "Resources, Guides & Architecture — Unvibe",
  description:
    "Explore developer guides, architecture deep-dives, the 5 depths of code comprehension, keyboard shortcuts, and zero-knowledge privacy documentation for Unvibe.",
  openGraph: {
    title: "Resources, Guides & Architecture — Unvibe",
    description:
      "Explore developer guides, architecture deep-dives, the 5 depths of code comprehension, keyboard shortcuts, and zero-knowledge privacy documentation for Unvibe.",
    url: "https://unvibe.site/resources",
    siteName: "Unvibe",
    images: [
      {
        url: "/og/share.png",
        width: 1200,
        height: 630,
        alt: "Unvibe Resources and Architecture Documentation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Resources, Guides & Architecture — Unvibe",
    description:
      "Explore developer guides, architecture deep-dives, the 5 depths of code comprehension, keyboard shortcuts, and zero-knowledge privacy documentation for Unvibe.",
    images: ["/og/share.png"],
  },
};

export default function ResourcesPage() {
  return (
    <article className="launch-subpage paper-resources-page">
      <header className="paper-photo-band paper-photo-band--short">
        <img src="/hero/golden-gate.png" alt="" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Developer Knowledge Base</p>
          <h1>Resources & Guides.</h1>
          <p>
            Everything you need to master code comprehension, configure your editor, understand local secret filtering, and retain what AI generates.
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
