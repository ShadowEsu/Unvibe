"use client";

import { recordBetaSiteEvent, track } from "@/lib/analytics";
import { BETA_FEEDBACK_URL } from "@/lib/betaOffer";

/**
 * The feedback ask, at the end of /beta: after the download and the fixes, not inside the download
 * card before anyone has the app (Design W12).
 */
export function BetaFeedbackAsk() {
  return (
    <div className="beta-page__feedback">
      <p>After you try it, tell us what clicked and what didn&apos;t.</p>
      <a
        className="paper-text-link"
        href={BETA_FEEDBACK_URL}
        target="_blank"
        rel="noreferrer"
        onClick={() => {
          track("survey_opened", { source: "beta_bottom" });
          track("feedback_opened", { source: "beta_bottom" });
          recordBetaSiteEvent("survey");
        }}
      >
        Tell us how the install went
      </a>
    </div>
  );
}
