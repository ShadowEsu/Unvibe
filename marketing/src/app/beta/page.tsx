import type { Metadata } from "next";
import Image from "next/image";
import { Monitor, ShieldCheck } from "lucide-react";
import { BetaDownloadAccess } from "@/components/BetaDownloadAccess";

export const metadata: Metadata = {
  title: "Private beta downloads",
  description: "Private beta downloads for Unvibe.",
  robots: { index: false, follow: false },
};

export default function BetaDownloadsPage() {
  return (
    <main className="beta-download-page">
      <section className="beta-download-panel">
        <div className="beta-download-brand"><Image src="/brand/icon.png" alt="Unvibe" width={52} height={52} priority /><div><p className="pixel-label">UNVIBE / PRIVATE BETA</p><h1>Install Unvibe and start with one selection.</h1></div></div>
        <p className="beta-download-intro">Your beta build includes the full desktop learning flow. Unvibe only analyzes code you explicitly select.</p>
        <div className="beta-download-preview">
          <Image
            src="/product-shots/onboarding-dark.png"
            alt="Unvibe onboarding screen in dark mode"
            width={3024}
            height={1774}
            sizes="(max-width: 760px) 100vw, 680px"
          />
        </div>
        <BetaDownloadAccess />
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
