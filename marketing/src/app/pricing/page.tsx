import type { Metadata } from "next";
import { PricingPlans } from "@/components/redesign/PricingPlans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Free is 50 explanations a month. Pro is $8 a month or $72 a year. Team and Enterprise are priced and coming soon.",
};

export default function PricingPage() {
  return (
    <article className="launch-subpage paper-pricing">
      <header className="paper-photo-band paper-photo-band--short">
        <img src="/hero/golden-gate.png" alt="" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Pricing</p>
          <h1>Start free.</h1>
          <p>Private beta. Free and Pro are open on the waitlist. Team and Enterprise are priced, and coming soon.</p>
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
