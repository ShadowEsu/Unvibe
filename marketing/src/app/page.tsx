import {
  ArrowRight,
  Check,
  Command,
  Download,
  MousePointer2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/Button";
import { PixelWaitlist } from "@/components/redesign/PixelWaitlist";
import { ProductLoop } from "@/components/redesign/ProductLoop";
import { Reveal } from "@/components/redesign/Reveal";
import { ToolOrbit } from "@/components/redesign/ToolOrbit";

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

export default function Home() {
  return (
    <>
      <section className="launch-hero" id="product">
        <div className="launch-ambient" aria-hidden="true" />
        <Reveal className="container-page launch-hero__inner">
          <div className="launch-kicker">
            <span className="launch-kicker__dot" />
            Your vibe-code tutor · private Mac beta
          </div>
          <h1>Learn the project<br />you vibe-coded.</h1>
          <p className="launch-hero__lead">
            Select code. Press <kbd>⌘U</kbd>. Unvibe teaches you what AI shipped.
          </p>
          <div className="launch-hero__actions">
            <Button href="/beta" size="lg">
              <Download size={17} /> Download beta
            </Button>
            <Button href="#waitlist" size="lg" variant="secondary">
              Join the waitlist
            </Button>
          </div>
          <p className="launch-hero__note">
            macOS · Cursor + VS Code · no provider key required
          </p>

          <div className="launch-product">
            <ProductLoop />
          </div>
        </Reveal>
      </section>

      <section className="launch-section launch-section--quiet" id="how-it-works">
        <Reveal className="container-page">
          <div className="launch-section__intro">
            <p>One quiet loop</p>
            <h2>Review without leaving your flow.</h2>
          </div>
          <div className="launch-steps">
            <article>
              <span>01</span>
              <MousePointer2 size={21} />
              <h3>Select</h3>
              <p>Highlight the code you need to own.</p>
            </article>
            <article>
              <span>02</span>
              <Command size={21} />
              <h3>Understand</h3>
              <p>Press ⌘U for a focused explanation.</p>
            </article>
            <article>
              <span>03</span>
              <Check size={21} />
              <h3>Keep it</h3>
              <p>Ask, test, save, and continue building.</p>
            </article>
          </div>
        </Reveal>
      </section>

      <section className="launch-section launch-section--deep">
        <Reveal className="container-page">
          <div className="launch-section__intro launch-section__intro--split">
            <div>
              <p>Everywhere you vibe-code</p>
              <h2>One shortcut.<br />Your tools keep moving.</h2>
            </div>
            <p className="launch-section__copy">
              Unvibe sits beside the project you already built with Cursor, VS Code,
              Claude Code, a terminal, or another IDE. It teaches instead of replacing
              your workflow.
            </p>
          </div>
          <ToolOrbit />
          <p className="launch-disclosure">
            Tool names describe compatibility only and do not imply partnerships.
          </p>
        </Reveal>
      </section>

      <section className="launch-section launch-section--proof">
        <Reveal className="container-page proof-grid">
          <div className="proof-quote">
            <p>Private beta feedback</p>
            <blockquote>
              “For what Unvibe is right now, it&apos;s genuinely impressive. The
              explanation depth and customization feel creative.”
            </blockquote>
            <footer>
              Om Khaunte <span>· Officer, Los Altos Hacks</span>
            </footer>
          </div>
          <div className="proof-support">
            <p>Early startup support</p>
            <div>
              <span>Google for Startups</span>
              <span>MongoDB for Startups</span>
              <span>Founder-funded</span>
            </div>
            <small>
              Program participation and committed support; not an endorsement or a
              claim of institutional investment.
            </small>
          </div>
        </Reveal>
      </section>

      <section className="launch-section launch-section--discover">
        <Reveal className="container-page discover-layout">
          <div>
            <p className="launch-label">Find Unvibe</p>
            <h2>Listed where developers discover new tools.</h2>
          </div>
          <div className="discovery-marquee" aria-label="Places where Unvibe is listed">
            <div className="discovery-marquee__track">
              {[0, 1].map((copy) => (
                <div className="discovery-marquee__group" aria-hidden={copy === 1} key={copy}>
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
        </Reveal>
      </section>

      <section className="launch-section launch-section--waitlist">
        <div className="container-page waitlist-minimal">
          <Reveal>
            <p className="launch-label">Private beta</p>
            <h2>Teach yourself what you shipped.</h2>
            <p>
              Join the Mac beta and help shape the fastest path from generated code
              to real understanding.
            </p>
            <div className="waitlist-trust">
              <span><ShieldCheck size={15} /> Selected context only</span>
              <span>No credit card</span>
              <span>Gradual invitations</span>
            </div>
          </Reveal>
          <Reveal>
            <PixelWaitlist variant="hero" />
          </Reveal>
        </div>
      </section>
    </>
  );
}
