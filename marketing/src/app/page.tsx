import type { Metadata } from "next";
import Link from "next/link";
import { PhotoHero } from "@/components/paper/PhotoHero";
import { TryIt } from "@/components/paper/TryIt";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { TypingFaq } from "@/components/paper/TypingFaq";
import { HomeBackingLine, HomeLoop, HomeSteps } from "@/components/paper/HomeSections";
import { WhatLeaves } from "@/components/paper/WhatLeaves";
import { HomePricing } from "@/components/paper/HomePricing";
import { faqItems } from "@/data/faq";
import { SHORTCUTS } from "@/lib/shortcuts";
import { jsonLdScript, websiteJsonLd } from "@/lib/jsonLd";
import { explainLanguage, explainPages } from "@/lib/explainPages";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "Unvibe: Code Explainer for Mac and Windows, Free",
  absolute: true,
  description: `Select code in any app, press ${SHORTCUTS.mac.anywhere} (${SHORTCUTS.windows.anywhere} on Windows), and Vibe explains it in plain English beside your editor. Free, no API key.`,
});

/** Four answers the sections above don't already give (what is sent and AI accuracy are in "What leaves your computer"). */
const homeFaq = faqItems.filter((item) => ["what-is-it", "editors", "which-shortcut", "training"].includes(item.id));

/** The language pages linked from the Try it section, so search engines reach them from the homepage. */
const HOME_LANGUAGES = ["python", "javascript", "typescript", "sql", "bash"];
const homeLanguagePages = HOME_LANGUAGES.map((id) => explainPages.find((page) => page.id === id)).filter((page) => page !== undefined);

export const revalidate = 300;

/**
 * Design W2's page: the promise, three steps, the learning loop, what leaves your computer, the price,
 * one download card, four answers. Try it stays (its pause line and Anthropic consent are required
 * disclosures); the demo video sits behind "Watch the demo" in the steps; the startup programs are one
 * line at the foot. The newsletter is in the footer and the invite in the app's Share page.
 */
export default function HomePage() {
  return (
    <div className="home-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd) }} />
      <PhotoHero />

      <HomeSteps />

      <HomeLoop />

      <section className="paper-section" id="try-it" aria-labelledby="try-it-title">
        <div className="paper-wrap u-sheet">
          <div className="sec-head">
            <p className="paper-meta">Try it here</p>
            <h2 id="try-it-title">Paste code. <em>Vibe explains it.</em></h2>
            <p className="paper-lead">
              A real explanation online, no download. In the app there is no pasting: select code in any app and
              press {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows).
            </p>
          </div>
          <TryIt />
          <p className="home-langs">
            By programming language:{" "}
            {homeLanguagePages.map((page, index) => (
              <span key={page.id}>
                {index > 0 ? ", " : null}
                <Link className="paper-text-link" href={`/explain/${page.id}`}>
                  Explain {explainLanguage(page).name} code
                </Link>
              </span>
            ))}
          </p>
        </div>
      </section>

      <WhatLeaves />

      <HomePricing />

      <section className="paper-section paper-install" id="install" aria-labelledby="install-title">
        <div className="paper-wrap u-sheet">
          <div className="sec-head">
            <p className="paper-meta">Download</p>
            <h2 id="install-title">Download <em>Unvibe.</em></h2>
            <p className="paper-lead">Open the app, select code anywhere, press {SHORTCUTS.mac.anywhere}.</p>
          </div>
          <BetaInstall tone="page" surface="home_install" showFeedback={false} title={null} />
        </div>
      </section>

      <section className="paper-section" id="faq" aria-labelledby="faq-title">
        <div className="paper-wrap u-sheet u-split">
          <div className="sec-head">
            <p className="paper-meta">Questions</p>
            <h2 id="faq-title">Short <em>answers.</em></h2>
          </div>
          <TypingFaq items={homeFaq} />
        </div>
      </section>

      <HomeBackingLine />
    </div>
  );
}
