import type { Metadata } from "next";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { Reveal } from "@/components/redesign/Reveal";

export const metadata: Metadata = {
  title: "Download Unvibe for Mac and Windows",
  description: "Download the Unvibe private beta. 30 free AI code explanations. No API key, no credit card. Available for Mac (Apple Silicon) and Windows (x64).",
  robots: { index: true, follow: true },
};

export default function BetaDownloadsPage() {
  return (
    <article className="beta-page">
      <header className="paper-photo-band paper-photo-band--short">
        <img src="/hero/golden-gate.png" alt="" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Free during the beta</p>
          <h1>Download Unvibe.</h1>
          <p>Select code, press ⌘U, understand what you ship.</p>
        </div>
      </header>

      <section className="paper-section" id="install">
        <Reveal className="paper-wrap paper-center">
          <BetaInstall tone="page" showFeedback />
        </Reveal>
      </section>

      <section className="paper-section">
        <Reveal className="paper-wrap">
          <div className="beta-page__steps paper-glass">
            <h2>Get started in 3 steps</h2>
            <ol className="beta-page__steps-list">
              <li>
                <span className="beta-page__step-badge">1</span>
                <div>
                  <strong>Download and open Unvibe</strong>
                  <p>
                    {`On Mac, move Unvibe.app to Applications. On Windows, run the portable .exe.`}
                  </p>
                </div>
              </li>
              <li>
                <span className="beta-page__step-badge">2</span>
                <div>
                  <strong>Allow Accessibility when prompted</strong>
                  <p>
                    {`This lets Unvibe read the code you actively select — it does not watch your keystrokes or record your screen.`}
                  </p>
                </div>
              </li>
              <li>
                <span className="beta-page__step-badge">3</span>
                <div>
                  <strong>Select code and press ⌘U</strong>
                  <p>
                    {`Your explanation starts streaming beside your editor. Save it, quiz yourself, build understanding.`}
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </Reveal>
      </section>

      <section className="paper-section" id="help">
        <Reveal className="paper-wrap paper-center">
          <p className="paper-meta">Troubleshooting</p>
          <h2 className="mt-3">Stuck? Quick fixes.</h2>
          <div className="paper-faq mt-8">
            <details>
              <summary>The app says “Waiting for Google sign-in…”</summary>
              <p>
                Unvibe opened a sign-in page in your browser. Sign in with Google there, then click
                {" "}<strong>Connect this device</strong>. The app finishes a few seconds after that click, not after
                the Google step alone. If no browser opened, go to{" "}
                <a className="paper-text-link" href="https://api.unvibe.site/activate">api.unvibe.site/activate</a>,
                sign in, and type the code shown in the app. Codes expire after 10 minutes, so restart sign-in if it has been a while.
              </p>
            </details>
            <details>
              <summary>Windows shows “Windows protected your PC”</summary>
              <p>
                The beta is not code-signed yet, so SmartScreen warns about it. Click <strong>More info</strong>, then
                {" "}<strong>Run anyway</strong>. Only do this for the file downloaded from unvibe.site or our GitHub releases.
              </p>
            </details>
            <details>
              <summary>Ctrl+U or ⌘U does nothing</summary>
              <p>
                In Cursor and VS Code, install the Unvibe editor bridge from the app’s setup screen. In other apps, the
                shortcut is Control+U. On Mac, turn on Unvibe in System Settings → Privacy &amp; Security → Accessibility.
                If another app already uses the shortcut, change it in Unvibe’s Settings.
              </p>
            </details>
            <details>
              <summary>You can use it without signing in</summary>
              <p>
                Sign-in only syncs your history across devices. Skip it on the first screen and the free explanations still work.
              </p>
            </details>
          </div>
        </Reveal>
      </section>

      <section className="paper-section">
        <Reveal className="paper-wrap paper-center">
          <div className="beta-page__trust">
            <div className="beta-page__trust-item">
              <ShieldIcon />
              <p>Your code is secret-filtered on your device before any cloud analysis.</p>
            </div>
            <div className="beta-page__trust-item">
              <MonitorIcon />
              <p>Need help? <a href="mailto:preston@unvibe.site?subject=Unvibe%20private%20beta%20help">Email Preston</a></p>
            </div>
          </div>
        </Reveal>
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
