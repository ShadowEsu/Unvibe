import type { MetadataRoute } from "next";
import { EXPLAIN_PATHS } from "@/lib/explainPages";
import { USE_CASE_PATHS } from "@/lib/useCases";
import { SITE_URL } from "@/lib/siteUrl";

/** No lastModified: the build time on every URL told search engines nothing (each build changed all of them). */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/beta", "/code-explainer-mac", "/code-explainer-windows", ...USE_CASE_PATHS, "/why", "/faq", "/resources", "/build", "/pricing", "/releases", "/install-help", "/help", "/help/shortcut", "/help/accessibility", "/investors", "/about", "/privacy", "/terms", "/refund", "/data-controls", "/account-deletion", "/listed-on", ...EXPLAIN_PATHS];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.5,
  }));
}
