import { AI_MAINTENANCE, AI_MAINTENANCE_NOTE } from "@/lib/aiMaintenance";
import { FREE_MONTHLY_ALLOWANCE, PRO_MONTHLY_ALLOWANCE, SIGNED_OUT_ALLOWANCE } from "@/lib/allowance";
import { PRICING } from "@/lib/pricing";

/**
 * The home page's two-card price strip (Design W5): Free today, Pro's real price and that it is not on
 * sale yet. Pro has no button on purpose: nothing can be bought, and the download card follows.
 * Allowances come from lib/allowance (W7), prices from lib/pricing. While the AI outage switch is on,
 * the Try box's pause note sits under the strip, since its allowances are AI explanations (Security SHOULD-H3).
 * `paused` is the test seam for the build-time switch.
 */
export function HomePricing({ paused = AI_MAINTENANCE }: { paused?: boolean }) {
  return (
    <section className="paper-section" id="pricing" aria-labelledby="pricing-title">
      <div className="paper-wrap u-sheet">
        <div className="sec-head">
          <p className="paper-meta">Pricing</p>
          <h2 id="pricing-title">Free while in beta. <em>Pro opens soon.</em></h2>
          <p className="paper-lead">No card and no API key. Nothing is billed today.</p>
        </div>
        <div className="plans-strip">
          <div className="plans-strip__card">
            <p className="plans-strip__tag">Available now</p>
            <h3>Free</h3>
            <p className="plans-strip__price">$0</p>
            <p className="plans-strip__note">{SIGNED_OUT_ALLOWANCE}. Sign in for {FREE_MONTHLY_ALLOWANCE}.</p>
            <ul className="plans-strip__list">
              <li>Explain code you select in any app</li>
              <li>New, Beginner, Intermediate and Advanced</li>
              <li>Follow-ups and Test me</li>
              <li>Library, Today and Briefs, on your computer</li>
            </ul>
          </div>
          <div className="plans-strip__card plans-strip__card--pro">
            <p className="plans-strip__tag">Opens soon</p>
            <h3>Pro</h3>
            <p className="plans-strip__price">${PRICING.proMonthly} <small>a month, or ${PRICING.proAnnual} a year</small></p>
            <p className="plans-strip__note">Not on sale yet. Your Free plan keeps working until then.</p>
            <ul className="plans-strip__list">
              <li>Expert depth</li>
              <li>Answers that use nearby files</li>
              <li>AI explanations of your Git changes</li>
              <li>{PRO_MONTHLY_ALLOWANCE}</li>
            </ul>
          </div>
        </div>
        <p className="plans-strip__foot">
          Teams for {PRICING.teamsMinSeats} to {PRICING.teamsMaxSeats} seats also opens soon.{" "}
          <a className="paper-text-link" href="/pricing">See all plans</a>
        </p>
        {paused ? <p className="plans-strip__paused" role="status">{AI_MAINTENANCE_NOTE}</p> : null}
      </div>
    </section>
  );
}
