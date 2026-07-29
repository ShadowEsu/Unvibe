import {
  ArrowDown,
  ArrowRight,
  Check,
  Code2,
  Command,
  History,
  MousePointer2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/Button";
import { FaqJsonLd } from "@/components/JsonLd";
import { PixelWaitlist } from "@/components/redesign/PixelWaitlist";
import { ProductLoop } from "@/components/redesign/ProductLoop";
import { Reveal } from "@/components/redesign/Reveal";
import { ToolOrbit } from "@/components/redesign/ToolOrbit";
import { faqItems } from "@/data/faq";

const distribution = [
  { name: "LaunchKiwi", href: "https://launchkiwi.com/p/unvibe" },
  { name: "DevRove", href: "https://devrove.com/tools/unvibe-site" },
  {
    name: "DEV Community",
    href: "https://dev.to/preston_jaysusanto_22498/how-to-review-ai-generated-code-without-losing-ownership-of-your-project-ndl",
  },
  {
    name: "Product Hunt",
    href: "https://www.producthunt.com/products/unvibe?launch=unvibe",
  },
  {
    name: "AI Tool Discovery",
    href: "https://www.aitooldiscovery.com/tools/aih_unvibe",
  },
  { name: "VibeRank", href: "https://viberank.dev/apps/Unvibe" },
  { name: "SideProjectors", href: "https://www.sideprojectors.com/project/86739/unvibe" },
  { name: "LaunchBuff", href: "https://launchbuff.com" },
];

const quickAnswers = faqItems.filter((item) =>
  ["free", "pro-annual", "beta", "cancel"].includes(item.id),
);

export default function Home() {
  return (
    <>
      <FaqJsonLd />

      <section className="editorial-hero" id="product">
        <div className="editorial-hero__grid" aria-hidden="true" />
        <div className="editorial-hero__orb editorial-hero__orb--one" aria-hidden="true" />
        <div className="editorial-hero__orb editorial-hero__orb--two" aria-hidden="true" />
        <Reveal className="container-page editorial-hero__inner">
          <p className="editorial-eyebrow"><span /> Private Mac beta</p>
          <h1>
            <span>Vibe code freely.</span>
            <em>Learn what you ship.</em>
          </h1>
          <p className="editorial-hero__lead">
            Unvibe teaches you the vibe-coded code you are responsible for
            shipping—so you can understand, review, and maintain it.
          </p>
          <div className="editorial-hero__actions">
            <Button href="#waitlist" size="lg">
              Request beta access <ArrowRight size={18} />
            </Button>
            <Button href="#how-it-works" size="lg" variant="secondary">
              See how it works <ArrowDown size={17} />
            </Button>
          </div>
          <div className="editorial-hero__status">
            <a href="/build"><i /> 55% to public beta</a>
            <span>160+ founder hours</span>
            <span>Cursor + VS Code</span>
            <span>No provider key required</span>
          </div>
        </Reveal>
      </section>

      <section className="editorial-demo" id="how-it-works">
        <Reveal className="container-page">
          <div className="editorial-heading editorial-heading--ink">
            <p>01 / ONE QUIET LOOP</p>
            <h2>The review step <em>your agent skips.</em></h2>
            <span>Select the code, press ⌘U, and return to building with the context in your head.</span>
          </div>
          <ProductLoop />
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
            <p>02 / YOUR PROJECT, REMEMBERED</p>
            <h2>Understanding that stays <em>after the prompt disappears.</em></h2>
            <span>
              Each review can become a saved lesson, a short check, and a useful
              trail of what you actually understand.
            </span>
          </div>
          <div className="editorial-learning__cards">
            <article><Code2 size={20} /><small>EXPLAIN</small><strong>What changed, why it matters, and what connects.</strong></article>
            <article><ShieldCheck size={20} /><small>VERIFY</small><strong>One comprehension check grounded in your code.</strong></article>
            <article><History size={20} /><small>REMEMBER</small><strong>History, study, and progress built from real reviews.</strong></article>
          </div>
        </Reveal>
      </section>

      <section className="editorial-integrations" id="integrations">
        <Reveal className="container-page">
          <div className="editorial-heading editorial-heading--light">
            <p>03 / WHEREVER YOU VIBE-CODE</p>
            <h2>Beside your tools.<br /><em>Not another place to work.</em></h2>
            <span>Unvibe follows the project across the workflow you already use.</span>
          </div>
          <ToolOrbit />
          <p className="editorial-disclosure">
            Cursor and VS Code are validated in the private beta. Other names describe
            workflow compatibility or active testing, not partnerships.
          </p>
        </Reveal>
      </section>

      <section className="editorial-proof">
        <Reveal className="container-page editorial-proof__grid">
          <div>
            <p>04 / EARLY SIGNAL</p>
            <blockquote>
              “For what Unvibe is right now, it&apos;s genuinely impressive. The
              explanation depth and customization feel creative.”
            </blockquote>
            <footer>Om Khaunte <span>· Officer, Los Altos Hacks</span></footer>
          </div>
          <aside>
            <p>Startup support</p>
            <strong>Google for Startups</strong>
            <strong>MongoDB for Startups</strong>
            <strong>Founder-funded</strong>
            <small>Program support and founder funding—not institutional investment or endorsement.</small>
          </aside>
        </Reveal>
        <div className="editorial-discovery" aria-label="Places where Unvibe is listed">
          <div className="editorial-discovery__track">
            {[0, 1].map((copy) => (
              <div className="editorial-discovery__group" aria-hidden={copy === 1} key={copy}>
                {distribution.map((item) => (
                  <a
                    key={`${copy}-${item.name}`}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabIndex={copy === 1 ? -1 : undefined}
                  >
                    <i /> {item.name} <ArrowRight size={13} />
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="editorial-access" id="access">
        <Reveal className="container-page editorial-access__grid waitlist-minimal">
          <div className="editorial-access__faq">
            <p className="editorial-access__label">05 / BEFORE YOU REQUEST ACCESS</p>
            <h2>Quick answers.<br /><em>Then come build.</em></h2>
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
            <h3>Teach yourself what you shipped.</h3>
            <span>Request access in under a minute. No credit card.</span>
            <PixelWaitlist variant="hero" />
          </div>
        </Reveal>
      </section>
    </>
  );
}
