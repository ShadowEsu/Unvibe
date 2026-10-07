import Image from "next/image";
import { compensationLines } from "@/data/compensation";

const sponsors = [
  { name: "Mixpanel", src: "/sponsors/mixpanel.svg" },
  { name: "PostHog", src: "/sponsors/posthog.svg" },
  { name: "Salesforce", src: "/sponsors/salesforce.svg" },
  { name: "GitLab", src: "/sponsors/gitlab.svg" },
  { name: "AWS", src: "/sponsors/aws.svg" },
  { name: "Linear", src: "/sponsors/linear.svg" },
  { name: "Google Cloud", src: "/sponsors/googlecloud.svg" },
  { name: "OpenAI", src: "/sponsors/openai.svg" },
  { name: "Deepgram", src: "/sponsors/deepgram.svg" },
  { name: "MongoDB", src: "/sponsors/mongodb.svg" },
] as const;

const credits = compensationLines.filter((line) => line.kind === "credits");
const namedSupport = [
  { match: "Claude", label: "Claude for Startups" },
  { match: "Mixpanel", label: "Mixpanel Pro" },
  { match: "PostHog", label: "PostHog" },
  { match: "GitLab", label: "GitLab Ultimate" },
  { match: "AWS", label: "AWS Activate" },
] as const;

function compactUsd(amount: number): string {
  const thousands = amount / 1_000;
  return `$${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
}

/** Compact homepage strip for startup-program subscriptions and credits. */
export function BackingStrip() {
  return (
    <section id="backing" className="paper-section paper-backing" aria-label="Startup program support">
      <div className="paper-wrap">
        <div className="claude-startups">
          <span className="claude-startups__tag">Startup program</span>
          <p className="claude-startups__title">Unvibe is in <em>Claude for Startups.</em></p>
          <p className="claude-startups__copy">Anthropic&apos;s program for early startups: API credits, Claude Team for a year, and partner perks worth about $21.5K to $23K.</p>
        </div>
      </div>
      <div className="paper-wrap paper-backing__layout">
        <div className="paper-backing__summary">
          <p className="paper-backing__achievement"><span aria-hidden="true">🏆</span> 5× SmolStartup Startup of the Day</p>
          <p className="paper-backing__amount">Startup credits</p>
          <p className="paper-backing__lead">Itemized program support, not a funding round</p>
          <p className="paper-backing__note">Credits and subscriptions only. Not cash. Mixpanel Pro is the largest line item at $144K for one year.</p>
        </div>
        <dl className="paper-backing__breakdown">
          {namedSupport.map(({ match, label }) => {
            const line = credits.find((item) => item.name.startsWith(match));
            return line ? (
              <div key={match}>
                <dt>{label}</dt>
                <dd>
                  <strong>{compactUsd(line.amountUsd)}</strong>
                  <span>{match === "Claude" ? "API credits, Claude Team for a year, partner perks" : line.detail}</span>
                </dd>
              </div>
            ) : null;
          })}
          <div>
            <dt>Other programs</dt>
            <dd>
              <strong>$9.2K</strong>
              <span>Linear, Google Cloud, OpenAI, Deepgram, and MongoDB</span>
            </dd>
          </div>
        </dl>
      </div>
      <div className="paper-partners" aria-label="Startup programs and company affiliations">
        <p className="paper-meta">Partnering with</p>
        <div className="paper-partners__viewport">
          <div className="paper-partners__track">
            {[0, 1].map((copy) => (
              <div className="paper-partners__group" aria-hidden={copy === 1} key={copy}>
                {sponsors.map((sponsor) => (
                  <span className="paper-partners__item" key={`${copy}-${sponsor.name}`}>
                    <Image
                      className={`paper-partners__logo paper-partners__logo--${sponsor.name.toLowerCase().replace(/\s+/g, "-")}`}
                      src={sponsor.src}
                      alt={sponsor.name}
                      width={72}
                      height={72}
                      loading="lazy"
                    />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
