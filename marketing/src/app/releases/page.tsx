import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/Button";
import { DownloadButtons } from "@/components/DownloadButtons";
import {
  fetchReleases,
  parseReleaseBody,
  platformAssetsFor,
  type ReleaseNote,
} from "@/lib/releases";

export const metadata: Metadata = {
  title: "Releases",
  description:
    "Every Unvibe desktop release for Mac and Windows, with what changed and direct downloads.",
};

export const revalidate = 300;

export default async function ReleasesPage() {
  const { releases, error } = await fetchReleases();
  const [latest, ...older] = releases;

  return (
    <article className="container-page py-16 sm:py-24">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-2 text-fluid-sm text-fg-muted transition-colors hover:text-fg"
      >
        <ArrowLeft size={15} aria-hidden="true" /> Back to Unvibe
      </Link>

      <div className="max-w-2xl">
        <p className="mb-4 text-fluid-sm font-medium uppercase tracking-[0.18em] text-primary">
          Releases
        </p>
        <h1 className="text-balance text-fluid-3xl font-semibold text-fg">
          Every build, and what changed.
        </h1>
        <p className="mt-4 text-pretty text-fluid-lg leading-relaxed text-fg-muted">
          Unvibe ships as a native desktop app for Mac and Windows. This page always
          reflects what has actually been published — every release below links to real
          installers, straight from GitHub.
        </p>
      </div>

      {latest ? (
        <div className="mt-10 rounded-card border border-line bg-surface p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-pill bg-primary-soft px-3 py-1 text-fluid-sm font-medium text-primary">
              Latest
            </span>
            <h2 className="text-fluid-xl font-semibold text-fg">{latest.name}</h2>
            {latest.publishedAt && (
              <span className="text-fluid-sm text-fg-faint">
                {formatDate(latest.publishedAt)}
              </span>
            )}
          </div>
          <div className="mt-6">
            <DownloadButtons assets={platformAssetsFor(latest)} />
          </div>
          <p className="mt-4 text-center text-fluid-sm text-fg-faint">
            macOS builds are currently unsigned during beta — right-click the app and
            choose Open the first time. Windows builds are unsigned too, so SmartScreen
            may warn before you continue.
          </p>
        </div>
      ) : (
        <EmptyState hasError={Boolean(error)} />
      )}

      {releases.length > 0 && (
        <div className="mt-14 space-y-10">
          <h2 className="text-fluid-lg font-semibold text-fg">Release history</h2>
          {releases.map((release) => (
            <ReleaseCard key={release.tagName} release={release} isLatest={release === latest} />
          ))}
          {older.length === 0 && (
            <p className="text-fluid-sm text-fg-faint">
              This is the first release — more will show up here as they ship.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function ReleaseCard({ release, isLatest }: { release: ReleaseNote; isLatest: boolean }) {
  const blocks = parseReleaseBody(release.body);
  const assets = platformAssetsFor(release);
  const hasDownloads = Boolean(
    assets.macArm64 || assets.macIntel || assets.windowsInstaller || assets.windowsPortable
  );

  return (
    <div className="border-t border-line pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-fluid-base font-semibold text-fg">{release.name}</h3>
          {release.prerelease && (
            <span className="rounded-pill border border-orange/40 bg-orange/10 px-2.5 py-0.5 text-fluid-sm text-orange">
              Beta
            </span>
          )}
          {isLatest && (
            <span className="rounded-pill border border-primary/30 bg-primary-soft px-2.5 py-0.5 text-fluid-sm text-primary">
              Current
            </span>
          )}
        </div>
        {release.publishedAt && (
          <span className="text-fluid-sm text-fg-faint">{formatDate(release.publishedAt)}</span>
        )}
      </div>

      {blocks.length > 0 ? (
        <div className="mt-4 space-y-2 text-fluid-base leading-relaxed text-fg-muted">
          {blocks.map((block, i) =>
            block.type === "bullet" ? (
              <p key={i} className="relative pl-4">
                <span className="absolute left-0 text-fg-faint" aria-hidden="true">
                  &bull;
                </span>
                {block.text}
              </p>
            ) : (
              <p key={i}>{block.text}</p>
            )
          )}
        </div>
      ) : (
        <p className="mt-4 text-fluid-base text-fg-faint">No notes were attached to this release.</p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-4">
        {hasDownloads && <DownloadButtons assets={assets} size="sm" />}
        <a
          href={release.htmlUrl}
          className="inline-flex items-center gap-1.5 text-fluid-sm text-fg-muted transition-colors hover:text-fg"
        >
          View on GitHub <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

function EmptyState({ hasError }: { hasError: boolean }) {
  return (
    <div className="mt-10 rounded-card border border-line bg-surface-2/60 p-8 text-center">
      <h2 className="text-fluid-lg font-semibold text-fg">
        {hasError ? "Releases are temporarily unavailable" : "No public builds yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-fluid-base text-fg-muted">
        {hasError
          ? "We could not reach GitHub to load release history. Please refresh in a moment."
          : "Unvibe is still in private beta. Join the waitlist and we will email you the moment the first Mac and Windows builds are ready to download."}
      </p>
      <div className="mt-6 flex justify-center">
        <Button href="/#waitlist">Join the waitlist</Button>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
