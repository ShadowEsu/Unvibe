import type { Metadata } from "next";
import { FirstOpenSteps } from "@/components/paper/FirstOpenSteps";
import { InstallHelpViewed } from "@/components/paper/InstallHelpViewed";
import { Vibe } from "@/components/paper/Vibe";
import { BETA_INSTALL_SCRIPT_SOURCE_URL, BETA_INSTALL_TAG } from "@/lib/betaInstallScript";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = pageMetadata({
  path: "/install-help",
  title: "Open Unvibe the First Time on Mac and Windows",
  absolute: true,
  description: "Mac says \"Unvibe Not Opened\"? Windows says \"Windows protected your PC\"? Here is exactly what to press the first time.",
});

export default function InstallHelpPage() {
  return (
    <article className="fos-page">
      <InstallHelpViewed />
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">Install help</p>
          <h1>Opening Unvibe <em>the first time.</em></h1>
          <p className="fos-page__lead">Unvibe is free and brand new, so Apple and Microsoft have not verified it yet. The first time you open the download, a Mac asks you to approve it in System Settings and Windows shows a blue warning. Here is exactly what to press, or paste one line and skip both.</p>
        </div>
      </header>
      <h2 className="sr-only">First-open steps for Mac and Windows</h2>
      <FirstOpenSteps surface="install_help" />
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
      <p className="fos-page__help">Still stuck? Email <a href="mailto:hello@unvibe.site?subject=Unvibe%20install%20help">hello@unvibe.site</a> with a screenshot and your Mac or Windows version.</p>
    </article>
  );
}
