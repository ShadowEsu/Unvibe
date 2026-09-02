import Image from "next/image";

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

/** Compact homepage strip for startup-program subscriptions and credits. */
export function BackingStrip() {
  return (
    <section className="paper-section paper-backing" aria-label="Startup program support">
      <div className="paper-wrap paper-center">
        <p className="paper-backing__achievement">5× SmolStartup Startup of the Day</p>
        <p className="paper-backing__amount">$144K Mixpanel Pro + $5K AWS</p>
        <p className="paper-backing__lead">
          Plus PostHog, GitLab, and other itemized startup-program credits. Program value—not cash or a funding round.
        </p>
      </div>
      <div className="paper-partners" aria-label="Startup programs and company affiliations">
        <p className="paper-meta">Partnering with</p>
        <div className="paper-partners__viewport">
          <div className="paper-partners__track">
            {[0, 1].map((copy) => (
              <div className="paper-partners__group" aria-hidden={copy === 1} key={copy}>
                {sponsors.map((sponsor) => (
                  <span
                    className="paper-partners__item"
                    key={`${copy}-${sponsor.name}`}
                  >
                    <Image className={`paper-partners__logo paper-partners__logo--${sponsor.name.toLowerCase().replace(/\s+/g, "-")}`} src={sponsor.src} alt={sponsor.name} width={72} height={72} loading="lazy" />
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
