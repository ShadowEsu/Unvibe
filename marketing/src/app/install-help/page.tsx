import type { Metadata } from "next";
import { FirstOpenSteps } from "@/components/paper/FirstOpenSteps";
import { Vibe } from "@/components/paper/Vibe";
import { BETA_INSTALL_SCRIPT_SOURCE_URL, BETA_INSTALL_TAG } from "@/lib/betaInstallScript";

export const metadata: Metadata = {
  title: "Install help",
  description: "How to open Unvibe the first time on Mac and Windows, and how to fix a download that will not open.",
};

export default function InstallHelpPage() {
  return (
    <article className="fos-page">
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">Install help</p>
          <h1>Opening Unvibe <em>the first time.</em></h1>
          <p className="fos-page__lead">Unvibe is free and brand new, so Apple and Microsoft have not verified it yet. That means one extra click the first time. Here is exactly what to press.</p>
        </div>
      </header>
      <h2 className="sr-only">First-open steps for Mac and Windows</h2>
      <FirstOpenSteps />
      <section className="verify" aria-labelledby="verify-title">
        <h2 id="verify-title">Read the script first</h2>
        <p>Read anything before it touches your computer. Everything is public:</p>
        <ul>
          <li><a href="/install.sh">The Mac install script</a> and <a href="/install.ps1">the Windows one</a>, exactly as served, and <a href={BETA_INSTALL_SCRIPT_SOURCE_URL}>their source on GitHub</a>. They download from GitHub, check the file, copy the app into place, and send one anonymous &apos;installed&apos; count to unvibe.site. Nothing else.</li>
          <li><a href="https://github.com/ShadowEsu/Unvibe/releases">Every release on GitHub</a>. The scripts install <a href={`https://github.com/ShadowEsu/Unvibe/releases/tag/${BETA_INSTALL_TAG}`}>{BETA_INSTALL_TAG}</a> and check it against its SHA-256 checksums (<a href={`https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}/SHA256SUMS-mac.txt`}>Mac</a>, <a href={`https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}/SHA256SUMS-windows.txt`}>Windows</a>).</li>
          <li>Both scripts stop before installing anything if the checksum list is missing or the download does not match it.</li>
        </ul>
        <p>To check a file you downloaded yourself:</p>
        <pre><code>{`# Mac
shasum -a 256 ~/Downloads/Unvibe-*.dmg
# Windows (PowerShell)
Get-FileHash $HOME\\Downloads\\Unvibe-*.exe -Algorithm SHA256`}</code></pre>
        <p>The number it prints should match the line for that file in the checksum list.</p>
      </section>
      <p className="fos-page__help">Still stuck? Email <a href="mailto:preston@unvibe.site?subject=Unvibe%20install%20help">preston@unvibe.site</a> with a screenshot and your Mac or Windows version. A real person answers.</p>
    </article>
  );
}
