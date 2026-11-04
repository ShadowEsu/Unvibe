import { InviteReveal } from "@/components/paper/InviteReveal";
import { Vibe } from "@/components/paper/Vibe";
import { SHORTCUTS } from "@/lib/shortcuts";
import { GlassPlate } from "@/components/glass/GlassPlate";

/**
 * Closing call to action on the homepage. It links to the download card at #install instead of
 * repeating it, so the page has one download card (Design gate, 31 Oct).
 */
export function DownloadCta() {
  return (
    <InviteReveal>
      <div className="paper-invite__card paper-glass">
        <GlassPlate />
        <div className="paper-invite__vibe" aria-hidden="true"><Vibe size={64} /></div>
        <p className="paper-meta">Free during the beta</p>
        <h2>Download <em>Unvibe.</em></h2>
        <p className="paper-lead">
          Mac (Apple silicon or Intel) and Windows. No API key and no credit card.
          Select code, press {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows), and keep what you ship.
        </p>
        <div className="paper-join-row">
          <a className="paper-join paper-join--mac" href="#install">
            <span className="paper-join__label">Go to the download</span>
          </a>
        </div>
      </div>
    </InviteReveal>
  );
}
