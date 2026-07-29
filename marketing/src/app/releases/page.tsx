import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { DownloadButtons } from "@/components/DownloadButtons";
import { milestones } from "@/data/milestones";
import { fetchReleases, platformAssetsFor } from "@/lib/releases";

export const metadata: Metadata = {
  title: "Releases",
  description: "Unvibe product releases and company milestones.",
};

export const revalidate = 300;

export default async function ReleasesPage() {
  const { releases, error } = await fetchReleases();
  const latest = releases[0];

  return (
    <article className="releases-page">
      <header className="container-page launch-subpage__hero">
        <p className="launch-label">Release record</p>
        <h1>Every meaningful<br />step forward.</h1>
        <p>
          Product builds and company milestones in one place. Published installers
          still come directly from GitHub.
        </p>
      </header>

      <section className="container-page releases-latest">
        <div>
          <p className="launch-label">Latest beta</p>
          <h2>{latest?.name ?? "Private beta in progress"}</h2>
          <p>
            {latest
              ? "The most recent published desktop build, with direct platform downloads."
              : error
                ? "GitHub release data is temporarily unavailable."
                : "The next signed beta build is being prepared."}
          </p>
        </div>
        {latest ? (
          <div>
            <DownloadButtons assets={platformAssetsFor(latest)} />
            <a href={latest.htmlUrl} target="_blank" rel="noopener noreferrer">
              View release notes <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          <a href="/#waitlist" className="releases-join">Join the waitlist</a>
        )}
      </section>

      <section className="container-page releases-timeline">
        {milestones.map((item) => (
          <article key={`${item.date}-${item.title}`}>
            <div>
              <time>{item.date}</time>
              <span>{item.category}</span>
            </div>
            <div>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
            </div>
          </article>
        ))}
      </section>
    </article>
  );
}
