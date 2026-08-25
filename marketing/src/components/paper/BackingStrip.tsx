import { compensationCreditsUsd, formatUsd } from "@/data/compensation";

const sponsors = [
  { name: "Mixpanel", src: "/sponsors/mixpanel.svg" },
  { name: "PostHog", src: "/sponsors/posthog.svg" },
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
  const credits = compensationCreditsUsd();
  const headline =
    credits >= 230_000 ? "$230,000+" : formatUsd(Math.floor(credits / 1000) * 1000) + "+";

  return (
    <section className="paper-section paper-backing" aria-label="Startup program support">
      <div className="paper-wrap paper-center">
        <p className="paper-backing__amount">{headline}</p>
        <p className="paper-backing__lead">
          in subscriptions and credits, backed and supported by these startup programs
        </p>
        <ul className="paper-backing__logos">
          {sponsors.map((sponsor) => (
            <li key={sponsor.name}>
              <img src={sponsor.src} alt="" width={22} height={22} />
              <span>{sponsor.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
