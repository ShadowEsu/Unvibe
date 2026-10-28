import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TryIt } from "@/components/paper/TryIt";
import { ExplainDownload, Prose } from "@/components/paper/ExplainParts";
import { explainLanguage, explainPages } from "@/lib/explainPages";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/jsonLd";
import { explainCard, pageMetadata } from "@/lib/pageMeta";
import { explainMono } from "../mono";
import "../explain.css";

interface Params {
  params: { id: string };
}

export const dynamicParams = false;

export function generateStaticParams(): Params["params"][] {
  return explainPages.map(({ id }) => ({ id }));
}

export function generateMetadata({ params }: Params): Metadata {
  const page = explainPages.find(({ id }) => id === params.id);
  if (!page) return {};
  return pageMetadata({
    path: `/explain/${page.id}`,
    title: `Explain ${explainLanguage(page).name} code in plain English`,
    description: page.description,
    // Link cards drawn from the page's own title, lead and sample; languages without one use the home card.
    card: explainCard(page.id),
  });
}

/** A search landing page: the Try it box with a checked sample first, then notes on that sample, then the app. */
export default function ExplainLanguagePage({ params }: Params) {
  const page = explainPages.find(({ id }) => id === params.id);
  if (!page) notFound();
  const { name } = explainLanguage(page);
  const others = explainPages.filter(({ id }) => id !== page.id);

  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbJsonLd([{ name: "Explain code", path: "/explain" }, { name, path: `/explain/${page.id}` }])),
        }}
      />
      <header className="explain-head">
        <nav aria-label="Breadcrumb" className="explain-crumb">
          <Link href="/explain">Explain code</Link> <span aria-hidden="true">/</span> {name}
        </nav>
        <h1>Explain {name} code</h1>
        <p>{page.lead}</p>
      </header>

      <section aria-label={`Try it with a ${name} sample`}>
        <TryIt
          sample={page.sample}
          fileName={page.fileName}
          answerSurface="explain_answer"
          errorSurface="explain_try"
          emailHref="/#email-link"
        />
      </section>

      <section className="explain-card" aria-labelledby="explain-shows-title">
        <h2 id="explain-shows-title">What this {name} sample shows</h2>
        <dl className="explain-shows">
          {page.shows.map(({ concept, text }) => (
            <div key={concept}>
              <dt>{concept}</dt>
              <dd><Prose text={text} /></dd>
            </div>
          ))}
        </dl>
        <h2>Good to know</h2>
        <ul className="explain-notes">
          {page.notes.map((note) => <li key={note}><Prose text={note} /></li>)}
        </ul>
        <p className="explain-watch"><b>Watch out:</b> <Prose text={page.watchOut} /></p>
      </section>

      <ExplainDownload language={name} />

      <nav className="explain-card explain-more" aria-labelledby="explain-more-title">
        <h2 id="explain-more-title">Explain code in another language</h2>
        <ul>
          {others.map((other) => (
            <li key={other.id}><Link href={`/explain/${other.id}`}>{explainLanguage(other).name}</Link></li>
          ))}
          <li><Link href="/explain">All languages</Link></li>
        </ul>
      </nav>
    </article>
  );
}
