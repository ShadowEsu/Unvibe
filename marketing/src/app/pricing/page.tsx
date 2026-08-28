import type { Metadata } from "next";
import { PricingHeadline } from "@/components/paper/PricingHeadline";
import { PricingPlans } from "@/components/redesign/PricingPlans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "You'll spend 15,000 hours+ on vibe coding. Make them count. Free is 30 explanations a month. Pro is $8 a month or $72 a year.",
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
