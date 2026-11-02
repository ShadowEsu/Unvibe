import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { DownloadThanks } from "@/components/paper/DownloadThanks";
import { THANKS_PATH } from "@/lib/downloadThanks";
import { OG_CARDS, pageMetadata } from "@/lib/pageMeta";
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

/** Only the product mark, the next steps and one footer line: the Nav and Footer stay off this path. */
export default function DownloadThanksPage() {
  return (
    <div className="thanks-page">
      <div className="thanks-page__top">
        <Link href="/" aria-label="Unvibe home" className="thanks-page__mark">
          <Logo size={24} />
        </Link>
      </div>
      <DownloadThanks />
      <p className="thanks-page__foot">
        © {new Date().getFullYear()} Unvibe · <Link className="thanks__link" href="/privacy">Privacy</Link>
      </p>
    </div>
  );
}
