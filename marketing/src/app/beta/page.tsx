import type { Metadata } from "next";
import Image from "next/image";
import { Monitor, ShieldCheck } from "lucide-react";
import { BetaInstall } from "@/components/paper/BetaInstall";

export const metadata: Metadata = {
  title: "Unvibe release updates",
  description: "Get verified Unvibe release updates for macOS and Windows.",
};

export default function BetaDownloadsPage() {
  return (
    <main className="beta-download-page">
      <section className="beta-download-panel">
        <div className="beta-download-brand"><Image src="/brand/icon.png" alt="Unvibe" width={52} height={52} priority /><div><p className="pixel-label">UNVIBE / PUBLIC BETA</p><h1>Download Unvibe.</h1></div></div>
        <p className="beta-download-intro">Mac and Windows public beta downloads are available below. These builds are unsigned while platform signing and Windows sign-in verification continue. Unvibe only analyzes code you explicitly select.</p>
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
          <li><b>1</b><span><strong>Join release updates</strong><small>We will publish verified availability when platform checks pass.</small></span></li>
          <li><b>2</b><span><strong>Verify your platform</strong><small>Mac requires a notarized build; Windows requires a signed installer and clean-machine sign-in test.</small></span></li>
          <li><b>3</b><span><strong>Install when invited</strong><small>The verified build will guide you through permissions and your first selected-code explanation.</small></span></li>
        </ol>
        <p className="beta-download-note"><ShieldCheck size={16} /> Your selected code is secret-filtered on your device before cloud analysis.</p>
        <p className="beta-download-support"><Monitor size={16} /> Need help installing? <a href="mailto:preston@unvibe.site?subject=Unvibe%20download%20help">Email Preston</a>.</p>
      </section>
    </main>
  );
}
