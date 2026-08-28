"use client";

import { recordBetaSiteEvent, track } from "@/lib/analytics";
import { BETA_FEEDBACK_URL } from "@/lib/betaOffer";

interface BetaSurveyProps {
  id?: string;
}

export function BetaSurvey({ id = "survey" }: BetaSurveyProps) {
  return (
    <section className="paper-section" id={id}>
      <div className="paper-wrap paper-center">
        <p className="paper-meta">Beta survey</p>
        <h2 className="mt-3">After 30 explanations, a short survey.</h2>
        <p className="paper-lead mt-4">
          Finish the survey for 1 week of Pro, free. Gifts still add on.
        </p>
        <a
          className="paper-beta__survey paper-beta__survey--ink mt-8"
          href={BETA_FEEDBACK_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            track("survey_opened", { source: "section" });
            track("feedback_opened", { source: "section" });
            recordBetaSiteEvent("survey");
          }}
        >
          {BETA_FEEDBACK_URL}
        </a>
      </div>
    </section>
  );
}
