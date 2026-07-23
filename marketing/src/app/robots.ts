import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unvibe.site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/waitlist", "/waitlist-admin", "/stats.html"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
