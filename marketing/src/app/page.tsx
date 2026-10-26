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
import { SHORTCUTS } from "@/lib/shortcuts";

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
        <div className="paper-wrap u-sheet">
          <ScrollSyncedList
            prefix="Select it, and Vibe explains"
            items={["a React hook.", "a SQL query.", "a regex.", "a shell script.", "the diff your agent just wrote."]}
          />
        </div>
      </section>

      <section className="paper-section" id="try-it" aria-labelledby="try-it-title">
        <div className="paper-wrap u-sheet">
          <div className="sec-head">
            <p className="paper-meta">Try it here</p>
            <h2 id="try-it-title">Paste code. <em>Vibe explains it.</em></h2>
            <p className="paper-lead">
              A real explanation in your browser, no download. In the app there is no pasting: select code in any app and
              press {SHORTCUTS.mac.anywhere} ({SHORTCUTS.windows.anywhere} on Windows).
            </p>
          </div>
          <TryIt />
        </div>
      </section>

      <section className="paper-section paper-install" id="install" aria-labelledby="install-title">
        <div className="paper-wrap u-sheet">
          <div className="sec-head">
            <p className="paper-meta">Download</p>
            <h2 id="install-title">Free for <em>Mac and Windows.</em></h2>
            <p className="paper-lead">Pick your computer, open the app, then press the shortcut in any app.</p>
          </div>
          <BetaInstall tone="page" surface="home_install" showFeedback={false} title={null} />
        </div>
      </section>

      <BackingStrip />

      <section className="paper-section" aria-labelledby="faq-title">
        <div className="paper-wrap u-sheet u-split">
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
