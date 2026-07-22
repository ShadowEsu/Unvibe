import type { Metadata } from "next";
import { Download, Monitor, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Private beta downloads",
  description: "Private beta downloads for Unvibe.",
  robots: { index: false, follow: false },
};

const macDownload = process.env.NEXT_PUBLIC_BETA_MAC_DOWNLOAD_URL?.trim();
const windowsDownload = process.env.NEXT_PUBLIC_BETA_WINDOWS_DOWNLOAD_URL?.trim();

function DownloadCard({ platform, href, detail }: { platform: string; href?: string; detail: string }) {
  const content = <><Download size={22} /><span><strong>{platform}</strong><small>{detail}</small></span></>;
  return href ? <a className="beta-download" href={href}>{content}</a> : <div className="beta-download beta-download--disabled" aria-disabled="true">{content}<em>Coming shortly</em></div>;
}

export default function BetaDownloadsPage() {
  return (
    <main className="beta-download-page">
      <section className="beta-download-panel">
        <p className="pixel-label">UNVIBE / PRIVATE BETA</p>
        <h1>Learn the code you ship.</h1>
        <p className="beta-download-intro">The private beta includes normal Free features, up to 30 selected-code prompts, and 20 cloud AI explanations per month.</p>
        <div className="beta-download-grid">
          <DownloadCard platform="macOS · Apple Silicon" href={macDownload} detail="DMG · drag Unvibe to Applications" />
          <DownloadCard platform="Windows · 64-bit" href={windowsDownload} detail="Portable installer · Windows may ask for confirmation" />
        </div>
        <p className="beta-download-note"><ShieldCheck size={16} /> Your selected code is secret-filtered on your device before cloud analysis.</p>
        <p className="beta-download-support"><Monitor size={16} /> Need help installing? <a href="mailto:preston@unvibe.site?subject=Unvibe%20private%20beta%20help">Email Preston</a>.</p>
      </section>
    </main>
  );
}
