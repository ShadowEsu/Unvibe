import { ArrowRight, Check, Clock3, ExternalLink } from "lucide-react";
import { BrandLogos } from "@/components/BrandLogos";
import { Button } from "@/components/Button";
import { FounderClock } from "@/components/FounderClock";
import { FaqJsonLd } from "@/components/JsonLd";
import { Section } from "@/components/Section";
import { Hero } from "@/components/sections/Hero";
import { HeroVideo } from "@/components/sections/HeroVideo";
import { ProductGallery } from "@/components/sections/ProductGallery";
import { PixelWaitlist } from "@/components/redesign/PixelWaitlist";

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

export default function Home() {
  return (
    <>
      <FaqJsonLd />
      <Hero />
      <section className="founder-build-section" aria-labelledby="founder-time-title">
        <div className="container-page founder-build-strip__inner">
          <div className="founder-build-strip__copy">
            <p><Clock3 size={16} aria-hidden="true" /> BUILDING IN PUBLIC</p>
            <h2 id="founder-time-title">Every hour behind Unvibe, counted.</h2>
            <span>Real founder build time, updated while the product is being worked on.</span>
          </div>
          <FounderClock prominent />
          <a href="/build" className="founder-build-strip__progress">
            <span><b>55%</b> to public beta</span>
            <i><em /></i>
            <small>See the live build log <ArrowRight size={13} /></small>
          </a>
        </div>
      </section>

      <BrandLogos />

      <Section
        eyebrow="See the real product"
        title="Select code. Press ⌘U. Learn what shipped."
        subtitle="A short demo of Unvibe working beside the tools you already use."
        centered
        variant="compact"
      >
        <HeroVideo />
      </Section>

      <ProductGallery />

      <Section
        id="feedback"
        eyebrow="Private beta comments"
        title="What early testers are saying."
        centered
        surface="alt"
      >
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
      </Section>

      <section className="listed-field" aria-labelledby="listed-title">
        <div className="container-page listed-field__heading">
          <div>
            <p>SEEN AROUND THE DEVELOPER COMMUNITY</p>
            <h2 id="listed-title">Unvibe is already out in the world.</h2>
          </div>
          <Button href="/#waitlist" size="sm">Join the beta <ArrowRight size={15} /></Button>
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

      <section className="simple-waitlist" id="access">
        <div className="container-page simple-waitlist__grid waitlist-minimal">
          <div className="simple-waitlist__copy">
            <p>PRIVATE MAC BETA</p>
            <h2>Learn the code you vibe-coded.</h2>
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
    </>
  );
}
