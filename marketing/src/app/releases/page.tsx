import type { Metadata } from "next";
import { ChangelogList } from "@/components/paper/ChangelogList";
import { JoinWaitlistRow } from "@/components/paper/JoinWaitlistLink";
import { changelogEntries } from "@/data/milestones";
import { fetchReleases } from "@/lib/releases";

export const metadata: Metadata = {
  title: "Change Log",
  description: "Unvibe product change log and company milestones.",
};

export const revalidate = 300;

export default async function ReleasesPage() {
  const { releases, error } = await fetchReleases();
  const latest = releases[0];

  return (
    <article className="releases-page">
      <header className="paper-photo-band">
        <img src="/hero/golden-gate.png" alt="" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Change log</p>
          <h1>What shipped.</h1>
          <p>
            {latest
              ? `${latest.name.replace(/[—–]/g, ",")} is the newest GitHub build. Join the waitlist for an invite.`
              : error
                ? "GitHub release data is temporarily unavailable."
                : "Product and company notes, newest first."}
          </p>
          <JoinWaitlistRow href="/#waitlist" />
        </div>
      </header>

      <section className="paper-section">
        <div className="paper-wrap paper-log-wrap paper-glass">
          <ChangelogList items={changelogEntries()} />
        </div>
      </section>
    </article>
  );
}
