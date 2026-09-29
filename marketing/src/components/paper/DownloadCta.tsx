import { DownloadRow } from "@/components/paper/DownloadLink";
import { BETA_INSTALL_VERSION } from "@/lib/betaOffer";

/** Closing call to action on the homepage. Replaces the old waitlist form. */
export function DownloadCta() {
  return (
    <div className="paper-invite is-lit">
      <div className="paper-invite__card paper-glass">
        <p className="paper-meta">Free during the beta</p>
        <h2>Download Unvibe.</h2>
        <p className="paper-lead">
          Mac (Apple silicon) and Windows. No API key and no credit card.
          Select code, press {"⌘"}U, and keep what you ship.
        </p>
        <DownloadRow href="/beta" />
        <p className="paper-caption mt-4">
          {BETA_INSTALL_VERSION} · <a href="/beta" className="paper-text-link">Install steps and requirements</a>
        </p>
      </div>
    </div>
  );
}
