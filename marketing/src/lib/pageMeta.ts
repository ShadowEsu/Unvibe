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
  home: { file: "/og/og-home-5d097d09.png", alt: `Understand the code your AI just wrote. ${FREE}` },
  beta: { file: "/og/og-beta-7d194b93.png", alt: `Download Unvibe. ${FREE}` },
  pricing: { file: "/og/og-pricing-9f940be2.png", alt: `Start free. No card needed. ${FREE}` },
  mac: { file: "/og/og-mac-c241a9bf.png", alt: `A code explainer for your Mac. ${FREE}` },
  windows: { file: "/og/og-windows-1d3f1db8.png", alt: `A code explainer for Windows. ${FREE}` },
  explain: { file: "/og/og-explain-8fbfbcab.png", alt: `Explain code in plain English. ${FREE}` },
} as const satisfies Record<string, OgCard>;

/** Each language page's own card, by page id. */
export const EXPLAIN_CARD_FILES: Readonly<Record<string, string>> = {
  python: "/og/og-explain-python-674f8424.png",
  javascript: "/og/og-explain-javascript-f8878f58.png",
  typescript: "/og/og-explain-typescript-9328f8c2.png",
  sql: "/og/og-explain-sql-0d9df631.png",
  bash: "/og/og-explain-bash-f04ec8df.png",
  c: "/og/og-explain-c-fbf7085c.png",
  cpp: "/og/og-explain-cpp-91334837.png",
  swift: "/og/og-explain-swift-4c89d84c.png",
  ruby: "/og/og-explain-ruby-6ea2946f.png",
  java: "/og/og-explain-java-dbded452.png",
  html: "/og/og-explain-html-2d46f438.png",
  css: "/og/og-explain-css-a1736dc1.png",
  go: "/og/og-explain-go-cf95e359.png",
  rust: "/og/og-explain-rust-42bddce3.png",
  csharp: "/og/og-explain-csharp-9e33a411.png",
  kotlin: "/og/og-explain-kotlin-8d6079b3.png",
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
