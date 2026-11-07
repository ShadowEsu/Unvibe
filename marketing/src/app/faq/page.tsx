import type { Metadata } from "next";
import Link from "next/link";
import { ExplainDownload } from "@/components/paper/ExplainParts";
import { faqCategories, faqItems } from "@/data/faq";
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/jsonLd";
import { pageMetadata } from "@/lib/pageMeta";
import { PRODUCT_SENTENCE } from "@/lib/productFacts";
import { explainMono } from "../explain/mono";
import "../explain/explain.css";
import "../code-explainer.css";

export const metadata: Metadata = pageMetadata({
  path: "/faq",
  title: "Unvibe FAQ: the AI-written code explainer for Mac and Windows",
  absolute: true,
  description:
    "What Unvibe is, which apps it works with, what it sends to the AI, the explanation depths, Free and Pro, Windows, and deleting your data.",
});

const categories = Object.keys(faqCategories) as (keyof typeof faqCategories)[];

/** Every question and answer, all visible, grouped as data/faq.ts groups them. The JSON-LD is the same text. */
export default function FaqPage() {
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }])) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqPageJsonLd(faqItems)) }} />
      <div className="explain-head">
        <nav aria-label="Breadcrumb" className="explain-crumb">
          <Link href="/">Home</Link> <span aria-hidden="true">/</span> FAQ
        </nav>
        <h1>Questions about Unvibe</h1>
        <p>{PRODUCT_SENTENCE} Here is every question people ask us, answered in full.</p>
        <p>
          This page and <a className="paper-text-link" href="/llms.txt">unvibe.site/llms.txt</a> are built so AI assistants can read them.
        </p>
      </div>

      {categories.map((category) => (
        <section key={category} className="explain-card" aria-labelledby={`faq-${category}`}>
          <h2 id={`faq-${category}`}>{faqCategories[category]}</h2>
          {faqItems
            .filter((item) => item.category === category)
            .map((item) => (
              <div key={item.id} id={item.id}>
                <h3 className="explain-faq__q">{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
        </section>
      ))}

      <ExplainDownload surface="faq" />
    </article>
  );
}
