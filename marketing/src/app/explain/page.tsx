import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { TryIt } from "@/components/paper/TryIt";
import { ExplainDownload } from "@/components/paper/ExplainParts";
import { explainHeadingText, explainPages } from "@/lib/explainPages";
import { OG_CARDS, pageMetadata } from "@/lib/pageMeta";
import { explainMono } from "./mono";
import "./explain.css";

const title = "Explain code in plain English, free";
const description =
  "Paste code your AI wrote and Vibe explains what it does in plain English, so you can question it before you accept it. Free online, no account.";

export const metadata: Metadata = pageMetadata({ path: "/explain", title, description, card: OG_CARDS.explain });

/** A sample summary with `backticked` commands as code; each word of a command stays whole, so a flag like --oneline never breaks at its hyphens. */
function Summary({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code key={i}>
            {part.split(" ").map((word, j) => (
              <Fragment key={j}>
                {j > 0 && " "}
                <span>{word}</span>
              </Fragment>
            ))}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function ExplainIndexPage() {
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <div className="explain-head">
        <h1>Explain code in plain English</h1>
        <p>Your AI wrote it. You decide whether to accept it. Paste a snippet, pick a depth and Vibe tells you what the code does, and adds a &quot;Not sure:&quot; line when it&apos;s guessing. Free, no account.</p>
      </div>

      <section aria-label="Try it">
        <TryIt answerSurface="explain_answer" errorSurface="explain_try" emailHref="/beta#email-link" />
      </section>

      <section className="explain-card" aria-labelledby="explain-langs-title">
        <h2 id="explain-langs-title">Explain code by language</h2>
        <p>Each page starts with a real sample to explain, then what it shows and one thing to check before you trust code like it, found when we tried the sample.</p>
        <ul className="explain-langs">
          {explainPages.map((page) => (
            <li key={page.id}>
              <Link href={`/explain/${page.id}`}>Explain {explainHeadingText(page)}</Link>
              <span><Summary text={page.sampleSummary} /></span>
            </li>
          ))}
        </ul>
      </section>

      <ExplainDownload />
    </article>
  );
}
