import type { Metadata } from "next";
import { PhotoHero } from "@/components/paper/PhotoHero";
import { AppTour } from "@/components/paper/AppTour";
import { TryIt } from "@/components/paper/TryIt";
import { InviteFriend } from "@/components/paper/InviteFriend";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { BackingStrip } from "@/components/paper/BackingStrip";
import { TypingFaq } from "@/components/paper/TypingFaq";
import { DownloadCta } from "@/components/paper/DownloadCta";
import { HomeBenefits } from "@/components/paper/HomeBenefits";
import { faqItems } from "@/data/faq";

export const metadata: Metadata = {
  title: { absolute: "Unvibe: understand the code AI writes for you" },
};

const homeFaq = faqItems.filter((item) => ["what-is-it", "sent", "editors", "windows", "beta"].includes(item.id));

export const revalidate = 300;

/**
 * One promise, proof right under it, then try it, how it works, install, trust, questions.
 * Keep it short: visitors decide in seconds and read a fraction of the words.
 */
export default function HomePage() {
  return (
    <div className="home-page">
      <PhotoHero />

      <AppTour />

      <section className="paper-section" id="try-it">
        <div className="paper-wrap paper-center">
          <p className="paper-meta">Try it right now</p>
          <h2 className="mt-3">Paste code. <em>Vibe explains it.</em></h2>
          <p className="paper-lead mt-3">A real explanation, right here. No download, no account.</p>
          <div className="mt-10"><TryIt /></div>
        </div>
      </section>

      <section className="paper-section" id="product">
        <div className="paper-wrap paper-center">
          <HomeBenefits />
        </div>
      </section>

      <section className="paper-section paper-install" id="install">
        <div className="paper-wrap paper-center">
          <BetaInstall tone="page" showFeedback={false} />
        </div>
      </section>

      <section className="paper-section">
        <div className="paper-wrap paper-center">
          <p className="paper-meta">From testers</p>
          <div className="paper-quotes mt-8">
            <blockquote className="paper-glass">
              <p>The interface was simple to navigate, the explanations were clear, and Test Me made it easy to recap what I learned.</p>
              <footer>Sharice Gustian, private beta tester</footer>
            </blockquote>
            <blockquote className="paper-glass">
              <p>Setup was smooth. The floating Island feels distinctive, and the explanation depth controls make learning feel genuinely tailored.</p>
              <footer>Om Anand Khaunte, officer, Los Altos Hacks</footer>
            </blockquote>
          </div>
        </div>
      </section>

      <BackingStrip />

      <section className="paper-section">
        <div className="paper-wrap paper-center">
          <p className="paper-meta">Questions</p>
          <h2 className="mt-3">Short <em>answers.</em></h2>
          <div className="mt-10">
            <TypingFaq items={homeFaq} />
          </div>
        </div>
      </section>

      <section className="paper-section" id="invite">
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
