import type { Metadata } from "next";
import Link from "next/link";
import { DemoHero } from "@/components/b/DemoHero";
import { PanelStory } from "@/components/b/PanelStory";
import { SelectLine } from "@/components/b/SelectLine";
import { Arrive } from "@/components/paper/Arrive";
import { TryIt } from "@/components/paper/TryIt";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { BackingStrip } from "@/components/paper/BackingStrip";
import { TypingFaq } from "@/components/paper/TypingFaq";
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

const homeFaq = faqItems.filter((item) => ["which-shortcut", "editors", "sent", "accuracy"].includes(item.id));

/** The language pages linked from the Try it section, so search engines reach them from the homepage. */
const HOME_LANGUAGES = ["python", "javascript", "typescript", "sql", "bash"];
const homeLanguagePages = HOME_LANGUAGES.map((id) => explainPages.find((page) => page.id === id)).filter((page) => page !== undefined);

export const revalidate = 300;

/**
 * Ledger 469 (B, then Preston 22:5x "make a new one, clean and tons of animations"): the hero plays the
 * product, a statement line selects what Vibe explains, the panel's 4 steps run as a scroll story of real
 * screenshots, then try it, what leaves, pricing, backing, questions and the download band. Sections sit
 * on one ground (no plates); each arrives once as it scrolls in, and each existing section keeps its copy.
 */
export default function HomePage() {
  return (
    <div className="home-page b-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteJsonLd) }} />
      <DemoHero />

      <SelectLine />

      <PanelStory />

      <section className="paper-section" id="try-it" aria-labelledby="try-it-title">
        <div className="paper-wrap u-sheet">
          <Arrive className="b-arrive">
            <div className="sec-head">
              <h2 id="try-it-title">Paste code. Vibe explains it.</h2>
              <p className="paper-lead">A real explanation online, no download.</p>
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
          </Arrive>
        </div>
      </section>

      <WhatLeaves />

      <HomePricing />

      <BackingStrip />

      <section className="paper-section" aria-labelledby="faq-title">
        <div className="paper-wrap u-sheet u-split u-solid">
          <Arrive className="b-arrive">
            <div className="sec-head">
              <h2 id="faq-title">Short answers.</h2>
            </div>
            <TypingFaq items={homeFaq} />
          </Arrive>
        </div>
      </section>

      <section className="paper-section paper-install" id="install" aria-labelledby="install-title">
        <div className="paper-wrap u-sheet">
          <Arrive className="b-arrive">
            <div className="sec-head">
              <h2 id="install-title">Free for Mac and Windows.</h2>
              <p className="paper-lead">Download, open the app, then press the shortcut in any app.</p>
            </div>
            <BetaInstall tone="page" surface="home_install" showFeedback={false} title={null} />
          </Arrive>
        </div>
      </section>
    </div>
  );
}
