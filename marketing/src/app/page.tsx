import type { Metadata } from "next";
import Link from "next/link";
import { PhotoHero } from "@/components/paper/PhotoHero";
import { AppTour } from "@/components/paper/AppTour";
import { TryIt } from "@/components/paper/TryIt";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { BackingStrip } from "@/components/paper/BackingStrip";
import { TypingFaq } from "@/components/paper/TypingFaq";
import { HowItWorks } from "@/components/paper/HowItWorks";
import { STEPS } from "@/data/howItWorks";
import { ScrollSyncedList } from "@/components/paper/ScrollSyncedList";
import { WhatLeaves } from "@/components/paper/WhatLeaves";
import { HomePricing } from "@/components/paper/HomePricing";
import { Arrive } from "@/components/paper/Arrive";
import { faqItems } from "@/data/faq";
import { SHORTCUTS } from "@/lib/shortcuts";
import { faqPageJsonLd, howToJsonLd, jsonLdScript, websiteJsonLd } from "@/lib/jsonLd";
import { explainLanguage, explainPages } from "@/lib/explainPages";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "Unvibe: Explain AI-Written Code in Plain English, Free",
  absolute: true,
  description: `Unvibe is a free code explainer for Mac and Windows. Select AI-written code in any app, press ${SHORTCUTS.mac.anywhere} (${SHORTCUTS.windows.anywhere} on Windows), and read it in plain English.`,
});

const homeFaq = faqItems.filter((item) => ["which-shortcut", "editors", "sent", "accuracy"].includes(item.id));

/** Only what the page shows: the four answers in the questions section and the four How it works steps. */
const homeJsonLd = [
  websiteJsonLd,
  faqPageJsonLd(homeFaq),
  howToJsonLd(
    "How to understand AI-written code with Unvibe",
    STEPS.map((step) => ({ name: step.title, text: step.body ? `${step.title} ${step.body}` : step.title, image: step.image?.src })),
  ),
];

/** The language pages linked from the Try it section, so search engines reach them from the homepage. */
const HOME_LANGUAGES = ["python", "javascript", "typescript", "sql", "bash"];
const homeLanguagePages = HOME_LANGUAGES.map((id) => explainPages.find((page) => page.id === id)).filter((page) => page !== undefined);

export const revalidate = 300;

/**
 * One promise, the real app recorded, how it works, try it, what leaves, pricing, backing, questions,
 * then the download. Each section is a tinted plate (Design 466) that rises in as it scrolls into
 * view: the Arrive sits between the section and its plate, so the motion is on the plate itself.
 */
export default function HomePage() {
  return (
    <div className="home-page">
      {homeJsonLd.map((value) => (
        <script key={String(value["@type"])} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(value) }} />
      ))}
      <PhotoHero />

      <AppTour />

      <HowItWorks />

      <section className="paper-section" aria-label="What Unvibe can explain">
        <Arrive className="arrive--plate">
          <div className="paper-wrap u-sheet">
            <ScrollSyncedList
              prefix="Select it, and Vibe explains"
              items={["a React hook.", "a SQL query.", "a regex.", "a shell script.", "the diff your agent just wrote."]}
            />
          </div>
        </Arrive>
      </section>

      <section className="paper-section" id="try-it" aria-labelledby="try-it-title">
        <Arrive className="arrive--plate">
          <div className="paper-wrap u-sheet">
            <div className="sec-head">
              <h2 id="try-it-title">Paste code. Vibe <mark className="u-mark">explains</mark> it.</h2>
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
          </div>
        </Arrive>
      </section>

      <WhatLeaves />

      <HomePricing />

      <BackingStrip />

      <section className="paper-section" aria-labelledby="faq-title">
        <Arrive className="arrive--plate">
          <div className="paper-wrap u-sheet u-split u-solid">
            <div className="sec-head">
              <h2 id="faq-title">Short <mark className="u-mark">answers</mark>.</h2>
            </div>
            <TypingFaq items={homeFaq} />
          </div>
        </Arrive>
      </section>

      <section className="paper-section paper-install" id="install" aria-labelledby="install-title">
        <Arrive className="arrive--plate">
          <div className="paper-wrap u-sheet">
            <div className="sec-head">
              <h2 id="install-title"><mark className="u-mark">Free</mark> for Mac and Windows.</h2>
              <p className="paper-lead">Download, open the app, then press the shortcut in any app.</p>
            </div>
            <BetaInstall tone="page" surface="home_install" showFeedback={false} title={null} />
          </div>
        </Arrive>
      </section>
    </div>
  );
}
