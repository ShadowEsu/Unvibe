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

/**
 * Homepage trust strip: the startup programs Unvibe is in. Credit amounts live on /investors;
 * these are programs, not partnerships, so the label says so.
 */
export function BackingStrip() {
  return (
    <section id="backing" className="paper-section paper-backing" aria-label="Startup programs">
      <div className="paper-wrap">
        <div className="claude-startups">
          <span className="claude-startups__tag">Startup program</span>
          <p className="claude-startups__title">Unvibe is in <em>Claude for Startups.</em></p>
          <p className="claude-startups__copy">Anthropic&apos;s program for early startups. Credit details are on the <a href="/investors">investors page</a>.</p>
        </div>
      <div className="paper-partners" aria-label="Startup programs Unvibe is in">
        <p className="paper-meta">Also in the startup programs of</p>
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
      </div>
    </section>
  );
}
