import type { Metadata } from "next";
import { BetaFeedbackAsk } from "@/components/paper/BetaFeedbackAsk";
import { Download } from "@/site/dia/Download";
import { DiaMotion } from "@/site/dia/motion/DiaMotion";
import { FREE_MONTHLY_ALLOWANCE, TRIAL_ALLOWANCE } from "@/lib/allowance";
import { MAC_SHA256_URL, WINDOWS_META, WINDOWS_SHA256_URL } from "@/lib/downloadMeta";
import { SHORTCUTS } from "@/lib/shortcuts";
import { OG_CARDS, pageMetadata } from "@/lib/pageMeta";
import { proSentence } from "@/lib/proOffer";
import { AI_MAINTENANCE, AI_MAINTENANCE_NOTE } from "@/lib/aiMaintenance";

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/beta",
    card: OG_CARDS.beta,
    title: "Download Unvibe: Free Code Explainer for Mac and Windows",
    absolute: true,
    description: "Download Unvibe free for Mac (Apple silicon and Intel) and Windows 10 or 11 (x64). No API key, no credit card.",
  }),
  robots: { index: true, follow: true },
};

const { mac, windows } = SHORTCUTS;

/**
 * Direction D's download page (plan mock 11) and the one-click download's thank-you state (?dl=). Below the fold,
 * the live guide, quick fixes and trust lines, unchanged.
 */
export default function BetaDownloadsPage() {
  return (
    <article className="d d-page dd-page beta-page">
      <DiaMotion />
      <Download />
      <p className="beta-page__lede paper-wrap paper-center">Select code, press {mac.anywhere} ({windows.anywhere} on Windows), understand what you ship.</p>

      <section className="paper-section">
        <div className="paper-wrap">
          <div className="beta-page__steps">
            <h2>Get started in 3 steps.</h2>
            <ol className="beta-page__steps-list">
              <li>
                <span className="beta-page__step-badge">1</span>
                <div>
                  <strong>Download and open Unvibe</strong>
                  <p>
                    On Mac, move Unvibe to Applications and open it. macOS blocks the first open: press <b>Done</b>,
                    then go to System Settings → Privacy &amp; Security, scroll down to Security, press <b>Open Anyway</b>, confirm, and enter
                    your Mac password.
                  </p>
                  <p>
                    On Windows: {WINDOWS_META} If your browser warns, choose <b>Keep</b>. If Windows says it protected
                    your PC, choose <b>More info</b>, then <b>Run anyway</b>.{" "}
                    <a className="paper-text-link" href="/install-help">Show me how</a>
                  </p>
                  <p>
                    Check your download against its SHA-256:{" "}
                    <a className="paper-text-link" href={MAC_SHA256_URL}>Mac</a>,{" "}
                    <a className="paper-text-link" href={WINDOWS_SHA256_URL}>Windows</a>.
                  </p>
                </div>
              </li>
              <li>
                <span className="beta-page__step-badge">2</span>
                <div>
                  <strong>Optional on Mac: turn on the shortcut</strong>
                  <p>
                    {`You can start by pasting code into Unvibe. To explain code you select in any app with the shortcut in step 3, allow Accessibility when macOS asks. This lets Unvibe read the code you select. It does not watch your keystrokes or record your screen.`}
                  </p>
                </div>
              </li>
              <li>
                <span className="beta-page__step-badge">3</span>
                <div>
                  <strong>Select code and press {mac.anywhere} ({windows.anywhere} on Windows)</strong>
                  <p>
                    {`A panel opens beside your editor and the explanation streams in. Ask a follow-up, take Test me, or save it to your Library. No shortcut yet? Paste code into Unvibe instead.`}
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* The no-warning option for Mac: /explain in the browser, installable as a web app (src/app/manifest.ts).
          Menu labels from Google's, Microsoft's and Apple's help pages (Chrome 9658361, Edge, Apple 104996). */}
      <section className="paper-section" id="browser" aria-labelledby="browser-h">
        <div className="paper-wrap">
          <div className="beta-page__steps">
            <h2 id="browser-h">No install warning: use Unvibe in your browser</h2>
            <ul className="beta-page__steps-list">
              <li>
                <div>
                  <strong>Paste code, get a short explanation</strong>
                  <p>
                    Open unvibe.site/explain in Chrome or Safari, paste code and get a short explanation in plain English.
                    Nothing to download, so macOS shows no warning.{" "}
                    <a className="paper-text-link" href="/explain?utm_source=webapp">Open it in your browser</a>
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>Keep it in its own window</strong>
                  <p>
                    In Chrome, press <b>Install</b> at the right of the address bar, or open the menu and choose <b>Cast, save, and
                    share</b>, then <b>Install page as app</b>. In Edge, open the menu and choose <b>More tools</b>, then <b>Apps</b>,
                    then <b>Install this site as an app</b>. In Safari on macOS Sonoma or later, choose <b>File</b>, then <b>Add to Dock</b>.
                  </p>
                </div>
              </li>
              <li>
                <div>
                  <strong>What it can’t do</strong>
                  <p>
                    It works on code you paste, up to 1,500 characters (about 60 lines). It can’t read code in other apps or use
                    the {mac.anywhere} shortcut, and it explains up to 6 snippets an hour.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="paper-section" id="help">
        <div className="paper-wrap paper-center">
          <h2>Stuck? Quick fixes.</h2>
          <div className="paper-faq mt-8">
            <details>
              <summary>The app says “Waiting for Google sign-in…”</summary>
              <p>
                Unvibe opened a sign-in page in your browser (press <strong>Open browser</strong> in Unvibe if you closed it). If
                Google sign-in didn’t finish there, use email on the same page:
              </p>
              <ol>
                <li>Tick both boxes.</li>
                <li>Type your email and press <strong>Email me a secure <span style={{ whiteSpace: "nowrap" }}>sign-in</span> link</strong>.</li>
                {/* The sender lives in Supabase's SMTP settings, not this repo: re-check it here whenever SMTP changes. */}
                <li>Open the email from Unvibe (no-reply@unvibe.site) and its link in that same browser on this computer. Check your Spam folder if the sign-in email doesn’t arrive.</li>
                <li>Back on the page, check the code matches the one in the app (type it in if the box is empty).</li>
                <li>Press <strong style={{ whiteSpace: "nowrap" }}>Approve sign-in</strong>. The app finishes a few seconds later.</li>
              </ol>
              <p>
                A link opened on your phone or in another browser won’t sign you in. If no browser opened, go to{" "}
                {/* In running text: not the section's inline-block, margin-topped .paper-text-link (paper.css .paper-center). */}
                <a className="paper-text-link" style={{ display: "inline", marginTop: 0, fontSize: "inherit", textDecoration: "underline", textUnderlineOffset: "0.18em" }} href="https://api.unvibe.site/activate">api.unvibe.site/activate</a>,
                sign in, and type the code shown in the app. Codes expire after 10 minutes, so restart sign-in if it has been a while.
              </p>
            </details>
            <details>
              <summary>macOS won’t open Unvibe the first time</summary>
              <p>
                Unvibe is not verified by Apple yet, so macOS blocks the first open. Do this once:
              </p>
              <ol>
                <li>Press <strong>Done</strong> on the warning.</li>
                <li>Open System Settings, click Privacy &amp; Security, and scroll down to Security.</li>
                <li>Press <strong>Open Anyway</strong>, then confirm when macOS asks again.</li>
                <li>Enter your Mac password, then press <strong>OK</strong>.</li>
              </ol>
              <p>
                The Open Anyway button stays for about an hour after you try to open Unvibe. If it’s gone, open Unvibe
                again first. On macOS 14 or older, you can instead Control-click (right-click) Unvibe in Applications,
                choose <strong>Open</strong>, then press <strong>Open</strong> again.
              </p>
            </details>
            <details>
              <summary>Your browser warns about the Windows download</summary>
              <p>
                In Edge, press <strong>…</strong> next to the download, then <strong>Keep</strong>, then
                {" "}<strong>Show more</strong>, then <strong>Keep anyway</strong>. Chrome also lets you keep a file after it warns.
              </p>
            </details>
            <details>
              <summary>Windows shows “Windows protected your PC”</summary>
              <p>
                The Windows build is not code-signed yet, so SmartScreen warns about it. Click <strong>More info</strong>, then
                {" "}<strong>Run anyway</strong>. Only do this for the file downloaded from unvibe.site or our GitHub releases.
              </p>
              <p>
                No Run anyway button? Work and school PCs can remove it. If Smart App Control is turned on (Windows 11), it
                blocks unsigned apps like Unvibe and can’t make an exception for one app. Email{" "}
                <a className="paper-text-link" href="mailto:support@unvibe.site?subject=Unvibe%20Windows%20install">support@unvibe.site</a>
                {" "}and we’ll help.
              </p>
            </details>
            <details>
              <summary>The shortcut does nothing</summary>
              <p>
                The shortcut that works in every app is {mac.anywhere} on Mac and {windows.anywhere} on Windows. On Mac, turn on
                Unvibe in System Settings → Privacy &amp; Security → Accessibility. {mac.editor} ({windows.editor} on Windows) only works in
                Cursor and VS Code after you install the editor bridge from Unvibe’s Settings, Integrations. If another
                app already uses the shortcut, change it in Unvibe’s Settings.
              </p>
            </details>
            <details>
              <summary>You can start without signing in</summary>
              <p>
                Unvibe works without an account, and you get {TRIAL_ALLOWANCE}. Signing in gives you {FREE_MONTHLY_ALLOWANCE} on Free and syncs your history across devices: click your name (or initials) at the bottom of Unvibe’s sidebar, then <strong>Sign in to sync</strong> and <strong>Continue with Google</strong>. The page that opens in your browser also lets you sign in with email. {proSentence()}
              </p>
              {AI_MAINTENANCE ? <p role="status">{AI_MAINTENANCE_NOTE}</p> : null}
            </details>
          </div>
        </div>
      </section>

      <section className="paper-section">
        <div className="paper-wrap paper-center">
          <div className="beta-page__trust">
            <div className="beta-page__trust-item">
              <ShieldIcon />
              <p>Unvibe checks your code for keys and tokens on your device and stops a known key before anything is sent. Your repo is never uploaded.</p>
            </div>
            <div className="beta-page__trust-item">
              <MonitorIcon />
              <p>Need help? <a className="paper-text-link" href="mailto:support@unvibe.site?subject=Unvibe%20help">Email us</a></p>
            </div>
          </div>
          <BetaFeedbackAsk />
        </div>
      </section>
    </article>
  );
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l7.5 3.75v5.25c0 4.97-3.33 9.16-7.5 10.5-4.17-1.34-7.5-5.53-7.5-10.5V6.75L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
