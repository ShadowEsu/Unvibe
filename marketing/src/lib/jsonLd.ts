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
  name: "Unvibe",
  url: SITE_URL,
};
