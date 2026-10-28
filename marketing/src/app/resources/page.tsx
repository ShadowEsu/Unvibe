import type { Metadata } from "next";
import { ResourcesHub } from "@/components/paper/ResourcesHub";
import { pageMetadata } from "@/lib/pageMeta";
import "./resources.css";

export const metadata: Metadata = pageMetadata({
  path: "/resources",
  title: "Unvibe Guide: Depths, Shortcuts and Privacy",
  absolute: true,
  description:
    "How to use Unvibe: the explanation depths, the Mac and Windows shortcuts, and exactly what is sent when you explain code.",
});

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
