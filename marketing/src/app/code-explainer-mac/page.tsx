import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DownloadLink } from "@/components/paper/DownloadLink";
import { MacBuildLinks } from "@/components/paper/BetaInstall";
import { faqItems } from "@/data/faq";
import { BETA_MAC_DIRECT_DOWNLOAD } from "@/lib/betaOffer";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/jsonLd";
import { SHORTCUTS } from "@/lib/shortcuts";
import { explainMono } from "../explain/mono";
import "../explain/explain.css";
import "../code-explainer.css";

const PATH = "/code-explainer-mac";
const shortcut = SHORTCUTS.mac.anywhere;
const sentAnswer = faqItems.find((item) => item.id === "sent")?.answer ?? "";

export const metadata: Metadata = {
  title: { absolute: "Code Explainer for Mac: Unvibe, Free Desktop App" },
  description: `Select code in Cursor, VS Code, Xcode, Terminal or a browser, press ${shortcut}, and Unvibe explains it in plain English beside your editor. Free for Mac.`,
  alternates: { canonical: PATH },
};

/** A search landing page for people who want a Mac app, not a paste box: how it works on a Mac, then the download. */
export default function CodeExplainerMacPage() {
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Code explainer for Mac", path: PATH }])) }}
      />
      <header className="explain-head">
        <nav aria-label="Breadcrumb" className="explain-crumb">
          <Link href="/">Home</Link> <span aria-hidden="true">/</span> Code explainer for Mac
        </nav>
        <h1>A code explainer for your Mac</h1>
        <p>
          Unvibe is a free Mac app. Select code in any app, press {shortcut}, and Vibe explains it in plain English in a
          panel beside your editor.
        </p>
        <div className="os-get">
          <DownloadLink href={BETA_MAC_DIRECT_DOWNLOAD} platform="mac" surface="seo_mac" tone="dark" />
        </div>
      </header>

      <section className="explain-card os-how" aria-labelledby="mac-how">
        <div>
          <h2 id="mac-how">How it works on a Mac</h2>
          <p>
            Select code in Cursor, VS Code, Xcode, Terminal or a page in Safari, then press {shortcut}. The panel opens
            beside the window you were in, and the explanation streams in as it is written. There is nothing to paste
            and no API key to set up.
          </p>
          <p>{shortcut} is the default. You can change the shortcut in Unvibe&apos;s Settings.</p>
        </div>
        <figure className="os-shot">
          <Image
            src="/product/os/mac-panel-v0.1.44.webp"
            width={880}
            height={1132}
            sizes="(min-width: 860px) 400px, 100vw"
            alt="The Unvibe panel on a Mac explaining a JavaScript debounce function at the Intermediate depth"
          />
          <figcaption>Unvibe 0.1.44 on a Mac, explaining a JavaScript debounce function.</figcaption>
        </figure>
      </section>

      <section className="explain-card" aria-labelledby="mac-which">
        <h2 id="mac-which">Which Mac</h2>
        <p>
          Unvibe runs on Apple silicon Macs (M1 or newer) and on older Intel Macs. Each has its own build: the download
          button gets the Apple silicon one.
        </p>
        <MacBuildLinks intelMac={false} surface="seo_mac" />

        <h2 id="mac-first-open">The first open</h2>
        <p>
          Unvibe is not notarized by Apple yet, so the first time you open it macOS says &ldquo;Unvibe Not Opened&rdquo;.
          You allow it once with Open Anyway in System Settings, under Privacy &amp; Security, and later versions install
          from inside the app with one click. The one-line Terminal install skips this step.
        </p>
        <p>
          <Link className="paper-text-link" href="/install-help">Every first-open step, for both installs</Link>
        </p>

        <h2 id="mac-accessibility">Why it asks for Accessibility</h2>
        <p>
          The first time you press {shortcut}, macOS asks you to let Unvibe use Accessibility. Unvibe uses it to copy the
          code you selected in the app you are in, which is how one shortcut works in every app. You grant it once, in
          System Settings under Privacy &amp; Security, then Accessibility.
        </p>
      </section>

      <section className="explain-card" aria-labelledby="mac-what">
        <h2 id="mac-what">What it can explain</h2>
        <ul className="explain-notes">
          <li>Any code you select, at four free depths: New, Beginner, Intermediate and Advanced. Expert is part of Pro.</li>
          <li>Test me writes one question about the exact code you selected, to check the explanation stuck.</li>
          <li>Lessons you keep are saved to your Library on this Mac.</li>
          <li>Change Briefs list what changed in your git repo, made on your Mac, for free. The AI explanation of a change is Pro.</li>
          <li>
            &ldquo;Why does this exist?&rdquo; answers from git blame and the file&apos;s last 8 commits, which Unvibe reads
            in your repository on your Mac.
          </li>
        </ul>

        <h2 id="mac-sent">What is sent</h2>
        <p>{sentAnswer}</p>
      </section>

      <section className="explain-card explain-get" aria-labelledby="mac-get">
        <h2 id="mac-get">Get Unvibe for Mac</h2>
        <p>Free, with no card and no API key.</p>
        <div className="os-get">
          <DownloadLink href={BETA_MAC_DIRECT_DOWNLOAD} platform="mac" surface="seo_mac" tone="dark" />
        </div>
        <p>
          On Windows? <Link className="paper-text-link" href="/code-explainer-windows">Unvibe for Windows</Link>.
          Want to try first? <Link className="paper-text-link" href="/explain">Explain code in your browser</Link>. All
          downloads are on the <Link className="paper-text-link" href="/beta">download page</Link>.
        </p>
      </section>
    </article>
  );
}
