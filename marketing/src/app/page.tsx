import type { Metadata } from "next";
import { PhotoHero } from "@/components/paper/PhotoHero";
import { AppTour } from "@/components/paper/AppTour";
import { TryIt } from "@/components/paper/TryIt";
import { InviteFriend } from "@/components/paper/InviteFriend";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { BackingStrip } from "@/components/paper/BackingStrip";
import { TypingFaq } from "@/components/paper/TypingFaq";
import { DownloadCta } from "@/components/paper/DownloadCta";
import { HowItWorks } from "@/components/paper/HowItWorks";
import { ScrollSyncedList } from "@/components/paper/ScrollSyncedList";
import { faqItems } from "@/data/faq";

export const metadata: Metadata = {
  title: { absolute: "Unvibe: understand the code AI writes for you" },
};

const homeFaq = faqItems.filter((item) => ["what-is-it", "which-shortcut", "editors", "sent", "beta", "accuracy"].includes(item.id));

export const revalidate = 300;

/**
 * One promise, then the real app recorded, how it works in real screenshots, try it,
 * install, trust, questions. Visitors decide in seconds and read a fraction of the words.
 */
export default function HomePage() {
  return (
    <div className="home-page">
      <PhotoHero />

      <AppTour />

      <HowItWorks />

      <section className="paper-section" aria-label="What Unvibe can explain">
        <div className="paper-wrap">
          <ScrollSyncedList
            prefix="Select it, and Vibe explains"
            items={["a React hook.", "a SQL query.", "a regex.", "a shell script.", "the diff your agent just wrote."]}
          />
        </div>
      </section>

      <section className="paper-section" id="try-it" aria-labelledby="try-it-title">
        <div className="paper-wrap">
          <div className="sec-head">
            <p className="paper-meta">Try it here</p>
            <h2 id="try-it-title">Paste code. <em>Vibe explains it.</em></h2>
            <p className="paper-lead">A real explanation in your browser. No download, no account.</p>
          </div>
          <TryIt />
        </div>
      </section>

      <section className="paper-section paper-install" id="install" aria-labelledby="install-title">
        <div className="paper-wrap">
          <div className="sec-head">
            <p className="paper-meta">Download</p>
            <h2 id="install-title">Free for <em>Mac and Windows.</em></h2>
            <p className="paper-lead">Pick your computer, open the app, then press the shortcut in any app.</p>
          </div>
          <BetaInstall tone="page" showFeedback={false} title={null} />
        </div>
      </section>

      <section className="paper-section" aria-labelledby="quotes-title">
        <div className="paper-wrap">
          <div className="sec-head">
            <p className="paper-meta">From beta testers</p>
            <h2 id="quotes-title">In their <em>own words.</em></h2>
          </div>
          <div className="quotes">
            <figure className="quote">
              <blockquote>
                <p>The interface was simple to navigate, the explanations were clear, and Test Me made it easy to recap what I learned.</p>
              </blockquote>
              <figcaption>
                <span className="quote__avatar" aria-hidden="true">SG</span>
                <span><b>Sharice Gustian</b>Beta tester</span>
              </figcaption>
            </figure>
            <figure className="quote quote--lime">
              <blockquote>
                <p>Setup was smooth. The floating Island feels distinctive, and the explanation depth controls make learning feel genuinely tailored.</p>
              </blockquote>
              <figcaption>
                <span className="quote__avatar" aria-hidden="true">OK</span>
                <span><b>Om Anand Khaunte</b>Officer, Los Altos Hacks</span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <BackingStrip />

      <section className="paper-section" aria-labelledby="faq-title">
        <div className="paper-wrap">
          <div className="sec-head">
            <p className="paper-meta">Questions</p>
            <h2 id="faq-title">Short <em>answers.</em></h2>
          </div>
          <TypingFaq items={homeFaq} />
        </div>
      </section>

      <section className="paper-section" id="invite" aria-labelledby="invite-title">
        <div className="paper-wrap"><InviteFriend /></div>
      </section>

      <section className="paper-section">
        <div className="paper-wrap">
          <DownloadCta />
        </div>
      </section>
    </div>
  );
}
