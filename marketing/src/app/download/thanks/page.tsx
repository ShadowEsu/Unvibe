import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Logo } from "@/components/Logo";
import { DownloadThanks } from "@/components/paper/DownloadThanks";
import { THANKS_PATH } from "@/lib/downloadThanks";
import { thanksOs } from "@/lib/downloadTracking";
import { OG_CARDS, pageMetadata } from "@/lib/pageMeta";
import { visitorInstallOs } from "@/lib/shortcuts";
import "./thanks.css";

// Reached from a download click, so it is never indexed and not in the sitemap.
export const metadata: Metadata = {
  ...pageMetadata({
    path: THANKS_PATH,
    title: "Thanks for downloading Unvibe",
    absolute: true,
    description: "Open the download and approve Unvibe the first time, on a Mac or a Windows PC.",
    card: OG_CARDS.beta,
  }),
  robots: { index: false, follow: false },
};

/**
 * Only the product mark, the next steps and one footer line: the Nav and Footer stay off this path.
 * Rendered per request so the first paint already shows the visitor's system: the allowlisted
 * `?os=` (MUST-TD2), else the user agent, exactly as the client decides it.
 */
export default function DownloadThanksPage({ searchParams }: { searchParams: { os?: string | string[] } }) {
  const asked = thanksOs(typeof searchParams.os === "string" ? searchParams.os : null);
  const initialOs = asked === "other" ? visitorInstallOs(headers().get("user-agent") ?? "") : asked;
  return (
    <div className="thanks-page">
      <div className="thanks-page__top">
        <Link href="/" aria-label="Unvibe home" className="thanks-page__mark">
          <Logo size={24} />
        </Link>
      </div>
      <DownloadThanks initialOs={initialOs} />
      <p className="thanks-page__foot">
        © {new Date().getFullYear()} Unvibe · <Link className="thanks__link" href="/privacy">Privacy</Link>
      </p>
    </div>
  );
}
