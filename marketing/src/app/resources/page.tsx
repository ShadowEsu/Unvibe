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
      <header className="a-head">
        <div className="a-head__in">
          <p className="paper-meta">Resources</p>
          <h1>Resources and guides.</h1>
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
