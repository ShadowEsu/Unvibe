import {
  ArrowDown,
  ArrowRight,
  Check,
  Command,
  MousePointer2,
} from "lucide-react";
import { BrandLogos } from "@/components/BrandLogos";
import { Button } from "@/components/Button";
import { FounderClock } from "@/components/FounderClock";
import { FaqJsonLd } from "@/components/JsonLd";
import { MarketingVideo } from "@/components/MarketingVideo";
import { ReleaseCountdown } from "@/components/ReleaseCountdown";
import { PixelWaitlist } from "@/components/redesign/PixelWaitlist";
import { Reveal } from "@/components/redesign/Reveal";
import { faqItems } from "@/data/faq";
import { milestones } from "@/data/milestones";

const quickAnswers = faqItems.filter((item) =>
  ["free", "beta", "screen", "generator"].includes(item.id),
);

export default function Home() {
  const recentReleases = milestones.slice(0, 4);

  return (
    <>
      <FaqJsonLd />

      <section className="editorial-hero" id="product">
        <div className="editorial-hero__grid" aria-hidden="true" />
        <div className="editorial-hero__orb editorial-hero__orb--one" aria-hidden="true" />
        <div className="editorial-hero__orb editorial-hero__orb--two" aria-hidden="true" />
        <Reveal className="container-page editorial-hero__inner">
          <p className="editorial-eyebrow"><span /> The understanding layer for vibe coding</p>
          <h1>
            <span>Vibe code freely.</span>
            <em>Own what you ship.</em>
          </h1>
          <p className="editorial-hero__lead">
            AI can create the code. Unvibe is the learning layer built to help you
            understand, verify, and remember the software you are responsible for.
          </p>
          <div className="editorial-hero__actions">
            <Button href="#waitlist" size="lg">
              Request beta access <ArrowRight size={18} />
            </Button>
            <Button href="/beta" size="lg" variant="secondary">
              Download for macOS <ArrowDown size={17} />
            </Button>
          </div>
          <div className="editorial-hero__status">
            <a href="/build"><i /> 55% to public beta</a>
            <span>Cursor + VS Code</span>
            <span>Local secret filtering</span>
            <span>No provider key required</span>
          </div>
          <div className="editorial-hero__telemetry" aria-label="Unvibe release and founder status">
            <ReleaseCountdown />
            <div className="editorial-hero__founder">
              <FounderClock breakdown />
            </div>
          </div>
        </Reveal>
      </section>

      <section className="editorial-demo" id="how-it-works">
        <Reveal className="container-page">
          <div className="editorial-heading editorial-heading--ink">
            <p>01 / THE MISSING STEP</p>
            <h2>AI ships fast.<br /><em>Understanding should keep up.</em></h2>
            <span>Select the code, press ⌘U, and return to building with the context in your head.</span>
          </div>
          <div className="editorial-promo-frame">
            <MarketingVideo
              className="editorial-promo-frame__video"
              src="/videos/unvibe-promo.mp4"
              poster="/videos/unvibe-promo-poster.jpg"
              label="Unvibe product overview showing selected-code explanations, learning history, and progress"
              autoPlay
            />
          </div>
          <div className="editorial-steps">
            <article><span>01</span><MousePointer2 size={20} /><h3>Select</h3><p>Highlight the exact code you need to own.</p></article>
            <article><span>02</span><Command size={20} /><h3>Understand</h3><p>Get a focused explanation at your level.</p></article>
            <article><span>03</span><Check size={20} /><h3>Keep it</h3><p>Ask, test, save, and continue shipping.</p></article>
          </div>
        </Reveal>
      </section>

      <section className="editorial-learning">
        <Reveal className="container-page editorial-learning__grid">
          <div className="editorial-learning__copy">
            <p>02 / CODE BECOMES KNOWLEDGE</p>
            <h2>The first learning loop <em>built around vibe-coded work.</em></h2>
            <span>
              Each review becomes context you can question, test, save, and carry
              into the next version of your project.
            </span>
          </div>
          <div className="editorial-learning__film">
            <MarketingVideo
              className="editorial-learning__video"
              src="/videos/unvibe-promo-animation.mp4"
              poster="/videos/unvibe-animation-poster.jpg"
              label="Animated Unvibe workflow showing code selection, five explanation depths, and learning progress"
            />
          </div>
        </Reveal>
      </section>

      <section className="editorial-voices" id="reviews">
        <Reveal className="container-page">
          <div className="editorial-voices__heading">
            <p>03 / PRIVATE BETA NOTES</p>
            <h2>Built with the people<br /><em>learning from it.</em></h2>
          </div>
          <div className="editorial-voices__grid">
            <blockquote>
              <span>9 / 10</span>
              <p>“The interface was simple to navigate, the explanations were clear, and Test Me made it easy to recap what I learned.”</p>
              <footer><strong>Sharice Gustian</strong><small>Private beta tester</small></footer>
            </blockquote>
            <blockquote>
              <span>7 / 10</span>
              <p>“Setup was smooth. The floating Island feels distinctive, and the explanation-depth controls make learning feel genuinely tailored.”</p>
              <footer><strong>Om Anand Khaunte</strong><small>High school student · Officer, Los Altos Hacks</small></footer>
            </blockquote>
          </div>
          <div className="editorial-voices__action">
            <p>Try the same private beta build, then tell us what should ship next.</p>
            <Button href="/beta" size="lg">Download the beta <ArrowRight size={17} /></Button>
          </div>
        </Reveal>
      </section>

      <section className="editorial-trail" id="integrations">
        <Reveal className="container-page editorial-trail__heading">
          <p>04 / WHEREVER YOU VIBE-CODE</p>
          <h2>One layer.<br /><em>Your existing workflow.</em></h2>
          <span>Unvibe sits beside the tools you already use instead of becoming another place to work.</span>
        </Reveal>
        <BrandLogos className="editorial-trail__marquee" />
        <p className="editorial-disclosure">Cursor and VS Code are validated in the private beta. Other workflows are being tested.</p>
      </section>

      <section className="editorial-releases" id="releases">
        <Reveal className="container-page">
          <div className="editorial-releases__heading">
            <div>
              <p>05 / BUILDING IN PUBLIC</p>
              <h2>Every release moves<br /><em>understanding forward.</em></h2>
            </div>
            <Button href="/releases" variant="secondary" size="sm">All releases <ArrowRight size={15} /></Button>
          </div>
          <div className="editorial-release-grid">
            {recentReleases.map((release) => (
              <a href="/releases" key={`${release.date}-${release.title}`}>
                <span><time>{release.date}</time><em>{release.category}</em></span>
                <h3>{release.title}</h3>
                <p>{release.summary}</p>
              </a>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="editorial-access" id="waitlist">
        <Reveal className="container-page editorial-access__grid waitlist-minimal">
          <div className="editorial-access__faq">
            <p className="editorial-access__label">06 / BEFORE YOU REQUEST ACCESS</p>
            <h2>Vibe coding made the code.<br /><em>Now make it yours.</em></h2>
            <div className="faq-list">
              {quickAnswers.map((item, index) => (
                <details key={item.id} open={index === 0}>
                  <summary><span>{String(index + 1).padStart(2, "0")}</span>{item.question}<i aria-hidden="true" /></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="editorial-access__form">
            <p>PRIVATE MAC BETA</p>
            <h3>Understand the code you ship.</h3>
            <span>Request access in under a minute. No credit card.</span>
            <PixelWaitlist variant="hero" />
          </div>
        </Reveal>
      </section>
    </>
  );
}
