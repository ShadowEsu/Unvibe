import type { Metadata } from "next";
import { Vibe } from "@/components/paper/Vibe";
import { WebSurveyForm } from "@/components/paper/WebSurveyForm";
import "./survey.css";

// Linked only from our own PMF email, so it stays out of search and the sitemap (Security W4).
export const metadata: Metadata = {
  title: "One question about Unvibe",
  description: "One question about Unvibe, anonymous.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/survey" },
};

/**
 * The one-question PMF survey (lib/webSurvey.ts). Static: opening it stores nothing, starts no
 * analytics and isn't counted as a site load (analyticsPrivacy.ts PRIVATE_PATH, siteLoads.ts
 * SKIPPED_PATH). Only Send posts the answer.
 */
export default function SurveyPage() {
  return (
    <article className="fos-page survey-page">
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
        <p className="survey-fine">
          Anonymous: we don&apos;t ask for your name or email, and the link has nothing in it that says who you are.
          Don&apos;t include passwords, keys or other people&apos;s personal details in the comment.{" "}
          <a href="/privacy">Privacy</a>
        </p>
      </section>
    </article>
  );
}
