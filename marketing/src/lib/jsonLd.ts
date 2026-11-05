import { SITE_URL } from "./siteUrl";

/**
 * JSON for a `<script type="application/ld+json">` body. Every `<` becomes `\u003c`, which JSON reads back
 * as the same character, so no value (an FAQ answer, a site URL from the environment) can close the
 * script tag and start markup of its own.
 */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** A page's place in the site, matching its visible breadcrumb. Paths are site-relative ("/explain"). */
export function breadcrumbJsonLd(crumbs: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map(({ name, path }, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name,
      item: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    })),
  };
}

/** The site itself, for the homepage. No SearchAction: the site has no search results URL. */
export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "Unvibe",
  url: SITE_URL,
  inLanguage: "en",
  publisher: { "@id": `${SITE_URL}/#org` },
};

/**
 * Questions and answers that are visible on the same page, word for word. Google no longer shows FAQ
 * rich results (May 2026); this is for every other reader of the page, AI assistants included.
 */
export function faqPageJsonLd(items: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

/** Steps that are visible on the same page, in order. */
export function howToJsonLd(name: string, steps: readonly { name: string; text: string; image?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    tool: { "@type": "HowToTool", name: "Unvibe for Mac or Windows" },
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image ? { image: step.image.startsWith("/") ? `${SITE_URL}${step.image}` : step.image } : {}),
    })),
  };
}
