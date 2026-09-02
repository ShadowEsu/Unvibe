import type { Metadata } from "next";
import { PricingHeadline } from "@/components/paper/PricingHeadline";
import { PricingPlans } from "@/components/redesign/PricingPlans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Personal code understanding starts free. Pro is $15 a month, Teams is $15 per seat, and Enterprise is $500 a month including 20 seats.",
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
