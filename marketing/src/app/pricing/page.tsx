import type { Metadata } from "next";
import { PricingHeadline } from "@/components/paper/PricingHeadline";
import { PricingPlans } from "@/components/redesign/PricingPlans";
import { PRICING } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: `Download Unvibe free. Pro is $${PRICING.proMonthly} a month or $${PRICING.proAnnual} a year. Lifetime is $${PRICING.proLifetime} once. Teams is a founding pilot at $${PRICING.teamsSeatMonthly} per seat per month.`,
};

export default function PricingPage() {
  return (
    <article className="launch-subpage paper-pricing">
      <header className="paper-photo-band paper-photo-band--short">
        <img src="/hero/golden-gate.png" alt="" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <PricingHeadline />
        </div>
      </header>
      <section className="paper-section">
        <div className="paper-wrap">
          <PricingPlans />
        </div>
      </section>
    </article>
  );
}
