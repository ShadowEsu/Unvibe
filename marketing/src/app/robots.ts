import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://unvibe.site";

/** Private or per-person surfaces: never crawled by anyone. */
const PRIVATE = ["/api/", "/waitlist", "/waitlist-admin", "/stats.html", "/s/"];

/**
 * AI assistants and their search crawlers, named so each one is welcome on purpose (ledger 500: "AI can
 * see us"). Search and citation: OAI-SearchBot (ChatGPT search), Claude-SearchBot, PerplexityBot.
 * Fetches a person asked for: ChatGPT-User, Claude-User, Perplexity-User. Model training and grounding,
 * allowed by choice so assistants know what Unvibe is: GPTBot, ClaudeBot, Google-Extended (Gemini),
 * Applebot-Extended. A crawler that matches a named group ignores the `*` group, so each repeats PRIVATE.
 */
const AI_CRAWLERS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: [...AI_CRAWLERS], allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
