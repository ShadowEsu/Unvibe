import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { PhotoHero } from "@/components/paper/PhotoHero";
import { AppTour } from "@/components/paper/AppTour";
import { TryIt } from "@/components/paper/TryIt";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { BackingStrip } from "@/components/paper/BackingStrip";
import { ExpandRows } from "@/components/paper/ExpandRows";
import { HomeDock } from "@/components/paper/HomeDock";
import { HowItWorks } from "@/components/paper/HowItWorks";
import { Vibe } from "@/components/paper/Vibe";
import { STEPS } from "@/data/howItWorks";
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

/** The browser bar matches the violet field the page opens on. */
export const viewport: Viewport = { themeColor: "#33209a" };

/**
 * Before first paint: `n-load` turns on the load sequence (n.css) for this first load only, and the first visit of
 * a session with motion allowed gets the short intro. A client-side visit runs neither (React doesn't run this
 * script), so the page is simply there. The intro ends at 850 ms, or at once on any click, wheel, touch or key.
 */
const BOOT = `(function(){try{var d=document.documentElement;d.classList.add("n-load");if(matchMedia("(prefers-reduced-motion: reduce)").matches||sessionStorage.getItem("uv-intro"))return;sessionStorage.setItem("uv-intro","1");d.classList.add("has-intro")}catch(e){}})()`;

/**
 * Direction N (Design, agents/design/unvibe-new-N): the violet hero with the demo playing itself, the real
 * recording, the pinned story, Try it, what leaves your computer, pricing, backing, short answers, then the
 * download band, which closes the page. Sections rise in as they scroll into view (Arrive).
 */
export default function HomePage() {
  return (
    <div className="n-home">
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      {homeJsonLd.map((value) => (
        <script key={String(value["@type"])} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(value) }} />
      ))}
      <div className="nintro" aria-hidden="true"><Vibe size={88} /></div>

      <PhotoHero />

      <div className="n-sec n-wrap">
        <AppTour />
      </div>

      <HowItWorks />

      <section className="n-sec n-wrap ntry" id="try-it" aria-labelledby="try-it-title">
        <Arrive className="n-head">
          <h2 id="try-it-title">Paste code. Vibe explains it.</h2>
          <p className="n-lead">A real explanation online, no download.</p>
        </Arrive>
        <div className="ntry__box">
          <TryIt />
        </div>
        <p className="home-langs">
          By programming language:{" "}
          {homeLanguagePages.map((page, index) => (
            <span key={page.id}>
              {index > 0 ? ", " : null}
              <Link className="n-link" href={`/explain/${page.id}`}>
                Explain {explainLanguage(page).name} code
              </Link>
            </span>
          ))}
        </p>
      </section>

      <WhatLeaves />

      <HomePricing />

      <div className="n-wrap nback">
        <BackingStrip />
      </div>

      <section className="n-sec n-wrap n-center" id="faq" aria-labelledby="faq-title">
        <Arrive className="n-head n-center">
          <h2 id="faq-title">Short answers.</h2>
        </Arrive>
        <div className="nfaq">
          <ExpandRows openFirst rows={homeFaq.map((item) => ({ id: item.id, question: item.question, answer: <p>{item.answer}</p> }))} />
          <p className="n-note nfaq__more"><Link className="n-link" href="/faq">Every question and answer</Link></p>
        </div>
      </section>

      <section className="nband" id="install" aria-labelledby="install-title">
        <div className="n-wrap">
          <h2 id="install-title">Free for Mac and Windows.</h2>
          <p className="n-lead">Download, open the app, then press the shortcut in any app.</p>
          <div className="nband__card">
            <BetaInstall tone="page" surface="home_install" showFeedback={false} title={null} />
          </div>
        </div>
      </section>

      <HomeDock />
    </div>
  );
}
