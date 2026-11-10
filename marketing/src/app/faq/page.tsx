import type { Metadata } from "next";
import { ChangelogHashOpen } from "@/components/paper/ChangelogHashOpen";
import { ExplainDownload } from "@/components/paper/ExplainParts";
import { faqCategories, faqItems } from "@/data/faq";
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/jsonLd";
import { pageMetadata } from "@/lib/pageMeta";
import { PRODUCT_SENTENCE } from "@/lib/productFacts";
import { PhotoHead, PhotoPage, enterDelay } from "@/site/dia/PhotoPage";

export const metadata: Metadata = pageMetadata({
  path: "/faq",
  title: "Unvibe FAQ: the AI-written code explainer for Mac and Windows",
  absolute: true,
  description:
    "What Unvibe is, which apps it works with, what it sends to the AI, the explanation depths, Free and Pro, Windows, and deleting your data.",
});

const categories = Object.keys(faqCategories) as (keyof typeof faqCategories)[];

/**
 * Every question and answer, grouped as data/faq.ts groups them, on the "pricing image" template (Design 2055 §6): one
 * white card per group with a disclosure list. The answers stay in the HTML when folded, and the JSON-LD is the same
 * text. /faq left the header nav for Investors (ledger 562) and stays linked from the footer.
 */
export default function FaqPage() {
  return (
    <PhotoPage photo="faq" labelledBy="faq-h">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }])) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqPageJsonLd(faqItems)) }} />
      <PhotoHead>
        <p className="dg__eyebrow">FAQ</p>
        <h1 id="faq-h" data-d-hero-rise="h1">Questions about Unvibe</h1>
        <p className="dg__lead" data-d-enter="" style={enterDelay(120)}>{PRODUCT_SENTENCE} Here is every question people ask us, answered in full.</p>
        <p className="dg__lead" data-d-enter="" style={enterDelay(200)}>
          This page and <a href="/llms.txt">unvibe.site/llms.txt</a> are built so AI assistants can read them.
        </p>
      </PhotoHead>

      {categories.map((category, i) => (
        <section key={category} className="dg__card" aria-labelledby={`faq-${category}`} {...(i > 0 ? { "data-d-enter": "" } : {})}>
          <h2 id={`faq-${category}`} {...(i > 0 ? { "data-d-ink": "" } : {})}>{faqCategories[category]}</h2>
          {faqItems
            .filter((item) => item.category === category)
            .map((item) => (
              <details key={item.id} id={item.id} className="dg-faq__item">
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
        </section>
      ))}

      <ExplainDownload surface="faq" />
      {/* /faq#<question-id> opens that question (the same hash handler as the changelog's month archive) */}
      <ChangelogHashOpen />
    </PhotoPage>
  );
}
