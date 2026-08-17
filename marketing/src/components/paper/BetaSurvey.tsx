"use client";

import { track } from "@/lib/analytics";
import { BETA_SURVEY_URL } from "@/lib/betaOffer";

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
          Finish it for 1 week of Pro. Gifts still add on.
        </p>
        <a
          className="paper-join paper-join--mac mt-8"
          href={BETA_SURVEY_URL}
          target="_blank"
          rel="noreferrer"
          onClick={() => track("survey_opened", { source: "section" })}
        >
          Open the survey
        </a>
      </div>
    </section>
  );
}
