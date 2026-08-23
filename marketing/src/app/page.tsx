import type { Metadata } from "next";
import { PhotoHero } from "@/components/paper/PhotoHero";
import { DecoderBoard } from "@/components/paper/DecoderBoard";
import { ShortcutKeys } from "@/components/paper/ShortcutKeys";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { ToolsMarquee } from "@/components/paper/ToolsMarquee";
import { StoryStage } from "@/components/paper/StoryStage";
import { TypingFaq } from "@/components/paper/TypingFaq";
import { WaitlistInvite } from "@/components/paper/WaitlistInvite";
import { BetaSurvey } from "@/components/paper/BetaSurvey";
import { ChangelogList } from "@/components/paper/ChangelogList";
import { PaperDemoVideo } from "@/components/paper/PaperDemoVideo";
import { Reveal } from "@/components/redesign/Reveal";
import { faqItems } from "@/data/faq";
import { changelogPreview } from "@/data/milestones";

export const metadata: Metadata = {
  title: "Unvibe. Learn the code AI shipped.",
};

const homeFaq = faqItems.filter((item) =>
  ["what-is-it", "generator", "editors", "sent", "beta", "windows"].includes(item.id),
);

export default function HomePage() {
  return (
    <div>
      <PhotoHero />

      <section className="paper-section" id="product">
        <Reveal className="paper-wrap paper-center">
          <PaperDemoVideo />
          <p className="paper-caption">
            Highlight code in your editor. Unvibe explains it beside Cursor, then you can test yourself. The stills below are current.
          </p>
        </Reveal>
      </section>

      <ToolsMarquee />

      <section className="paper-section paper-section--loop" id="loop">
        <div className="paper-wrap paper-center">
          <Reveal>
            <p className="paper-meta">The loop</p>
            <h2 className="mt-3">One shortcut. The rest stays with you.</h2>
          </Reveal>
          <div className="mt-10">
            <DecoderBoard />
          </div>
          <div className="mt-6">
            <ShortcutKeys />
          </div>
        </div>
      </section>

      <section className="paper-section paper-install" id="install">
        <Reveal className="paper-wrap paper-center">
          <BetaInstall tone="page" />
        </Reveal>
      </section>

      <StoryStage />

      <section className="paper-section">
        <Reveal className="paper-wrap paper-center">
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
        </Reveal>
      </section>

      <section className="paper-section">
        <Reveal className="paper-wrap">
          <div className="paper-center mb-8">
            <p className="paper-meta">Change log</p>
            <h2 className="mt-3">What shipped.</h2>
            <a href="/releases" className="paper-text-link">Full change log</a>
          </div>
          <div className="paper-log-wrap paper-glass">
            <ChangelogList items={changelogPreview(5)} />
          </div>
        </Reveal>
      </section>

      <section className="paper-section">
        <Reveal className="paper-wrap paper-center">
          <p className="paper-meta">Questions</p>
          <h2 className="mt-3">Short answers.</h2>
          <div className="mt-10">
            <TypingFaq items={homeFaq} />
          </div>
        </Reveal>
      </section>

      <BetaSurvey />

      <section className="paper-section paper-waitlist">
        <Reveal className="paper-wrap">
          <WaitlistInvite />
        </Reveal>
      </section>
    </div>
  );
}
