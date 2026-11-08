import type { Metadata } from "next";
import { explainLanguage, type ExplainPage } from "@/lib/explainPages";

/**
 * Link-preview cards: static 1200x630 PNGs in public/og. The home card (also every page's default) is the live
 * hero's look, ledger 570 option B: bubbles, the H1, the free pill and the shortcuts inside a 600x600 centre box so
 * square and 2:1 crops keep them; the real debounce sample and the real 0.1.49 panel explaining it bleed off the
 * edges (render script and checks: boss-handoff agents/unvibe-site/og-570). The other
 * product cards are Design's option B "Flow" (27 Oct; agents/design/unvibe-link-preview-2026-10-27/final-b).
 * Names carry the first 8 hex of the file's sha256, so a new card never hides behind a cached one.
 * A card shows a panel only next to the exact code it explains: language cards show only their
 * page's own sample.
 */
export const OG_CARD_SIZE = { width: 1200, height: 630 } as const;

export type OgCard = { file: string; alt: string };

const FREE = "Free for Mac and Windows.";

export const OG_CARDS = {
  home: { file: "/og/og-home-14aee211.png", alt: `Understand the code your AI writes. ${FREE}` },
  beta: { file: "/og/og-beta-7d194b93.png", alt: `Download Unvibe. ${FREE}` },
  pricing: { file: "/og/og-pricing-9f940be2.png", alt: `Start free. No card needed. ${FREE}` },
  mac: { file: "/og/og-mac-c241a9bf.png", alt: `A code explainer for your Mac. ${FREE}` },
  windows: { file: "/og/og-windows-1d3f1db8.png", alt: `A code explainer for Windows. ${FREE}` },
  explain: { file: "/og/og-explain-8fbfbcab.png", alt: `Explain code in plain English. ${FREE}` },
  why: { file: "/og/og-why-953485f6.png", alt: "Nobody read the code. Why I'm building Unvibe, a founder's note with four sourced numbers." },
} as const satisfies Record<string, OgCard>;

/** Each language page's own card, by page id. */
export const EXPLAIN_CARD_FILES: Readonly<Record<string, string>> = {
  python: "/og/og-explain-python-674f8424.png",
  "pyproject-toml": "/og/og-explain-pyproject-toml-74c55e43.png",
  "requirements-txt": "/og/og-explain-requirements-txt-b6403942.png",
  javascript: "/og/og-explain-javascript-f8878f58.png",
  typescript: "/og/og-explain-typescript-9328f8c2.png",
  sql: "/og/og-explain-sql-0d9df631.png",
  graphql: "/og/og-explain-graphql-6bd3229b.png",
  "git-log": "/og/og-explain-git-log-a16206ef.png",
  bash: "/og/og-explain-bash-f04ec8df.png",
  powershell: "/og/og-explain-powershell-c4ef5527.png",
  curl: "/og/og-explain-curl-d7836fd3.png",
  bashrc: "/og/og-explain-bashrc-17882b99.png",
  chmod: "/og/og-explain-chmod-8db5af98.png",
  find: "/og/og-explain-find-aded3f37.png",
  c: "/og/og-explain-c-fbf7085c.png",
  cpp: "/og/og-explain-cpp-91334837.png",
  swift: "/og/og-explain-swift-4c89d84c.png",
  ruby: "/og/og-explain-ruby-6ea2946f.png",
  sqlite: "/og/og-explain-sqlite-816164d8.png",
  java: "/og/og-explain-java-dbded452.png",
  cron: "/og/og-explain-cron-c15c15c1.png",
  html: "/og/og-explain-html-2d46f438.png",
  css: "/og/og-explain-css-a1736dc1.png",
  xml: "/og/og-explain-xml-789f5b88.png",
  markdown: "/og/og-explain-markdown-263d3173.png",
  go: "/og/og-explain-go-cf95e359.png",
  jquery: "/og/og-explain-jquery-ff3aa78e.png",
  rust: "/og/og-explain-rust-42bddce3.png",
  csharp: "/og/og-explain-csharp-9e33a411.png",
  kotlin: "/og/og-explain-kotlin-8d6079b3.png",
  tsconfig: "/og/og-explain-tsconfig-9d597468.png",
  "npm-scripts": "/og/og-explain-npm-scripts-82d6a85d.png",
  "eslint-config": "/og/og-explain-eslint-config-335e906e.png",
  regex: "/og/og-explain-regex-118d334c.png",
  dart: "/og/og-explain-dart-b66aa93c.png",
  zshrc: "/og/og-explain-zshrc-7f62def4.png",
  lua: "/og/og-explain-lua-a54ac404.png",
  yaml: "/og/og-explain-yaml-a1a67fe9.png",
  ini: "/og/og-explain-ini-d293613e.png",
  json: "/og/og-explain-json-995efaed.png",
  csv: "/og/og-explain-csv-514f7a62.png",
  env: "/og/og-explain-env-35024476.png",
  awk: "/og/og-explain-awk-2360d439.png",
  fish: "/og/og-explain-fish-1d1104c2.png",
  make: "/og/og-explain-make-34d992b1.png",
  gitignore: "/og/og-explain-gitignore-90ca6cdd.png",
  "ssh-config": "/og/og-explain-ssh-config-b6f8da39.png",
  perl: "/og/og-explain-perl-6a375c1e.png",
  sed: "/og/og-explain-sed-052acff4.png",
  grep: "/og/og-explain-grep-dae0ebb6.png",
  "git-diff": "/og/og-explain-git-diff-cbe86ac3.png",
  "react-useeffect": "/og/og-explain-react-useeffect-7ff74901.png",
  "python-traceback": "/og/og-explain-python-traceback-6de7a848.png",
  "package-lock": "/og/og-explain-package-lock-4f8f420b.png",
  "prisma-schema": "/og/og-explain-prisma-schema-43ac14a3.png",
  tailwind: "/og/og-explain-tailwind-ee327891.png",
  "sql-joins": "/og/og-explain-sql-joins-43a0484a.png",
  "supabase-rls": "/og/og-explain-supabase-rls-264a5997.png",
  "cors-error": "/og/og-explain-cors-error-eae48712.png",
  asyncio: "/og/og-explain-asyncio-fb6e0e21.png",
  tar: "/og/og-explain-tar-e922b08f.png",
  rsync: "/og/og-explain-rsync-bf6fe9bd.png",
  "git-rebase": "/og/og-explain-git-rebase-61755953.png",
  xargs: "/og/og-explain-xargs-f6d7bed7.png",
  "ps-aux": "/og/og-explain-ps-aux-440a0365.png",
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
