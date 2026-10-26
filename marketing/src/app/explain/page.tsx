import type { Metadata } from "next";
import Link from "next/link";
import { TryIt } from "@/components/paper/TryIt";
import { ExplainDownload } from "@/components/paper/ExplainParts";
import { explainLanguage, explainPages } from "@/lib/explainPages";
import { explainMono } from "./mono";
import "./explain.css";

const title = "Explain code in plain English, free";
const description =
  "Paste up to 60 lines of code and Vibe explains what it does in plain English, at the depth you pick. Free in your browser, no account.";

const image = "/unvibe-social-preview-v6.png";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/explain" },
  openGraph: { type: "website", url: "/explain", title, description, siteName: "Unvibe", locale: "en_US", images: [{ url: image, width: 1200, height: 630, alt: title }] },
  twitter: { card: "summary_large_image", title, description, images: [image] },
};

export default function ExplainIndexPage() {
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <header className="explain-head">
        <h1>Explain code in plain English</h1>
        <p>Paste up to 60 lines, pick a depth and Vibe tells you what the code does. Free, no account.</p>
      </header>

      <section aria-label="Try it">
        <TryIt answerSurface="explain_answer" errorSurface="explain_try" emailHref="/#email-link" />
      </section>

      <section className="explain-card" aria-labelledby="explain-langs-title">
        <h2 id="explain-langs-title">Explain code by language</h2>
        <p>Each page starts with a real sample to explain, then notes on what it shows.</p>
        <ul className="explain-langs">
          {explainPages.map((page) => (
            <li key={page.id}>
              <Link href={`/explain/${page.id}`}>Explain {explainLanguage(page).name} code</Link>
              <span>{page.sampleSummary}</span>
            </li>
          ))}
        </ul>
      </section>

      <ExplainDownload />
    </article>
  );
}
