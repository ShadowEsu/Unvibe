import type { Metadata } from "next";
import Link from "next/link";
import { Vibe } from "@/components/paper/Vibe";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { pageMetadata } from "@/lib/pageMeta";
import "../help.css";

export const metadata: Metadata = pageMetadata({
  path: "/help/waiting-for-google-sign-in",
  title: "\u201cWaiting for Google sign-in\u2026\u201d in Unvibe: how to finish signing in",
  absolute: true,
  description:
    "Unvibe says Waiting for Google sign-in\u2026 while you finish in your browser. Press Open browser or Copy link, use the email link if Google doesn\u2019t finish, then press Approve sign-in.",
});

/**
 * The search landing for the sign-in wait (support-queue Q1/Q3, BUGS F-12). Every app string is quoted from the
 * v0.1.51 tag: companion.tsx:358/363/369 (button, code line, Open browser / Copy link / Retry), main.ts:1801/1823
 * (timed out / no longer valid, 10-minute expiry at :1795), accountMenu.tsx:105 (email vs "Saved on this
 * computer"). Web strings are marketing/src/app/activate/page.tsx (Approve sign-in, You are connected, not
 * recognised). F-12 is not reproduced on 0.1.51, so the page gives ways through and never says "fixed".
 * Spec: boss-handoff agents/unvibe-support/specs/troubleshooting-queue-611.md.
 */
export default function WaitingForGoogleSignInPage() {
  return (
    <article className="fos-page">
      <header className="fos-page__head">
        <Vibe size={96} />
        <div>
          <p className="pstats__eyebrow">Help</p>
          <h1>Unvibe says &ldquo;Waiting for Google sign-in&hellip;&rdquo;</h1>
          <p className="fos-page__lead">
            Signing in happens in your browser, not in the app. Unvibe shows &ldquo;Waiting for Google sign-in&hellip;&rdquo; and a
            short code until you approve that code on the web page. Signing in is optional: Unvibe explains code without an account.
          </p>
        </div>
      </header>

      <section className="verify" aria-labelledby="says-title">
        <h2 id="says-title">What Unvibe shows</h2>
        <p>Under the sign-in button, Unvibe 0.1.51 shows one of these lines, with the code below it:</p>
        <pre>
          {"Finish in your browser. Check this code matches, then press Connect this device:\n"}
          {"Your browser did not open. Press Open browser, then check this code matches:"}
        </pre>
        <p>
          The button on the web page is called <b>Approve sign-in</b>. Find the case that matches yours below.
        </p>
      </section>

      <section className="verify" aria-labelledby="browser-title">
        <h2 id="browser-title">No browser page opened</h2>
        <ol className="help-list">
          <li>
            In Unvibe, under the code, press <b>Open browser</b>.
          </li>
          <li>
            If nothing opens, press <b>Copy link</b>, open your browser yourself, paste the link into the address bar and press Enter.
          </li>
          <li>
            On the page that opens, sign in, check the code matches the one in Unvibe, and press <b>Approve sign-in</b>.
          </li>
        </ol>
      </section>

      <section className="verify" aria-labelledby="google-title">
        <h2 id="google-title">Google sign-in didn&apos;t finish</h2>
        <p>Use email on the same web page instead:</p>
        <ol className="help-list">
          <li>Tick both boxes.</li>
          <li>
            Type your email and press <b>Email me a secure sign-in link</b>.
          </li>
          <li>
            Open the email from Unvibe (no-reply@unvibe.site) and its link in that same browser on this computer. Check your Spam folder
            if it doesn&apos;t arrive. A link opened on your phone or in another browser won&apos;t sign you in.
          </li>
          <li>Back on the page, check the code matches the one in Unvibe (type it in if the box is empty).</li>
          <li>
            Press <b>Approve sign-in</b>.
          </li>
        </ol>
      </section>

      <section className="verify" aria-labelledby="expired-title">
        <h2 id="expired-title">It&apos;s been more than 10 minutes</h2>
        <p>A sign-in code lasts 10 minutes. After that Unvibe says one of these:</p>
        <pre>
          {"Sign-in timed out. Use Retry to create a new secure link.\n"}
          {"This sign-in link is no longer valid. Use Retry to create a new one."}
        </pre>
        <p>
          Press <b>Retry</b> in Unvibe for a new code and link, then use the newest code on the web page. If the page says &ldquo;That code
          was not recognised&rdquo;, it has an older code: type in the one Unvibe shows now.
        </p>
      </section>

      <section className="verify" aria-labelledby="done-title">
        <h2 id="done-title">How you know it worked</h2>
        <p>
          The web page says <b>You are connected</b>. A few seconds later, Unvibe&apos;s account menu shows your email instead of
          &ldquo;Saved on this computer&rdquo;.
        </p>
      </section>

      <p className="fos-page__help">
        Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Unvibe%20sign-in`}>{SUPPORT_EMAIL}</a> with a screenshot of Unvibe and
        of the web page, your Unvibe version (bottom of Settings) and your Mac or Windows version. More help:{" "}
        <Link href="/help">all help pages</Link>. Written for Unvibe 0.1.51.
      </p>
    </article>
  );
}
