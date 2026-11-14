import type { Metadata } from "next";
import Link from "next/link";
import { Vibe } from "@/components/paper/Vibe";
import { BETA_WINDOWS_INSTALL_COMMAND } from "@/lib/betaOffer";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { pageMetadata } from "@/lib/pageMeta";
import { HELP_SHOTS, HelpShot } from "../HelpShot";
import "../help.css";

export const metadata: Metadata = pageMetadata({
  path: "/help/windows-protected-your-pc",
  title: "\u201cWindows protected your PC\u201d: how to open Unvibe on Windows",
  absolute: true,
  description:
    "Microsoft Defender SmartScreen says Windows protected your PC and prevented an unrecognized app from starting. Press More info, then Run anyway. What to do when the Run anyway button is missing, and what Smart App Control changes.",
});

/**
 * The search landing for Windows's first-open block. The dialog strings are QA's captures of the released 0.1.49
 * downloads (agents/unvibe-qa 2026-11-04 p0-gatekeeper, 2026-11-06 install-matrix, on Windows Server runners; the
 * SmartScreen dialog is the same one consumer Windows shows). Smart App Control facts are Microsoft's FAQ, linked.
 * Spec: boss-handoff agents/unvibe-support/specs/first-open-help-pages.md.
 */
export default function WindowsProtectedYourPcPage() {
  return (
    <article className="fos-page">
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">Help</p>
          <h1>&ldquo;Windows protected your PC&rdquo; when opening Unvibe.</h1>
          <p className="fos-page__lead">
            The first time you run the Unvibe download, a blue box says &ldquo;Microsoft Defender SmartScreen prevented an unrecognized
            app from starting.&rdquo; It shows because Unvibe is new and not yet signed with a paid certificate. Two presses get past it,
            and a PowerShell line installs without it.
          </p>
          <p className="fos__note">
            Applies to every Unvibe download so far: none is signed with a certificate yet. The pictures are from the 0.1.49 portable
            .exe.
          </p>
        </div>
      </header>

      <section className="verify" aria-labelledby="run-title">
        <h2 id="run-title">Press More info, then Run anyway</h2>
        <ol className="help-list">
          <li>
            If your browser warns about the download first, keep it. In Edge, press <b>…</b> next to the download, then <b>Keep</b>,
            then <b>Show more</b>, then <b>Keep anyway</b>.
          </li>
          <li>
            Run the file. In the &ldquo;Windows protected your PC&rdquo; box, press <b>More info</b>. The link is small, under the text.
            <div className="help-shots">
              <HelpShot {...HELP_SHOTS.smartScreen} caption="Real screen, Windows" />
            </div>
          </li>
          <li>
            The box now shows the file name (App: Unvibe-…-win-x64-portable.exe) and &ldquo;Publisher: Unknown publisher&rdquo;. Press{" "}
            <b>Run anyway</b>.
            <div className="help-shots">
              <HelpShot {...HELP_SHOTS.runAnyway} caption="Real screen, Windows" />
            </div>
          </li>
          <li>Unvibe opens and stays in your taskbar. That is the sign it worked. Later versions install from inside the app.</li>
        </ol>
      </section>

      <section className="verify" aria-labelledby="powershell-title">
        <h2 id="powershell-title">Or one PowerShell line</h2>
        <p>
          Open PowerShell (press the Windows key, type PowerShell, press Enter), paste this line and press Enter. It downloads
          Unvibe, installs it and opens it, with no SmartScreen box.
        </p>
        <pre>{BETA_WINDOWS_INSTALL_COMMAND}</pre>
        <p>
          Read the script before you run it: it&apos;s public, and <Link href="/install-help">Install help</Link> shows where.
        </p>
      </section>

      <section className="verify" aria-labelledby="missing-title">
        <h2 id="missing-title">No Run anyway button</h2>
        <ul className="help-list">
          <li>
            <b>Work or school PC.</b> An administrator can remove the button. Email us and we&apos;ll help.
          </li>
          <li>
            <b>Smart App Control is on (Windows 11).</b> Email us first and we&apos;ll help. Microsoft&apos;s{" "}
            <a href="https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions" rel="noopener noreferrer">
              Smart App Control FAQ
            </a>{" "}
            says it blocks an unsigned app when its security service can&apos;t vouch for it, that there is currently no way to allow a single app, and that Smart App Control can be
            turned off in the Windows Security app&apos;s settings; recent Windows updates let it be turned back on later without
            reinstalling Windows. Turning it off is your call: it stops checking every app, not just Unvibe.
          </li>
        </ul>
      </section>

      <p className="fos-page__help">
        Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Unvibe%20Windows%20install`}>{SUPPORT_EMAIL}</a> with a
        screenshot and your Windows version. All the install steps for Mac and Windows: <Link href="/install-help">Install help</Link>.
        Last checked with Unvibe 0.1.49.
      </p>
    </article>
  );
}
