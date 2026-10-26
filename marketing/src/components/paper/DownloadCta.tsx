import { DownloadRow } from "@/components/paper/DownloadLink";
import { InviteReveal } from "@/components/paper/InviteReveal";
import { Vibe } from "@/components/paper/Vibe";
import { BETA_INSTALL_VERSION } from "@/lib/betaOffer";
import { SHORTCUTS } from "@/lib/shortcuts";

/** Closing call to action on the homepage. Replaces the old waitlist form. */
export function DownloadCta() {
  return (
    <InviteReveal>
      <div className="paper-invite__card paper-glass">
        <div className="paper-invite__vibe" aria-hidden="true"><Vibe size={64} /></div>
        <p className="paper-meta">Free during the beta</p>
        <h2>Download <em>Unvibe.</em></h2>
        <p className="paper-lead">
          Mac (Apple silicon or Intel) and Windows. No API key and no credit card.
          Select code, press {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows), and keep what you ship.
        </p>
        <DownloadRow surface="home_cta" />
        <p className="paper-caption mt-4">
          {BETA_INSTALL_VERSION} · <a href="/beta" className="paper-text-link">Install steps and requirements</a>
        </p>
      </div>
    </InviteReveal>
  );
}
