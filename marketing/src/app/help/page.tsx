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
  title: "Unvibe help: install, the shortcut, Accessibility and sign-in",
  absolute: true,
  description: `Stuck with Unvibe? Opening it the first time, ${mac.anywhere} doing nothing, the Mac Accessibility switch, signing in, and how to reach a person.`,
});

/** The help hub (HELP-GAPS G7): every /help, /support and /contact guess used to 404. One line per question, each to the page that answers it. */
export default function HelpIndexPage() {
  return (
    <article className="fos-page">
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">Help</p>
          <h1>What&apos;s stuck?</h1>
          <p className="fos-page__lead">Pick the question closest to yours. Each answer is a short page with the exact buttons to press.</p>
        </div>
      </header>

      <section className="verify" aria-labelledby="install-title">
        <h2 id="install-title">Installing and opening it</h2>
        <ul className="help-list">
          <li>
            <Link href="/install-help">Mac says &ldquo;Unvibe Not Opened&rdquo;, or Windows says &ldquo;Windows protected your PC&rdquo;</Link>.
            What to press the first time, and how to read the install scripts before you run them.
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
            <Link href="/help/accessibility">Allow Accessibility on a Mac</Link>, the one permission the shortcut needs, and what to do when
            it still says Not allowed yet.
          </li>
        </ul>
      </section>

      <section className="verify" aria-labelledby="account-title">
        <h2 id="account-title">Account and plans</h2>
        <ul className="help-list">
          <li>
            <Link href="/beta#help">Sign-in doesn&apos;t finish, or you&apos;d rather not sign in</Link>. Unvibe works without an account.
          </li>
          <li>
            <Link href="/faq">Free explanations, plans, privacy and your data</Link>.
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
