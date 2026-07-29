import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { BrandLogos } from "@/components/BrandLogos";
import { Button } from "@/components/Button";
import { FounderClock } from "@/components/FounderClock";
import { HomeMotion } from "@/components/HomeMotion";
import { ReleaseCountdown } from "@/components/ReleaseCountdown";
import { HeroVideo } from "@/components/sections/HeroVideo";
import { DarkProductShowcase } from "@/components/sections/DarkProductShowcase";
import { PixelWaitlist } from "@/components/redesign/PixelWaitlist";
import { milestones } from "@/data/milestones";

const listings = [
  ["Product Hunt", "https://www.producthunt.com/products/unvibe?launch=unvibe"],
  ["LaunchKiwi", "https://launchkiwi.com/p/unvibe"],
  ["DevRove", "https://devrove.com/tools/unvibe-site"],
  ["DEV Community", "https://dev.to/preston_jaysusanto_22498/how-to-review-ai-generated-code-without-losing-ownership-of-your-project-ndl"],
  ["AI Tool Discovery", "https://www.aitooldiscovery.com/tools/aih_unvibe"],
  ["VibeRank", "https://viberank.dev/apps/Unvibe"],
  ["SideProjectors", "https://www.sideprojectors.com/project/86739/unvibe"],
  ["LaunchBuff", "https://launchbuff.com"],
] as const;

const highlights = [
  ["55%", "Public-beta roadmap", "Core product loop is live and under active testing."],
  ["10", "Milestones shipped", "Product, infrastructure, distribution, and company progress."],
  ["2", "Startup programs", "Google for Startups and MongoDB for Startups support."],
  ["12+", "Community channels", "Launch platforms, directories, articles, and developer communities."],
] as const;

export default function Home() {
  const recentReleases = milestones.slice(0, 4);

  return (
    <HomeMotion>
      <section className="cursor-hero" aria-labelledby="home-title">
        <div className="container-page cursor-hero__inner">
          <div className="cursor-hero__top" data-home-reveal>
            <div className="cursor-hero__copy">
              <p className="home-kicker"><span /> PRIVATE MAC BETA</p>
              <h1 id="home-title">Learn the AI-generated code you ship.</h1>
              <p>
                Select code in Cursor or VS Code, press ⌘U, and understand it
                without leaving your workflow.
              </p>
              <div className="cursor-hero__actions">
                <Button href="#waitlist" size="lg">Join the free beta</Button>
                <Button href="/beta" variant="secondary" size="lg">Download for macOS</Button>
              </div>
              <small>Free during private beta · No credit card · No separate AI key</small>
            </div>

            <aside className="cursor-hero__status" aria-label="Release and founder build status">
              <ReleaseCountdown />
              <div className="cursor-hero__founder">
                <FounderClock breakdown />
              </div>
            </aside>
          </div>

          <div className="cursor-hero__demo" data-home-reveal>
            <div className="cursor-hero__demo-label">
              <span>UNVIBE FOR MAC</span>
              <span>Select → ⌘U → Understand</span>
            </div>
            <HeroVideo />
          </div>
        </div>
      </section>

      <div data-home-reveal>
        <BrandLogos className="cursor-home__apps" />
      </div>
      <DarkProductShowcase />

      <section className="home-highlights" id="highlights" aria-labelledby="highlights-title" data-home-reveal>
        <div className="container-page">
          <div className="home-section-heading">
            <div>
              <p>BUILDING IN PUBLIC</p>
              <h2 id="highlights-title">Recent highlights</h2>
            </div>
          </div>
          <div className="home-highlight-grid">
            {highlights.map(([value, title, description]) => (
              <article key={title}>
                <strong>{value}</strong>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
          <a className="home-text-link" href="/build">See the public build record <ArrowRight size={15} /></a>
        </div>
      </section>

      <section className="home-releases" id="releases" aria-labelledby="releases-title" data-home-reveal>
        <div className="container-page">
          <div className="home-section-heading">
            <div>
              <p>PRODUCT RECORD</p>
              <h2 id="releases-title">Latest releases</h2>
            </div>
            <a className="home-text-link" href="/releases">All releases <ArrowRight size={15} /></a>
          </div>
          <div className="home-release-grid">
            {recentReleases.map((release) => (
              <a href="/releases" key={`${release.date}-${release.title}`}>
                <span><time>{release.date}</time><em>{release.category}</em></span>
                <h3>{release.title}</h3>
                <p>{release.summary}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="home-feedback" id="feedback" aria-labelledby="feedback-title" data-home-reveal>
        <div className="container-page">
          <div className="home-section-heading">
            <div>
              <p>PRIVATE BETA</p>
              <h2 id="feedback-title">Early feedback</h2>
            </div>
          </div>
          <div className="beta-comments">
            <blockquote>
              <p>“For what Unvibe is right now, it&apos;s genuinely impressive. The explanation depth and customization feel creative.”</p>
              <footer><strong>Om Anand Khaunte</strong><span>High school developer · Officer, Los Altos Hacks</span></footer>
            </blockquote>
            <blockquote>
              <p>“The setup was smooth, and the dynamic-island idea could become a great feature with a little fine-tuning.”</p>
              <footer><strong>Private beta feedback</strong><span>Product experience survey</span></footer>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="listed-field" aria-labelledby="listed-title" data-home-reveal>
        <div className="container-page listed-field__heading">
          <div>
            <p>AROUND THE DEVELOPER COMMUNITY</p>
            <h2 id="listed-title">Already out in the world.</h2>
          </div>
          <Button href="#waitlist" size="sm">Join the beta <ArrowRight size={15} /></Button>
        </div>
        <div className="listing-marquee" aria-label="Places where Unvibe is listed">
          <div className="listing-marquee__track">
            {[0, 1].map((copy) => (
              <div className="listing-marquee__group" aria-hidden={copy === 1} key={copy}>
                {listings.map(([name, href]) => (
                  <a key={`${copy}-${name}`} href={href} target="_blank" rel="noopener noreferrer" tabIndex={copy === 1 ? -1 : undefined}>
                    <Check size={14} /> {name} <ExternalLink size={13} />
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="simple-waitlist" id="access" data-home-reveal>
        <div className="container-page simple-waitlist__grid waitlist-minimal">
          <div className="simple-waitlist__copy">
            <p>PRIVATE MAC BETA</p>
            <h2>Know what you ship.</h2>
            <span>Join the private beta. No credit card and no separate AI provider key required.</span>
            <ul>
              <li><Check size={16} />Selected-code explanations</li>
              <li><Check size={16} />Saved learning and quick checks</li>
              <li><Check size={16} />Cursor and VS Code workflow</li>
            </ul>
          </div>
          <PixelWaitlist variant="hero" />
        </div>
      </section>
    </HomeMotion>
  );
}
