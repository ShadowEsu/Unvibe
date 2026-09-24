import type { Metadata } from "next";
import Image from "next/image";
import { Monitor, ShieldCheck } from "lucide-react";
import { BetaInstall } from "@/components/paper/BetaInstall";

export const metadata: Metadata = {
  title: "Download Unvibe",
  description: "Download the Unvibe public beta for macOS or Windows.",
};

export default function BetaDownloadsPage() {
  return (
    <main className="beta-download-page">
      <section className="beta-download-panel">
        <div className="beta-download-brand"><Image src="/brand/icon.png" alt="Unvibe" width={52} height={52} priority /><div><p className="pixel-label">UNVIBE / PUBLIC BETA</p><h1>Download Unvibe and start with one selection.</h1></div></div>
        <p className="beta-download-intro">Choose macOS or Windows below. Your 30-day public-beta access includes 50 AI explanations and 50 selected-code reviews. Unvibe only analyzes code you explicitly select.</p>
        <div className="beta-download-preview">
          <Image
            src="/product/home-today.jpg"
            alt="Unvibe companion home in dark mode"
            width={1024}
            height={678}
            sizes="(max-width: 760px) 100vw, 680px"
          />
        </div>
        <BetaInstall tone="page" />
        <ol className="beta-install-steps">
          <li><b>1</b><span><strong>Open the download</strong><small>Move the Mac app to Applications, or run the Windows portable app.</small></span></li>
          <li><b>2</b><span><strong>Allow Accessibility when prompted</strong><small>This lets Unvibe read only the code you actively select.</small></span></li>
          <li><b>3</b><span><strong>Select code and press ⌘U or Ctrl+U</strong><small>Your explanation starts automatically beside your work.</small></span></li>
        </ol>
        <p className="beta-download-note"><ShieldCheck size={16} /> Your selected code is secret-filtered on your device before cloud analysis.</p>
        <p className="beta-download-support"><Monitor size={16} /> Need help installing? <a href="mailto:preston@unvibe.site?subject=Unvibe%20download%20help">Email Preston</a>.</p>
      </section>
    </main>
  );
}
