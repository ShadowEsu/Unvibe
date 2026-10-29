import type { Metadata } from "next";
import { ChangelogList } from "@/components/paper/ChangelogList";
import { DownloadRow } from "@/components/paper/DownloadLink";
import { changelogEntries } from "@/data/milestones";
import { fetchReleases } from "@/lib/releases";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = pageMetadata({
  path: "/releases",
  title: "Unvibe Change Log: What Shipped",
  absolute: true,
  description: "Every Unvibe release and product change, newest first, with the date of each update for Mac and Windows.",
});

export const revalidate = 300;

export default async function ReleasesPage() {
  const { releases, error } = await fetchReleases();
  const latest = releases[0];

  return (
    <article className="releases-page">
      <header className="paper-photo-band">
        <img src="/hero/golden-gate-band-1600.webp" srcSet="/hero/golden-gate-band-800.webp 800w, /hero/golden-gate-band-1600.webp 1600w" sizes="100vw" alt="" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Change log</p>
          <h1>What <em>shipped.</em></h1>
          <p>
            {latest
              ? `${latest.name.replace(/[—–]/g, ",")} is the newest build on GitHub.`
              : error
                ? "GitHub release data is temporarily unavailable."
                : "Product and company notes, newest first."}
          </p>
          <DownloadRow href="/beta" surface="releases" />
        </div>
      </header>

      <section className="paper-section">
        <div className="paper-wrap paper-log-wrap paper-glass">
          <h2 className="sr-only">Release notes</h2>
          <ChangelogList items={changelogEntries()} />
        </div>
      </section>
    </article>
  );
}
