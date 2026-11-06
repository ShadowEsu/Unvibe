import type { Metadata } from "next";
import { OG_CARDS, pageMetadata } from "@/lib/pageMeta";
import { Download } from "@/site/Download";

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/beta",
    card: OG_CARDS.beta,
    title: "Download Unvibe: Free Code Explainer for Mac and Windows",
    absolute: true,
    description: "Download Unvibe free for Mac (Apple silicon and Intel) and Windows 10 or 11 (x64). No API key, no credit card.",
  }),
  robots: { index: true, follow: true },
};

export default function BetaDownloadsPage() {
  return <Download />;
}
