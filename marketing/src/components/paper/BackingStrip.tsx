import { compensationCreditsUsd, formatUsd } from "@/data/compensation";

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
          in startup-program subscriptions and credits. Credits are not cash and this is not a funding round.
        </p>
      </div>
    </section>
  );
}
