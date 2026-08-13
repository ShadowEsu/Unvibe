import Image from "next/image";
import {
  ArrowRight,
  Check,
  Command,
  Layers3,
  MousePointer2,
  Sparkles,
} from "lucide-react";
import { BrandLogos } from "@/components/BrandLogos";
import { Button } from "@/components/Button";
import { FounderClock } from "@/components/FounderClock";
import { FaqJsonLd } from "@/components/JsonLd";
import { MarketingVideo } from "@/components/MarketingVideo";
import { MobileBetaCta } from "@/components/MobileBetaCta";
import { ReleaseCountdown } from "@/components/ReleaseCountdown";
import { PixelWaitlist } from "@/components/redesign/PixelWaitlist";
import { Reveal } from "@/components/redesign/Reveal";
import { faqItems } from "@/data/faq";
import { milestones } from "@/data/milestones";

const quickAnswers = faqItems.filter((item) =>
  ["free", "beta", "screen", "generator", "accuracy"].includes(item.id),
);

const chapters = [
  {
    number: "01",
    label: "EXPLAIN IN PLACE",
    title: "Stay in the flow when the code stops feeling like yours.",
    copy: "Select the exact lines in Cursor or VS Code, press ⌘U, and get a focused explanation without rebuilding the project context in another chat.",
    image: "/product-shots/sign-in-carry-learning.png",
    alt: "Unvibe desktop learning layer beside a sign-in screen",
    tags: ["Selected code", "Five learning levels", "Project context"],
  },
  {
    number: "02",
    label: "CHECK THE MODEL",
    title: "Turn an explanation into something you can actually recall.",
    copy: "Ask a follow-up, request a different explanation, or let Unvibe build a quick check from the code you just reviewed.",
    image: "/product-shots/quiz-lessons-dark.png",
    alt: "Unvibe quiz interface with saved lessons",
    tags: ["Test me", "Recall", "Scenario questions"],
  },
  {
    number: "03",
    label: "KEEP THE KNOWLEDGE",
    title: "Your understanding becomes a system, not a disappearing chat.",
    copy: "Save lessons, revisit concepts, and see the code you can explain grow with every project you ship.",
    image: "/product-shots/progress-dark.png",
    alt: "Unvibe progress dashboard showing lines understood and learning activity",
    tags: ["Study history", "Concepts", "Learning streak"],
  },
] as const;

export default function Home() {
  const recentReleases = milestones.slice(0, 4);

  return (
    <div className="studio-home">
      <FaqJsonLd />

      <section className="studio-hero" id="product">
        <div className="studio-hero__texture" aria-hidden="true" />
        <div className="container-page studio-hero__inner">
          <div className="studio-hero__copy">
            <p className="studio-kicker"><span /> The learning layer after the agent</p>
            <h1>Vibe code freely.<br /><em>Stay fluent in what ships.</em></h1>
            <p className="studio-hero__lead">
              Unvibe turns AI-written code into explanations, questions, and a
              learning history—without pulling you out of the work.
            </p>
            <div className="studio-hero__actions">
              <Button href="#waitlist" size="lg">Join the private beta <ArrowRight size={17} /></Button>
              <a href="#studio-story">See how it works <span>↓</span></a>
            </div>
            <div className="studio-hero__proof">
              <span>MAC BETA</span>
              <span>CURSOR + VS CODE</span>
              <span>LOCAL SECRET FILTER</span>
            </div>
          </div>

          <div className="studio-hero__product">
            <div className="studio-window">
              <div className="studio-window__bar">
                <span><i /><i /><i /></span>
                <p>UNVIBE / LIVE PRODUCT</p>
                <small>60 SEC</small>
              </div>
              <MarketingVideo
                className="studio-window__video"
                src="/videos/unvibe-cursor-integration-2026.mp4"
                poster="/videos/unvibe-cursor-integration-2026-poster.jpg"
                label="Unvibe working beside Cursor: selected code becomes an explanation, a comprehension check, and retained learning"
                autoPlay
              />
            </div>
            <div className="studio-hero__note studio-hero__note--top"><Sparkles size={14} /> CONTEXT FOUND</div>
            <div className="studio-hero__note studio-hero__note--bottom">⌘U / EXPLAIN</div>
          </div>

          <div className="studio-loop" aria-label="The Unvibe learning loop">
            <span><MousePointer2 size={15} /> Select code</span><i />
            <span><Command size={15} /> Press U</span><i />
            <span><Layers3 size={15} /> Understand</span><i />
            <span><Check size={15} /> Keep it</span>
          </div>
        </div>
      </section>
      <MobileBetaCta />

      <section className="studio-manifesto">
        <Reveal className="container-page studio-manifesto__grid">
          <p>THE PROBLEM WITH VIBE CODING ISN&apos;T SPEED.</p>
          <h2>It&apos;s the quiet moment when the agent is done—and you can&apos;t explain what changed.</h2>
          <span>Unvibe owns that moment.</span>
        </Reveal>
      </section>

      <section className="studio-story" id="studio-story">
        <div className="container-page">
          <Reveal className="studio-section-head">
            <div><p>PRODUCT / THREE MOVES</p><h2>From generated<br /><em>to genuinely understood.</em></h2></div>
            <span>One shortcut starts a learning loop that stays useful after the chat disappears.</span>
          </Reveal>

          <div className="studio-chapters">
            {chapters.map((chapter, index) => (
              <Reveal className={`studio-chapter${index % 2 ? " studio-chapter--reverse" : ""}`} key={chapter.number}>
                <div className="studio-chapter__copy">
                  <p><span>{chapter.number}</span>{chapter.label}</p>
                  <h3>{chapter.title}</h3>
                  <div>{chapter.copy}</div>
                  <ul>{chapter.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>
                </div>
                <figure className="studio-chapter__visual">
                  <div className="studio-chapter__rail"><i /><span>UNVIBE</span><small>{chapter.number} / 03</small></div>
                  <Image src={chapter.image} alt={chapter.alt} fill sizes="(max-width: 900px) 100vw, 58vw" />
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="studio-workflow" id="integrations">
        <Reveal className="container-page studio-workflow__head">
          <div><p>THE LAYER, NOT THE DESTINATION</p><h2>Keep your tools.<br /><em>Add understanding.</em></h2></div>
          <p>Unvibe lives beside the editors and agents you already use. Cursor and VS Code are validated in the private beta; more workflows are in testing.</p>
        </Reveal>
        <BrandLogos className="studio-workflow__marquee" />
      </section>

      <section className="studio-proof" id="reviews">
        <Reveal className="container-page studio-proof__grid">
          <div className="studio-proof__intro">
            <p>PRIVATE BETA / UNFILTERED</p>
            <h2>Useful enough to miss when it&apos;s gone.</h2>
            <Button href="#waitlist" variant="secondary" size="sm">Join the next group <ArrowRight size={14} /></Button>
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

      <section className="studio-public" id="releases">
        <Reveal className="container-page studio-public__grid">
          <div className="studio-public__signal">
            <p>BUILDING IN PUBLIC</p>
            <h2>The product is still moving.</h2>
            <span>See the work, the hours, and what is shipping next.</span>
            <div><ReleaseCountdown /></div>
            <FounderClock breakdown />
          </div>
          <div className="studio-public__releases">
            <div className="studio-public__releases-head"><span>LATEST RELEASES</span><a href="/releases">View all <ArrowRight size={13} /></a></div>
            {recentReleases.map((release, index) => (
              <a href="/releases" key={`${release.date}-${release.title}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><small>{release.date} / {release.category}</small><h3>{release.title}</h3><p>{release.summary}</p></div>
                <ArrowRight size={16} />
              </a>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="studio-access" id="beta-access">
        <Reveal className="container-page studio-access__grid waitlist-minimal">
          <div className="studio-access__copy">
            <p>PRIVATE MAC BETA</p>
            <h2>AI wrote the code.<br /><em>Make the knowledge yours.</em></h2>
            <span>Request access in under a minute. No credit card. No provider API key.</span>
            <div className="studio-access__faq">
              {quickAnswers.map((item, index) => (
                <details key={item.id} open={index === 0}>
                  <summary><span>{String(index + 1).padStart(2, "0")}</span>{item.question}<i aria-hidden="true" /></summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="studio-access__form">
            <p>REQUEST ACCESS</p>
            <h3>Understand what you ship.</h3>
            <PixelWaitlist variant="hero" />
          </div>
        </Reveal>
      </section>
    </div>
  );
}
