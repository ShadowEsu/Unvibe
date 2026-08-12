import { ArrowRight, Play } from "lucide-react";

/** A focused conversion path for phones, where the header CTA is in the menu. */
export function MobileBetaCta() {
  return (
    <>
      <div className="mobile-beta-cta" aria-label="Private beta actions">
        <a href="#how-it-works"><Play size={15} aria-hidden="true" /> See demo</a>
        <a href="#waitlist">Join beta <ArrowRight size={15} aria-hidden="true" /></a>
      </div>
      <div className="mobile-beta-cta-spacer" aria-hidden="true" />
    </>
  );
}
