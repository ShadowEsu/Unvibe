const sponsors = [
  { name: "Mixpanel", src: "/sponsors/mixpanel.svg", color: "#7856ff" },
  { name: "PostHog", src: "/sponsors/posthog.svg", color: "#f9bd2b" },
  { name: "Salesforce", src: "/sponsors/salesforce.svg", color: "#00a1e0" },
  { name: "GitLab", src: "/sponsors/gitlab.svg", color: "#fc6d26" },
  { name: "AWS", src: "/sponsors/aws.svg", color: "#ff9900" },
  { name: "Linear", src: "/sponsors/linear.svg", color: "#5e6ad2" },
  { name: "Google Cloud", src: "/sponsors/googlecloud.svg", color: "#4285f4" },
  { name: "OpenAI", src: "/sponsors/openai.svg", color: "#10a37f" },
  { name: "Deepgram", src: "/sponsors/deepgram.svg", color: "#13b981" },
  { name: "MongoDB", src: "/sponsors/mongodb.svg", color: "#47a248" },
] as const;

/** Compact homepage strip for startup-program subscriptions and credits. */
export function BackingStrip() {
  return (
    <section className="paper-section paper-backing" aria-label="Startup program support">
      <div className="paper-wrap paper-center">
        <p className="paper-backing__achievement">5× SmolStartup Startup of the Day</p>
        <p className="paper-backing__amount">$230,000+</p>
        <p className="paper-backing__lead">
          in startup-program subscriptions and credits. Credits are not cash and this is not a funding round.
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
                    role="img"
                    aria-label={sponsor.name}
                    key={`${copy}-${sponsor.name}`}
                  >
                    <span
                      className="paper-partners__logo"
                      style={{
                        backgroundColor: sponsor.color,
                        maskImage: `url(${sponsor.src})`,
                        WebkitMaskImage: `url(${sponsor.src})`,
                      }}
                      aria-hidden="true"
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
