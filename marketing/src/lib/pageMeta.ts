import type { Metadata } from "next";
import { explainLanguage, type ExplainPage } from "@/lib/explainPages";

/**
 * Link-preview cards: static 1200x630 PNGs in public/og, drawn by Design (option B "Flow", Preston
 * 27 Oct; source and alt text in boss-handoff agents/design/unvibe-link-preview-2026-10-27/final-b).
 * Names carry the first 8 hex of the file's sha256, so a new card never hides behind a cached one.
 * A card shows a panel only next to the exact code it explains: language cards show only their
 * page's own sample.
 */
export const OG_CARD_SIZE = { width: 1200, height: 630 } as const;

export type OgCard = { file: string; alt: string };

const FREE = "Free for Mac and Windows.";

export const OG_CARDS = {
  home: { file: "/og/og-home-d1b32625.png", alt: `Understand the code your AI just wrote. ${FREE}` },
  beta: { file: "/og/og-beta-d543983c.png", alt: `Download Unvibe. ${FREE}` },
  pricing: { file: "/og/og-pricing-75d30607.png", alt: `Start free. No card needed. ${FREE}` },
  mac: { file: "/og/og-mac-fcfb9c77.png", alt: `A code explainer for your Mac. ${FREE}` },
  windows: { file: "/og/og-windows-bb36c9a6.png", alt: `A code explainer for Windows. ${FREE}` },
  explain: { file: "/og/og-explain-59fccaef.png", alt: `Explain code in plain English. ${FREE}` },
} as const satisfies Record<string, OgCard>;

/** Each language page's own card, by page id. */
export const EXPLAIN_CARD_FILES: Readonly<Record<string, string>> = {
  python: "/og/og-explain-python-de920420.png",
  javascript: "/og/og-explain-javascript-2fa7e1ba.png",
  typescript: "/og/og-explain-typescript-18f9ebfc.png",
  sql: "/og/og-explain-sql-163abe78.png",
  bash: "/og/og-explain-bash-027ac2d6.png",
  c: "/og/og-explain-c-444b75ab.png",
  cpp: "/og/og-explain-cpp-492dd686.png",
  swift: "/og/og-explain-swift-87b426d0.png",
  ruby: "/og/og-explain-ruby-08d11955.png",
  java: "/og/og-explain-java-b0447d64.png",
  html: "/og/og-explain-html-764acaa4.png",
  css: "/og/og-explain-css-8c2ce2de.png",
  go: "/og/og-explain-go-02a02a72.png",
  rust: "/og/og-explain-rust-892230ef.png",
  csharp: "/og/og-explain-csharp-847efa88.png",
  kotlin: "/og/og-explain-kotlin-7ecb2596.png",
};

/** The card for /explain/<id>: that language's own sample, or the generic /explain card if it has none yet. */
export function explainCard(page: ExplainPage): OgCard {
  const file = EXPLAIN_CARD_FILES[page.id];
  if (!file) return OG_CARDS.explain;
  return { file, alt: `Explain ${explainLanguage(page).name} code in plain English. ${FREE}` };
}

/**
 * A page's search and link-preview tags from one place: canonical, og:url, og:image and the
 * Twitter/X large card always agree, and all of them are paths on metadataBase (SITE_URL, a
 * build-time constant), never anything taken from the request.
 *
 * `title` is the page's own title; `absolute` skips the layout's "%s · Unvibe" template, and the
 * preview title follows the same rule so it matches the browser tab.
 */
export function pageMetadata({
  path,
  title,
  absolute = false,
  description,
  card = OG_CARDS.home,
}: {
  path: string;
  title: string;
  absolute?: boolean;
  description: string;
  card?: OgCard;
}): Metadata {
  const shownTitle = absolute ? title : `${title} · Unvibe`;
  return {
    title: absolute ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title: shownTitle,
      description,
      siteName: "Unvibe",
      locale: "en_US",
      images: [{ url: card.file, ...OG_CARD_SIZE, alt: card.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: shownTitle,
      description,
      images: [{ url: card.file, alt: card.alt }],
    },
  };
}
