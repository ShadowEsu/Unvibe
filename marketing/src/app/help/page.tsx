import type { Metadata } from "next";
import Link from "next/link";
import { Vibe } from "@/components/paper/Vibe";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { pageMetadata } from "@/lib/pageMeta";
import { SHORTCUTS } from "@/lib/shortcuts";
import "./help.css";

const { mac, windows } = SHORTCUTS;

export const metadata: Metadata = pageMetadata({
  path: "/help",
  title: "Unvibe help: install, shortcut, Accessibility, sign-in",
  absolute: true,
  description: `Stuck with Unvibe? Opening it the first time, ${mac.anywhere} doing nothing, the Mac Accessibility switch, signing in, and how to reach us.`,
});

/** The help hub (HELP-GAPS G7): every /help guess used to 404. One line per question, each to the page that answers it. */
export default function HelpIndexPage() {
  return (
    <article className="fos-page">
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">Help</p>
          <h1>What&apos;s stuck?</h1>
          <p className="fos-page__lead">Pick the question closest to yours. Each one links to the page that answers it.</p>
        </div>
      </header>

      <section className="verify" aria-labelledby="install-title">
        <h2 id="install-title">Installing and opening it</h2>
        <ul className="help-list">
          <li>
            <Link href="/help/apple-could-not-verify">Mac says &ldquo;Unvibe Not Opened&rdquo; and Apple could not verify it</Link>. Press
            Done, then Open Anyway in Privacy &amp; Security.
          </li>
          <li>
            <Link href="/help/windows-protected-your-pc">Windows says &ldquo;Windows protected your PC&rdquo;</Link>. More info, then Run
            anyway, and what to do when that button is missing.
          </li>
          <li>
            <Link href="/install-help">All install steps</Link>, and how to read the install scripts before you run them.
          </li>
          <li>
            <Link href="/beta">Download Unvibe</Link> for Mac or Windows.
          </li>
        </ul>
      </section>

      <section className="verify" aria-labelledby="use-title">
        <h2 id="use-title">Using it</h2>
        <ul className="help-list">
          <li>
            <Link href="/help/shortcut">Nothing happens when I press {mac.anywhere}</Link> ({windows.anywhere} on Windows), or the panel
            opens without my code.
          </li>
          <li>
            <Link href="/help/accessibility">Allow Accessibility on a Mac</Link>, the switch the shortcut needs to copy your code, and what
            to do when it still says Not allowed yet.
          </li>
        </ul>
      </section>

      <section className="verify" aria-labelledby="account-title">
        <h2 id="account-title">Account and plans</h2>
        <ul className="help-list">
          <li>
            <Link href="/beta#help">Sign-in doesn&apos;t finish, or I&apos;d rather not sign in</Link>. Check your Spam folder if the
            sign-in email doesn&apos;t arrive. You can start without an account.
          </li>
          <li>
            <Link href="/faq">Free explanations, plans, privacy and your data</Link>.
          </li>
          <li>
            <Link href="/account-deletion">Delete your account and your data</Link>, from inside the app or by email.
          </li>
        </ul>
      </section>

      <p className="fos-page__help">
        Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Unvibe%20help`}>{SUPPORT_EMAIL}</a> with a screenshot, your Unvibe
        version (bottom of Settings) and your Mac or Windows version.
      </p>
    </article>
  );
}
