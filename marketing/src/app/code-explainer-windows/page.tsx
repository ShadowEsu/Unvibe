import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DownloadLink } from "@/components/paper/DownloadLink";
import { BETA_WINDOWS_DIRECT_DOWNLOAD, BETA_WINDOWS_INSTALL_COMMAND } from "@/lib/betaOffer";
import { BETA_WINDOWS_ASSET } from "@/lib/betaInstallScript";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/jsonLd";
import { SHORTCUTS } from "@/lib/shortcuts";
import { explainMono } from "../explain/mono";
import "../explain/explain.css";
import "../code-explainer.css";

const PATH = "/code-explainer-windows";
const shortcut = SHORTCUTS.windows.anywhere;

export const metadata: Metadata = {
  title: { absolute: "Code Explainer for Windows: Unvibe, Free Desktop App" },
  description: `Select code in VS Code, Cursor, Notepad or a browser, press ${shortcut}, and Unvibe explains it in plain English beside your editor. Free for Windows.`,
  alternates: { canonical: PATH },
};

/** A search landing page for people who want a Windows app, not a paste box: how it works on Windows, then the download. */
export default function CodeExplainerWindowsPage() {
  return (
    <article className={`explain-page ${explainMono.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Code explainer for Windows", path: PATH }])) }}
      />
      <header className="explain-head">
        <nav aria-label="Breadcrumb" className="explain-crumb">
          <Link href="/">Home</Link> <span aria-hidden="true">/</span> Code explainer for Windows
        </nav>
        <h1>A code explainer for Windows</h1>
        <p>
          Unvibe is a free Windows app. Highlight code in whatever program you are using, press {shortcut}, and Vibe
          writes a plain English explanation in a panel next to it.
        </p>
        <div className="os-get">
          <DownloadLink href={BETA_WINDOWS_DIRECT_DOWNLOAD} platform="windows" surface="seo_windows" />
        </div>
      </header>

      <section className="explain-card os-how" aria-labelledby="win-how">
        <div>
          <h2 id="win-how">How it works on Windows</h2>
          <p>
            Highlight a few lines in VS Code, Cursor, Notepad or a browser tab and press {shortcut}. Vibe&apos;s panel
            appears next to that window and the explanation fills in while you read. You never copy and paste the code
            into a chat.
          </p>
          <p>If {shortcut} clashes with another program, pick a different shortcut in Unvibe&apos;s Settings.</p>
        </div>
        <figure className="os-shot">
          <Image
            src="/product/os/windows-panel-v0.1.44.webp"
            width={560}
            height={640}
            sizes="(min-width: 860px) 22rem, 100vw"
            alt="The Unvibe panel on Windows explaining JavaScript selected in Notepad, with what to check next"
          />
          <figcaption>Unvibe 0.1.44 on Windows, explaining JavaScript selected in Notepad.</figcaption>
        </figure>
      </section>

      <section className="explain-card" aria-labelledby="win-which">
        <h2 id="win-which">Which Windows</h2>
        <p>
          Windows 10 or Windows 11, on a 64-bit (x64) PC. The download is a single portable file, {BETA_WINDOWS_ASSET},
          that runs from wherever you save it.
        </p>
        <p>
          To have Unvibe in your Start menu instead, open Windows PowerShell (not Command Prompt), paste this line and
          press Enter. It installs Unvibe, adds it to Start and opens it:
        </p>
        <code className="os-cmd">{BETA_WINDOWS_INSTALL_COMMAND}</code>

        <h2 id="win-first-open">The first run</h2>
        <p>
          Unvibe is not signed with a paid certificate yet, so when you first run the .exe Windows may show a blue
          &ldquo;Windows protected your PC&rdquo; box. Press More info, then Run anyway. You only do this once.
        </p>
        <p>
          Work and school PCs can hide the Run anyway button. If Smart App Control is on (Windows 11), it blocks unsigned
          apps like Unvibe and allows no exception for a single app.
        </p>
        <p>
          <Link className="paper-text-link" href="/install-help">Install help for Windows, and how to reach us</Link>
        </p>
      </section>

      <section className="explain-card" aria-labelledby="win-what">
        <h2 id="win-what">What Vibe can do with your code</h2>
        <ul className="explain-notes">
          <li>Explain it at the level you pick. New, Beginner, Intermediate and Advanced are free; Expert comes with Pro.</li>
          <li>Quiz you with Test me: one question written about the lines you highlighted.</li>
          <li>Keep the lessons you want in your Library, saved on this PC.</li>
          <li>See what changed in your repo in a Change Brief, built on your PC at no cost (its AI explanation is Pro).</li>
          <li>
            Answer &ldquo;Why does this exist?&rdquo; from the git blame of those lines and the file&apos;s 8 most recent
            commits, read from the repository on your PC.
          </li>
        </ul>

        <h2 id="win-sent">What leaves your PC</h2>
        <p>
          Only the request you make: the highlighted code with its file name and language (on Pro, some code around it
          for context), or, on Pro, the git changes you ask the AI to explain, and any question you type. A request with
          a key or token in it is stopped on your PC, and a possible one asks you first; since version 0.1.44 that check
          covers your questions and Chat messages too. Your repository is never uploaded.
        </p>
      </section>

      <section className="explain-card explain-get" aria-labelledby="win-get">
        <h2 id="win-get">Get Unvibe for Windows</h2>
        <p>Free. No card, no API key.</p>
        <div className="os-get">
          <DownloadLink href={BETA_WINDOWS_DIRECT_DOWNLOAD} platform="windows" surface="seo_windows" />
        </div>
        <p>
          Using a Mac? <Link className="paper-text-link" href="/code-explainer-mac">Unvibe for Mac</Link>. Not ready to
          install? <Link className="paper-text-link" href="/explain">Explain code in your browser</Link>. Every build is
          on the <Link className="paper-text-link" href="/beta">download page</Link>.
        </p>
      </section>
    </article>
  );
}
