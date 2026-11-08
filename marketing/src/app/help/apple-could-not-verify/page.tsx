import type { Metadata } from "next";
import Link from "next/link";
import { Vibe } from "@/components/paper/Vibe";
import { BETA_INSTALL_COMMAND } from "@/lib/betaOffer";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { pageMetadata } from "@/lib/pageMeta";
import { HELP_SHOTS, HelpShot } from "../HelpShot";
import "../help.css";

export const metadata: Metadata = pageMetadata({
  path: "/help/apple-could-not-verify",
  title: "\u201cApple could not verify Unvibe is free of malware\u201d: how to open Unvibe on a Mac",
  absolute: true,
  description:
    "macOS says \u201cUnvibe\u201d Not Opened and that Apple could not verify it. Press Done, then Open Anyway in System Settings \u203a Privacy & Security, or install with one Terminal line and skip the dialog.",
});

/**
 * The search landing for macOS's first-open block. Every dialog string is QA's capture of the released 0.1.49 DMG
 * on macOS 15 (agents/unvibe-qa 2026-11-04 p0-gatekeeper, 2026-11-06 install-matrix); the Open Anyway confirm and
 * password steps are Apple's description (mh40616, 102445), not something we captured, and the page says so.
 * Spec: boss-handoff agents/unvibe-support/specs/first-open-help-pages.md.
 */
export default function AppleCouldNotVerifyPage() {
  return (
    <article className="fos-page">
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">Help</p>
          <h1>&ldquo;Unvibe&rdquo; Not Opened: Apple could not verify it.</h1>
          <p className="fos-page__lead">
            The first time you open the Unvibe download, macOS shows a box that says &ldquo;Apple could not verify &lsquo;Unvibe&rsquo;
            is free of malware that may harm your Mac or compromise your privacy.&rdquo; Unvibe isn&apos;t notarized by Apple yet, so
            macOS can&apos;t check it. Here is what to press, and a way to install that never shows the box.
          </p>
        </div>
      </header>

      <section className="verify" aria-labelledby="already-title">
        <h2 id="already-title">macOS already said Not Opened? Open Anyway</h2>
        <ol className="help-list">
          <li>
            In the &ldquo;Unvibe&rdquo; Not Opened box, press <b>Done</b>, not Move to Trash.
            <div className="help-shots">
              <HelpShot {...HELP_SHOTS.notOpened} caption="Real screen, macOS 15" />
            </div>
          </li>
          <li>
            Open <b>System Settings</b>, click <b>Privacy &amp; Security</b>, and scroll down to <b>Security</b>. Unvibe is listed as
            &ldquo;blocked to protect your Mac&rdquo;. Press <b>Open Anyway</b>.
            <div className="help-shots">
              <HelpShot {...HELP_SHOTS.openAnyway} caption="Real screen, macOS 15" />
            </div>
          </li>
          <li>
            Apple&apos;s guide says the warning appears once more and you confirm it, then enter your Mac login password. The Open
            Anyway button &ldquo;is available for about an hour after you try to open the app&rdquo;, so if it&apos;s gone, open Unvibe
            from Applications again, then come back to Security.
          </li>
          <li>That&apos;s once: macOS saves Unvibe as an exception. Later versions install from inside the app.</li>
        </ol>
        <p>
          On macOS 14 or older, you can instead Control-click Unvibe in Applications, choose <b>Open</b>, then press <b>Open</b>{" "}
          again.
        </p>
      </section>

      <section className="verify" aria-labelledby="terminal-title">
        <h2 id="terminal-title">Not opened the download yet? One Terminal line, no box</h2>
        <p>
          Open Terminal (press Command+Space, type Terminal, press Return), paste this line and press Return. It downloads Unvibe,
          checks the file against the published SHA-256 and Unvibe&apos;s own signature, installs it and opens it. Downloads made this way
          carry no quarantine mark, so macOS never shows the box.
        </p>
        <pre>{BETA_INSTALL_COMMAND}</pre>
        <p>
          On an Intel Mac the line picks the Intel build for you. Read the script before you run it: it&apos;s public, and{" "}
          <Link href="/install-help">Install help</Link> shows where.
        </p>
      </section>

      <section className="verify" aria-labelledby="other-title">
        <h2 id="other-title">Other things macOS can say</h2>
        <ul className="help-list">
          <li>
            <b>&ldquo;Unvibe is damaged and can&apos;t be opened.&rdquo;</b> That was a bug in older downloads. Delete Unvibe from
            Applications, then install with the Terminal line above.
          </li>
          <li>
            <b>&ldquo;Apple cannot check it for malicious software&rdquo; or &ldquo;the developer cannot be verified&rdquo;.</b> Apple&apos;s older
            wording for the same block. Open Anyway works the same way.
          </li>
          <li>
            <b>No Open Anyway button, or the Security settings are greyed out.</b> Apple says these settings may not be available when
            a Mac is managed by a system administrator or IT department. Email us and we&apos;ll help.
          </li>
        </ul>
        <p>
          We can&apos;t tell you Unvibe is safe to override a warning for; nobody can on a dialog. What we can show is the code: both
          install scripts are readable, and the Terminal line verifies the download before anything runs.
        </p>
      </section>

      <p className="fos-page__help">
        Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Unvibe%20Mac%20install`}>{SUPPORT_EMAIL}</a> with a screenshot
        and your macOS version. All the install steps for Mac and Windows: <Link href="/install-help">Install help</Link>. Last
        checked with Unvibe 0.1.49 on macOS 15.
      </p>
    </article>
  );
}
