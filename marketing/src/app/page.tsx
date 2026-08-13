import Image from "next/image";
import {
  ArrowRight,
  Check,
  Command,
  MessageSquareText,
  MousePointer2,
  ShieldCheck,
  Sparkles,
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
  ["free", "beta", "screen", "generator", "accuracy"].includes(item.id),
);

const learningMoves = [
  {
    icon: MousePointer2,
    number: "01",
    title: "Select what you need to own.",
    copy: "Highlight the exact code in Cursor or VS Code. No copy, paste, or context rebuilding.",
  },
  {
    icon: Command,
    number: "02",
    title: "Understand it in place.",
    copy: "Press ⌘U for an explanation grounded in the code and project around it.",
  },
  {
    icon: Check,
    number: "03",
    title: "Make the knowledge stick.",
    copy: "Ask, test, save, and return to the work with more than a generated answer.",
  },
] as const;

export default function Home() {
  const recentReleases = milestones.slice(0, 3);

  return (
    <div className="refined-home">
      <FaqJsonLd />

      <section className="refined-hero" id="product">
        <div className="refined-hero__ambient" aria-hidden="true" />
        <div className="container-page refined-hero__inner">
          <Reveal className="refined-hero__copy">
            <p className="refined-label"><span /> Built for the code between prompt and production</p>
            <h1>Learn the code<br />AI shipped.</h1>
            <p>
              Unvibe explains the code you select, checks what you understood,
              and keeps the learning with your project.
            </p>
            <div className="refined-hero__actions">
              <Button href="#waitlist" size="lg">Join the private beta <ArrowRight size={16} /></Button>
              <a href="#demo">Watch the 60-second demo <span aria-hidden="true">↘</span></a>
            </div>
          </Reveal>

          <Reveal className="refined-hero__aside">
            <div>
              <small>WORKS WHERE YOU WORK</small>
              <strong>Cursor + VS Code</strong>
            </div>
            <div>
              <small>ONE SHORTCUT</small>
              <strong>select → ⌘U → learn</strong>
            </div>
            <div>
              <small>PRIVATE BY DESIGN</small>
              <strong>secrets filtered locally</strong>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="refined-demo" id="demo" aria-labelledby="demo-title">
        <Reveal className="refined-demo__head">
          <p id="demo-title"><span>Product walkthrough</span> Unvibe beside Cursor</p>
          <p>Real product. Real selected-code flow.</p>
        </Reveal>
        <Reveal className="refined-demo__stage">
          <div className="refined-demo__chrome">
            <span><i /><i /><i /></span>
            <p>UNVIBE / PRIVATE MAC BETA</p>
            <small>01:00</small>
          </div>
          <MarketingVideo
            className="refined-demo__video"
            src="/videos/unvibe-cursor-integration-2026.mp4"
            poster="/videos/unvibe-cursor-integration-2026-poster.jpg"
            label="Unvibe working beside Cursor: selected code becomes an explanation, a comprehension check, and retained learning"
            autoPlay
            captions="/videos/unvibe-cursor-integration-2026.vtt"
          />
        </Reveal>
      </section>

      <section className="refined-principle">
        <Reveal className="container-page refined-principle__inner">
          <p>The missing step in vibe coding</p>
          <h2>Generating code is easy.<br />Knowing what to trust is the work.</h2>
          <span>Unvibe begins when the agent says it&apos;s done.</span>
        </Reveal>
      </section>

      <section className="refined-loop" id="how-it-works">
        <div className="container-page">
          <Reveal className="refined-section-head">
            <p>HOW IT WORKS</p>
            <h2>A quiet learning loop,<br />inside the way you already build.</h2>
          </Reveal>
          <div className="refined-loop__grid">
            {learningMoves.map((move) => {
              const Icon = move.icon;
              return (
                <Reveal className="refined-loop__step" key={move.number}>
                  <span>{move.number}</span>
                  <Icon size={19} />
                  <h3>{move.title}</h3>
                  <p>{move.copy}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="refined-product">
        <div className="container-page refined-product__stack">
          <Reveal className="refined-feature refined-feature--explain">
            <div className="refined-feature__copy">
              <span><MessageSquareText size={17} /> EXPLAIN</span>
              <h2>Clarity without another conversation to manage.</h2>
              <p>Choose a depth, ask a follow-up, and keep the explanation attached to the work that created the question.</p>
              <ul><li>Five explanation levels</li><li>Project-aware follow-ups</li><li>Real syntax-highlighted code</li></ul>
            </div>
            <figure className="refined-feature__visual refined-feature__visual--signin">
              <Image src="/product-shots/sign-in-carry-learning.png" alt="Unvibe learning interface with an explanation workflow" width={2294} height={1536} sizes="(max-width: 900px) 100vw, 60vw" />
            </figure>
          </Reveal>

          <Reveal className="refined-feature refined-feature--reverse">
            <div className="refined-feature__copy">
              <span><Sparkles size={17} /> TEST + RETAIN</span>
              <h2>Move from “I read it” to “I can explain it.”</h2>
              <p>Turn the code you reviewed into a quick check, revisit saved concepts, and see what is becoming yours.</p>
              <ul><li>Quick checks and recall</li><li>Saved learning history</li><li>Progress from real reviews</li></ul>
            </div>
            <div className="refined-feature__duo">
              <figure><Image src="/product-shots/quiz-lessons-dark.png" alt="Unvibe quiz based on reviewed project code" width={1772} height={1414} sizes="(max-width: 900px) 100vw, 30vw" /></figure>
              <figure><Image src="/product-shots/progress-dark.png" alt="Unvibe progress dashboard for retained code knowledge" width={1888} height={1494} sizes="(max-width: 900px) 100vw, 30vw" /></figure>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="refined-tools" id="integrations">
        <Reveal className="container-page refined-tools__head">
          <div><p>THE LAYER, NOT THE DESTINATION</p><h2>Keep your tools.<br />Add understanding.</h2></div>
          <p>Cursor and VS Code are validated in the private beta. Unvibe stays outside the editor, ready wherever selected code needs context.</p>
        </Reveal>
        <BrandLogos className="refined-tools__marquee" />
      </section>

      <section className="refined-voices" id="reviews">
        <Reveal className="container-page refined-voices__grid">
          <div className="refined-voices__intro">
            <p>PRIVATE BETA NOTES</p>
            <h2>Built with people learning from real code.</h2>
            <span>Not polished marketing quotes—direct notes from the first testers.</span>
          </div>
          <blockquote>
            <span>9 / 10</span>
            <p>“The interface was simple to navigate, the explanations were clear, and Test Me made it easy to recap what I learned.”</p>
            <footer><strong>Sharice Gustian</strong><small>Private beta tester</small></footer>
          </blockquote>
          <blockquote>
            <span>7 / 10</span>
            <p>“Setup was smooth. The floating Island feels distinctive, and the explanation-depth controls make learning feel genuinely tailored.”</p>
            <footer><strong>Om Anand Khaunte</strong><small>Officer, Los Altos Hacks</small></footer>
          </blockquote>
        </Reveal>
      </section>

      <section className="refined-public" id="releases">
        <Reveal className="container-page refined-public__grid">
          <div className="refined-public__status">
            <p>BUILDING IN PUBLIC</p>
            <h2>See what is moving.</h2>
            <span>The release, the founder hours, and the latest product work.</span>
            <ReleaseCountdown />
            <FounderClock breakdown />
          </div>
          <div className="refined-public__releases">
            <div><span>LATEST RELEASES</span><a href="/releases">View all <ArrowRight size={13} /></a></div>
            {recentReleases.map((release, index) => (
              <a href="/releases" key={`${release.date}-${release.title}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><small>{release.date} / {release.category}</small><h3>{release.title}</h3><p>{release.summary}</p></div>
                <ArrowRight size={15} />
              </a>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="refined-access" id="beta-access">
        <Reveal className="container-page refined-access__grid waitlist-minimal">
          <div className="refined-access__copy">
            <p>PRIVATE MAC BETA</p>
            <h2>Make the code<br />feel like yours.</h2>
            <span>Request access in under a minute. No credit card or provider API key.</span>
            <div className="refined-access__trust">
              <p><ShieldCheck size={17} /> Your code and full explanations stay local.</p>
              <p><Check size={17} /> Referral rewards remain available after signup.</p>
            </div>
            <div className="refined-access__faq">
              {quickAnswers.map((item, index) => (
                <details key={item.id} open={index === 0}>
                  <summary><span>{String(index + 1).padStart(2, "0")}</span>{item.question}<i aria-hidden="true" /></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="refined-access__form">
            <p>REQUEST ACCESS</p>
            <h3>Join the next beta group.</h3>
            <PixelWaitlist variant="hero" />
          </div>
        </Reveal>
      </section>
    </div>
  );
}
