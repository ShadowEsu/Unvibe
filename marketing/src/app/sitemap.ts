import type { MetadataRoute } from "next";
import { EXPLAIN_PATHS, explainPages } from "@/lib/explainPages";
import { USE_CASE_PATHS } from "@/lib/useCases";
import { SITE_URL } from "@/lib/siteUrl";

/**
 * lastModified only where a real date exists: each /explain page carries the day it went live (`published`), bumped
 * when its content changes. Never the build time, which changed every URL on every deploy and told search engines
 * nothing. The static routes have no date yet, so they get no lastModified.
 */
const EXPLAIN_PUBLISHED = new Map(explainPages.map((page) => [`/explain/${page.id}`, page.published]));

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/beta", "/code-explainer-mac", "/code-explainer-windows", ...USE_CASE_PATHS, "/faq", "/resources", "/build", "/pricing", "/releases", "/install-help", "/help", "/help/shortcut", "/help/accessibility", "/help/apple-could-not-verify", "/help/windows-protected-your-pc", "/investors", "/about", "/why", "/privacy", "/terms", "/refund", "/data-controls", "/account-deletion", "/listed-on", ...EXPLAIN_PATHS];
  return routes.map((route) => {
    const published = EXPLAIN_PUBLISHED.get(route);
    return {
      url: `${SITE_URL}${route}`,
      ...(published ? { lastModified: published } : {}),
      changeFrequency: route === "" ? "weekly" : "monthly",
      priority: route === "" ? 1 : 0.5,
    };
  });
}
