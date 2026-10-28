import type { Metadata } from "next";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { Reveal } from "@/components/redesign/Reveal";
import { SHORTCUTS } from "@/lib/shortcuts";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/beta",
    title: "Download Unvibe: Free Code Explainer for Mac and Windows",
    absolute: true,
    description: "Download Unvibe free for Mac (Apple silicon and Intel) and Windows 10 or 11 (x64). No API key, no credit card.",
  }),
  robots: { index: true, follow: true },
};

const { mac, windows } = SHORTCUTS;

export default function BetaDownloadsPage() {
  return (
    <article className="beta-page">
      <header className="paper-photo-band paper-photo-band--short">
        <img src="/hero/golden-gate-band-1600.webp" srcSet="/hero/golden-gate-band-800.webp 800w, /hero/golden-gate-band-1600.webp 1600w" sizes="100vw" alt="" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Free for Mac and Windows</p>
          <h1>Download <em>Unvibe.</em></h1>
          <p>Select code, press {mac.anywhere} ({windows.anywhere} on Windows), understand what you ship.</p>
        </div>
      </header>

      <section className="paper-section" id="install">
        <Reveal className="paper-wrap paper-center">
          {/* The band above already says "Free for Mac and Windows"; dropping the repeat keeps the download button on the first screen. */}
          <BetaInstall tone="page" surface="beta" title={null} showFeedback />
        </Reveal>
      </section>

      <section className="paper-section">
        <Reveal className="paper-wrap">
          <div className="beta-page__steps paper-glass">
            <h2>Get started in <em>three steps.</em></h2>
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
                    On Windows, keep the download if your browser warns, then run the portable .exe. If you see
                    “Windows protected your PC”, choose <b>More info</b>, then <b>Run anyway</b>.{" "}
                    <a className="paper-text-link" href="/install-help">Show me how</a>
                  </p>
                </div>
              </li>
              <li>
                <span className="beta-page__step-badge">2</span>
                <div>
                  <strong>On Mac, allow Accessibility when prompted</strong>
                  <p>
                    {`This lets Unvibe read the code you select. It does not watch your keystrokes or record your screen.`}
                  </p>
                </div>
              </li>
              <li>
                <span className="beta-page__step-badge">3</span>
                <div>
                  <strong>Select code and press {mac.anywhere} ({windows.anywhere} on Windows)</strong>
                  <p>
                    {`A panel opens beside your editor and the explanation streams in. Ask a follow-up, take Test me, or save it to your Library.`}
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
          <h2 className="mt-3">Stuck? <em>Quick fixes.</em></h2>
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
              <summary>macOS won’t open Unvibe the first time</summary>
              <p>
                Unvibe is not notarized by Apple yet, so macOS blocks the first open. Do this once:
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
                <a className="paper-text-link" href="mailto:hello@unvibe.site?subject=Unvibe%20Windows%20install">hello@unvibe.site</a>
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
                Skip sign-in on the first screen and you get 50 free explanations in your first 30 days. Signing in gives you a free allowance every month, syncs your history across devices, and starts a new account with a free month of Pro.
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
              <p>Keys and tokens in your code are filtered on your device before it is sent. Your repo is never uploaded.</p>
            </div>
            <div className="beta-page__trust-item">
              <MonitorIcon />
              <p>Need help? <a className="paper-text-link" href="mailto:hello@unvibe.site?subject=Unvibe%20help">Email us</a></p>
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
