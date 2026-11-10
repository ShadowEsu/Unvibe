import type { Metadata } from "next";
import { ChangelogList } from "@/components/paper/ChangelogList";
import { DownloadRow } from "@/components/paper/DownloadLink";
import { changelogEntries } from "@/data/milestones";
import { fetchReleases } from "@/lib/releases";
import { pageMetadata } from "@/lib/pageMeta";
import { PhotoHead, PhotoPage, enterDelay } from "@/site/dia/PhotoPage";

export const metadata: Metadata = pageMetadata({
  path: "/releases",
  title: "Unvibe Changelog: What Shipped",
  absolute: true,
  description: "Every Unvibe release and product change, newest first, with the date of each update for Mac and Windows.",
});

export const revalidate = 300;

/** The changelog on the "pricing image" template (Design 2055 §5): newest first, each entry a white card. */
export default async function ReleasesPage() {
  const { releases, error } = await fetchReleases();
  const latest = releases[0];

  return (
    <PhotoPage photo="changelog" labelledBy="releases-h">
      <PhotoHead>
        <p className="dg__eyebrow">Changelog</p>
        <h1 id="releases-h" data-d-hero-rise="h1">What shipped.</h1>
        <p className="dg__lead" data-d-enter="" style={enterDelay(120)}>
          {latest
            ? `${latest.name.replace(/[—–]/g, ",")} is the newest build on GitHub.`
            : error
              ? "GitHub release data is temporarily unavailable."
              : "Product and company notes, newest first."}
        </p>
        <div className="dg__actions" data-d-enter="" style={enterDelay(200)}>
          <DownloadRow surface="releases" />
        </div>
      </PhotoHead>
      <section className="dg-log" aria-label="Release notes">
        <ChangelogList items={changelogEntries()} expanded={12} arrive />
      </section>
    </PhotoPage>
  );
}
