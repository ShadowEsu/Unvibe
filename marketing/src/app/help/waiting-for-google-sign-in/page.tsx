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
    "Unvibe says Waiting for Google sign-in\u2026 while you finish in your browser. Press Open browser or Copy link, sign in with the email link, then press Approve sign-in.",
});

/**
 * The search landing for the sign-in wait (support-queue Q1/Q3, BUGS F-12). Every app string is quoted from the
 * v0.1.51 tag: companion.tsx:358/363/369 (button, code line, Open browser / Copy link / Retry), main.ts:1801/1823
 * (timed out / no longer valid, 10-minute expiry at :1795; Retry reopens the browser at :1787), companion.tsx:656
 * and :2200 ("Signed in as", Saved on this Mac/PC → Syncing… → Synced). Web strings are the page the app opens,
 * web/app/activate/page.tsx (email first, Change, Approve sign-in, You are connected, not recognised) and
 * web/src/lib/oauthReturn.ts:8 (Sign-in did not finish.). F-12 is not reproduced on 0.1.51, so the page gives ways
 * through and never says "fixed". Spec: boss-handoff agents/unvibe-support/specs/troubleshooting-queue-611.md.
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
        <ul className="help-list">
          <li>&ldquo;Finish in your browser. Check this code matches, then press Connect this device:&rdquo;</li>
          <li>&ldquo;Your browser did not open. Press Open browser, then check this code matches:&rdquo;</li>
        </ul>
        <p>
          There is no Connect this device button: on the web page, press <b>Approve sign-in</b>. Find the case that matches yours below.
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
          <li>On the page that opens, sign in with the email steps below, then press <b>Approve sign-in</b>.</li>
        </ol>
      </section>

      <section className="verify" aria-labelledby="email-title">
        <h2 id="email-title">Sign in on the web page with email</h2>
        <ol className="help-list">
          <li>Tick both boxes.</li>
          <li>
            Type your email and press <b>Email me a secure sign-in link</b>.
          </li>
          {/* The sender lives in Supabase's SMTP settings, not this repo: re-check it here (and on /beta) whenever SMTP changes. */}
          <li>
            Open the email from Unvibe (no-reply@unvibe.site) and its link in that same browser on this computer. Check your Spam folder
            if it doesn&apos;t arrive. A link opened on your phone or in another browser won&apos;t sign you in.
          </li>
          <li>Back on the page, check the code matches the one in Unvibe (type it in if the box is empty).</li>
          <li>
            Press <b>Approve sign-in</b>.
          </li>
        </ol>
        <p style={{ marginTop: 12 }}>
          You can use <b>Continue with Google</b> instead. If the page then says &ldquo;Sign-in did not finish.&rdquo;, use the email
          steps above.
        </p>
      </section>

      <section className="verify" aria-labelledby="expired-title">
        <h2 id="expired-title">It&apos;s been more than 10 minutes</h2>
        <p>A sign-in code lasts 10 minutes. After that Unvibe says one of these:</p>
        <ul className="help-list">
          <li>&ldquo;Sign-in timed out. Use Retry to create a new secure link.&rdquo;</li>
          <li>&ldquo;This sign-in link is no longer valid. Use Retry to create a new one.&rdquo;</li>
        </ul>
        <p>
          Press <b>Retry</b> in Unvibe. It opens a new browser tab with the new code already filled in (if it doesn&apos;t, use Copy link
          as above). Use that tab and close the old
          one. If a page says &ldquo;That code was not recognised&rdquo;, it has an older code: press <b>Change</b> next to the code and
          type the one Unvibe shows now.
        </p>
      </section>

      <section className="verify" aria-labelledby="done-title">
        <h2 id="done-title">How you know it worked</h2>
        <p>
          The web page says <b>You are connected</b>. A few seconds later Unvibe leaves the sign-in screen (during setup it shows
          &ldquo;&#10003; Signed in as&rdquo; and your email), and the &ldquo;Saved on this Mac&rdquo; or &ldquo;Saved on this PC&rdquo; line in
          Unvibe&apos;s sidebar changes to &ldquo;Syncing&hellip;&rdquo;, then &ldquo;Synced&rdquo;.
        </p>
      </section>

      <p className="fos-page__help">
        Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Unvibe%20sign-in`}>{SUPPORT_EMAIL}</a> with a screenshot of Unvibe and
        of the web page, your Unvibe version (bottom of Settings) and your Mac or Windows version. Don&apos;t send us the sign-in code or
        link. More help: <Link href="/help">all help pages</Link>. Written for Unvibe 0.1.51.
      </p>
    </article>
  );
}
