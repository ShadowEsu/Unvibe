import type { Metadata } from "next";

/**
 * Link-preview cards: static 1200x630 PNGs in public/og, drawn by Design (option B "Flow", Preston
 * 27 Oct). Names carry a content hash so a new card never hides behind a cached old one.
 * A card shows a panel only next to the exact code it explains.
 */
export const OG_CARD_SIZE = { width: 1200, height: 630 } as const;

export type OgCard = { file: string; alt: string };

const FREE = "Free for Mac and Windows.";

export const OG_CARDS = {
  home: { file: "/og/og-home.png", alt: `Understand the code your AI just wrote. ${FREE}` },
  explainSql: { file: "/og/og-explain-sql.png", alt: `Explain SQL code in plain English. ${FREE}` },
  explainBash: { file: "/og/og-explain-bash.png", alt: `Explain Bash code in plain English. ${FREE}` },
} as const satisfies Record<string, OgCard>;

/** The card for /explain/<id>: that language's own sample, or the home card until it has one. */
export function explainCard(id: string): OgCard {
  if (id === "sql") return OG_CARDS.explainSql;
  if (id === "bash") return OG_CARDS.explainBash;
  return OG_CARDS.home;
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
