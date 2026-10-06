import type { Metadata } from "next";
import { PhotoHero } from "@/components/paper/PhotoHero";
import { AppTour } from "@/components/paper/AppTour";
import { DecoderBoard } from "@/components/paper/DecoderBoard";
import { LiveDemo } from "@/components/paper/LiveDemo";
import { BetaInstall } from "@/components/paper/BetaInstall";
import { BackingStrip } from "@/components/paper/BackingStrip";
import { ToolsMarquee } from "@/components/paper/ToolsMarquee";
import { StoryStage } from "@/components/paper/StoryStage";
import { TypingFaq } from "@/components/paper/TypingFaq";
import { ChangelogList } from "@/components/paper/ChangelogList";
import { PaperDemoVideo } from "@/components/paper/PaperDemoVideo";
import { DownloadCta } from "@/components/paper/DownloadCta";
import { HomeBenefits } from "@/components/paper/HomeBenefits";
import { StatsStrip } from "@/components/paper/StatsStrip";
import { DepthPlayground } from "@/components/paper/DepthPlayground";
import { Reveal } from "@/components/redesign/Reveal";
import { faqItems } from "@/data/faq";
import { changelogPreview } from "@/data/milestones";

export const metadata: Metadata = {
  title: "Unvibe. Understand the AI-generated code you ship.",
};

const homeFaq = faqItems.filter((item) =>
  ["what-is-it", "generator", "vs-cursor", "editors", "sent", "beta", "windows", "teams"].includes(item.id),
);

export const revalidate = 300;

export default function HomePage() {
  return (
    <div>
      <PhotoHero />

      <AppTour />

      <StatsStrip />

      <section className="paper-section" id="product">
        <Reveal className="paper-wrap paper-center">
          <PaperDemoVideo />
          <p className="paper-caption">
            A real session in Cursor: select code, press {"\u2318"}U, read the explanation, then test yourself.
          </p>
          <div className="mt-10">
            <HomeBenefits />
          </div>
        </Reveal>
      </section>

      <section className="paper-section paper-install" id="install">
        <Reveal className="paper-wrap paper-center">
          <BetaInstall tone="page" showFeedback={false} />
        </Reveal>
      </section>

      <ToolsMarquee />

      <section className="paper-section paper-section--loop" id="loop">
        <div className="paper-wrap paper-center">
          <Reveal>
            <p className="paper-meta">The loop</p>
            <h2 className="mt-3">One shortcut. The rest <em>stays with you.</em></h2>
          </Reveal>
          <div className="mt-10">
            <LiveDemo />
          </div>
          <div className="mt-12">
            <DecoderBoard />
          </div>
        </div>
      </section>

      <section className="paper-section" id="try">
        <Reveal className="paper-wrap paper-center">
          <p className="paper-meta">Try it here</p>
          <h2 className="mt-3">Same code. <em>Five depths.</em></h2>
          <p className="paper-lead mt-3">Pick a snippet and slide the depth. This is how Unvibe meets you where you are.</p>
          <div className="mt-10">
            <DepthPlayground />
          </div>
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

      <BackingStrip />

      <section className="paper-section">
        <Reveal className="paper-wrap">
          <div className="paper-center mb-8">
            <p className="paper-meta">Change log</p>
            <h2 className="mt-3">What <em>shipped.</em></h2>
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
          <h2 className="mt-3">Short <em>answers.</em></h2>
          <div className="mt-10">
            <TypingFaq items={homeFaq} />
          </div>
        </Reveal>
      </section>

      <section className="paper-section">
        <div className="paper-wrap">
          <DownloadCta />
        </div>
      </section>
    </div>
  );
}
