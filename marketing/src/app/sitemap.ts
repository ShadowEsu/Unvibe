import type { MetadataRoute } from "next";
import { EXPLAIN_PATHS } from "@/lib/explainPages";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unvibe.site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["", "/beta", "/resources", "/build", "/pricing", "/releases", "/install-help", "/investors", "/about", "/privacy", "/terms", "/data-controls", "/account-deletion", ...EXPLAIN_PATHS];
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.5,
  }));
}
