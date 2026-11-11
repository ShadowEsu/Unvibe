import type { Metadata } from "next";
import Link from "next/link";
import { ExplainDownload } from "@/components/paper/ExplainParts";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/jsonLd";
import { pageMetadata } from "@/lib/pageMeta";
import { SHORTCUTS } from "@/lib/shortcuts";
import { USE_CASES_INDEX, pathForUseCase, useCases } from "@/lib/useCases";
import { explainMono } from "../explain/mono";
import "../explain/explain.css";
import "../code-explainer.css";

export const metadata: Metadata = pageMetadata({
  path: USE_CASES_INDEX.path,
  title: USE_CASES_INDEX.title,
  absolute: true,
  description: USE_CASES_INDEX.description,
});

/** The three use-case pages, one line each, then the download. */
export default function UseCasesPage() {
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Use cases", path: USE_CASES_INDEX.path }])),
        }}
      />
      <div className="explain-head">
        <nav aria-label="Breadcrumb" className="explain-crumb">
          <Link href="/">Home</Link> <span aria-hidden="true">/</span> Use cases
        </nav>
        <h1>Unvibe use cases</h1>
        <p>
          Three times the code in front of you came from an AI tool or another person, and you need to understand it
          before you ship it. Each page has a worked example and advice you can use without installing anything.
        </p>
      </div>

      <section className="explain-card" aria-labelledby="use-cases-list">
        <h2 id="use-cases-list">Use cases</h2>
        <ul className="explain-langs">
          {useCases.map((entry) => (
            <li key={entry.slug}>
              <Link href={pathForUseCase(entry)}>{entry.name}</Link>
              <span>{entry.summary}</span>
            </li>
          ))}
        </ul>
        <p>
          In each one the Unvibe steps are the same: select the code, press {SHORTCUTS.mac.anywhere} on a Mac or{" "}
          {SHORTCUTS.windows.anywhere} on Windows, and read the explanation beside your editor.
        </p>
        <p>
          Want to try it first? <Link className="paper-text-link" href="/explain">Explain code in your browser</Link>.
          Setup, the five depths and shortcuts are on the <Link className="paper-text-link" href="/resources">resources page</Link>.
        </p>
      </section>

      <ExplainDownload surface="use_cases" />
    </article>
  );
}
