import type { Metadata } from "next";
import { PricingHeadline } from "@/components/paper/PricingHeadline";
import { PricingPlans } from "@/components/redesign/PricingPlans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Personal code understanding starts free. Pro is $10 a month, Pro Lifetime is $80 once, Teams is $8 per seat for 2–20 founding seats, and Enterprise starts at $199 a month.",
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
