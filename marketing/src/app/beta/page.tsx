import type { Metadata } from "next";
import Image from "next/image";
import { Download, Monitor, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Private beta downloads",
  description: "Private beta downloads for Unvibe.",
  robots: { index: false, follow: false },
};

// The investor release storage is the single source of truth for private-beta artifacts.
// Keep the beta-only aliases for a deployment that needs a distinct access-controlled URL.
const macDownload = process.env.NEXT_PUBLIC_BETA_MAC_DOWNLOAD_URL?.trim()
  || process.env.NEXT_PUBLIC_INVESTOR_DMG_URL?.trim()
  || "https://github.com/ShadowEsu/Unvibe/releases/download/v0.1.4-feedback-rewards/Unvibe-0.1.4-feedback-rewards-arm64.zip";
const windowsDownload = process.env.NEXT_PUBLIC_BETA_WINDOWS_DOWNLOAD_URL?.trim()
  || process.env.NEXT_PUBLIC_INVESTOR_WINDOWS_DOWNLOAD_URL?.trim();
const zipDownload = process.env.NEXT_PUBLIC_INVESTOR_ZIP_URL?.trim();

function DownloadCard({ platform, href, detail }: { platform: string; href?: string; detail: string }) {
  const content = <><Download size={22} /><span><strong>{platform}</strong><small>{detail}</small></span></>;
  return href ? <a className="beta-download" href={href}>{content}</a> : <div className="beta-download beta-download--disabled" aria-disabled="true">{content}<em>Coming shortly</em></div>;
}

export default function BetaDownloadsPage() {
  return (
    <main className="beta-download-page">
      <section className="beta-download-panel">
        <div className="beta-download-brand"><Image src="/brand/icon.png" alt="Unvibe" width={52} height={52} priority /><div><p className="pixel-label">UNVIBE / PRIVATE BETA</p><h1>Install Unvibe and start with one selection.</h1></div></div>
        <p className="beta-download-intro">Your beta build includes the full desktop learning flow. Unvibe only analyzes code you explicitly select.</p>
        <div className="beta-download-grid">
          <DownloadCard platform="macOS · Apple Silicon" href={macDownload} detail="ZIP · move Unvibe to Applications" />
          <DownloadCard platform="Windows · 64-bit" href={windowsDownload} detail="Portable installer · Windows may ask for confirmation" />
          {zipDownload && <DownloadCard platform="macOS ZIP" href={zipDownload} detail="Unvibe private beta ZIP" />}
        </div>
        <ol className="beta-install-steps">
          <li><b>1</b><span><strong>Move Unvibe to Applications</strong><small>Open it once so macOS can register the desktop shortcut.</small></span></li>
          <li><b>2</b><span><strong>Allow Accessibility when prompted</strong><small>This lets Unvibe read only the code you actively select.</small></span></li>
          <li><b>3</b><span><strong>Select code and press ⌘U</strong><small>Your explanation starts automatically beside your work.</small></span></li>
        </ol>
        <p className="beta-download-note"><ShieldCheck size={16} /> Your selected code is secret-filtered on your device before cloud analysis.</p>
        <p className="beta-download-support"><Monitor size={16} /> Need help installing? <a href="mailto:preston@unvibe.site?subject=Unvibe%20private%20beta%20help">Email Preston</a>.</p>
      </section>
    </main>
  );
}
