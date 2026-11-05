import { AI_MAINTENANCE, AI_MAINTENANCE_NOTE } from "@/lib/aiMaintenance";
import { FREE_MONTHLY_ALLOWANCE, PRO_MONTHLY_ALLOWANCE, SIGNED_OUT_ALLOWANCE } from "@/lib/allowance";
import { PRICING } from "@/lib/pricing";
import { Arrive } from "@/components/paper/Arrive";
import { CountUp } from "@/components/paper/CountUp";
import { DownloadLink } from "@/components/paper/DownloadLink";
import { Vibe } from "@/components/paper/Vibe";

/**
 * The home page's two plans (Design W5, laid out as Design N): Free today, raised, with the download; Pro's real
 * price and that it is not on sale yet, level. Pro has no button on purpose: nothing can be bought. $9 and $81
 * count up once when they scroll into view; the text and the accessibility tree always hold the real price.
 * Allowances come from lib/allowance (W7), prices from lib/pricing. While the AI outage switch is on, the Try
 * box's pause note sits under the plans, since its allowances are AI explanations (Security SHOULD-H3).
 * `paused` is the test seam for the build-time switch.
 */
export function HomePricing({ paused = AI_MAINTENANCE }: { paused?: boolean }) {
  return (
    <section className="n-sec n-wrap n-center nprice" id="pricing" aria-labelledby="pricing-title">
      <Arrive className="n-head n-center">
        <Vibe size={56} />
        <h2 id="pricing-title">Free while in beta. Pro opens soon.</h2>
        <p className="n-lead">No card and no API key.</p>
      </Arrive>
      <Arrive className="nprice__plans">
        <div className="nprice__plan nprice__plan--on">
          <p className="nprice__tag">Available now</p>
          <h3>Free</h3>
          <p className="nprice__price">$0</p>
          <DownloadLink href="/beta" surface="pricing" className="nprice__get" />
          <hr />
          <p className="n-note">{SIGNED_OUT_ALLOWANCE}. Sign in for {FREE_MONTHLY_ALLOWANCE}.</p>
        </div>
        <div className="nprice__plan">
          <p className="nprice__tag">Opens soon</p>
          <h3>Pro</h3>
          <p className="nprice__price">
            $<CountUp name="home-pro-month" value={PRICING.proMonthly} />
            <span className="nprice__unit"> a month, or $<CountUp name="home-pro-year" value={PRICING.proAnnual} /> a year</span>
          </p>
          <hr />
          <p className="n-note">Not on sale yet. Your Free plan keeps working until then. Expert depth, answers that use nearby files, AI explanations of your Git changes and {PRO_MONTHLY_ALLOWANCE}.</p>
        </div>
      </Arrive>
      <p className="n-note nprice__teams">Teams for {PRICING.teamsMinSeats} to {PRICING.teamsMaxSeats} seats also opens soon.</p>
      <a className="nprice__all" href="/pricing">See all plans</a>
      {paused ? <p className="n-note nprice__paused" role="status">{AI_MAINTENANCE_NOTE}</p> : null}
    </section>
  );
}
