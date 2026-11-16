import type { Metadata } from "next";
import { Vibe } from "@/components/paper/Vibe";
import { REPLAY_BLOCK_CLASS } from "@/lib/analyticsPrivacy";
import { WebSurveyForm } from "@/components/paper/WebSurveyForm";
import "./survey.css";

// Linked only from our own PMF email, so it stays out of search and the sitemap (Security W4).
export const metadata: Metadata = {
  // Names the brand, so it skips the layout's "%s · Unvibe" (check:canonicals: no title says Unvibe twice).
  title: { absolute: "One question about Unvibe" },
  description: "One question about Unvibe, anonymous.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/survey" },
};

/**
 * The one-question PMF survey (lib/webSurvey.ts). Static: opening it stores nothing, starts no
 * analytics, sends no visit beacon and isn't counted as a site load (analyticsPrivacy.ts PRIVATE_PATH,
 * visitBeacon.ts, siteLoads.ts SKIPPED_PATH). Only Send posts the answer. Like the other private
 * pages, its content is left out of any session replay still running from a client navigation.
 */
export default function SurveyPage() {
  return (
    <article className={`fos-page survey-page ${REPLAY_BLOCK_CLASS}`}>
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">One question</p>
          <h1>How&apos;s Unvibe working for you?</h1>
          <p className="fos-page__lead">
            Pick the answer that fits and press Send. Nothing is recorded until you press Send.
          </p>
        </div>
      </header>

      <section className="verify">
        <WebSurveyForm />
      </section>
    </article>
  );
}
