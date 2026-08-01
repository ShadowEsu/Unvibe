import type { Metadata } from "next";
import { PricingPlans } from "@/components/redesign/PricingPlans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start with Unvibe Free. Upgrade when you need broader project context.",
};

export default function PricingPage() {
  return (
    <article className="launch-subpage">
      <header className="container-page launch-subpage__hero">
        <p className="launch-label">Pricing</p>
        <h1>Start free.<br />Grow with your projects.</h1>
        <p>
          The private beta includes core code explanations. Pro is designed for the
          wider change: diffs, agent briefs, nearby files, and deeper context.
        </p>
      </header>
      <section className="container-page launch-pricing">
        <PricingPlans />
      </section>
      <section className="container-narrow launch-pricing__note">
        <p>
          Pricing is being validated during private beta. You will always see the
          final price before a paid plan begins.
        </p>
        <a href="/#waitlist">Join the private beta →</a>
      </section>
    </article>
  );
}
