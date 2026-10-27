import type { Metadata } from "next";
import { PricingPlans } from "@/components/redesign/PricingPlans";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { FAIR_USE, pricingCopy } from "@/lib/pricingCopy";

/** Re-read the API's payments status at most every 5 minutes (PAYMENTS_STATUS_REVALIDATE_SECONDS). */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Pricing", description: pricingCopy(await fetchPaymentsOpen()).description };
}

/** One heading, then the tier cards: the first viewport answers "how much" at 1440 and on a phone. The written fair-use limit follows. */
export default async function PricingPage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <article className="launch-subpage paper-pricing">
      <section className="paper-section" aria-labelledby="pricing-title">
        <div className="paper-wrap">
          <PricingPlans paymentsOpen={paymentsOpen} />
        </div>
      </section>
      <section id="fair-use" className="paper-section pricing-fair-use" aria-labelledby="fair-use-title">
        <div className="paper-wrap">
          <h2 id="fair-use-title">{FAIR_USE.heading}</h2>
          <p>{FAIR_USE.limit}</p>
          <p>{FAIR_USE.enforcement}</p>
        </div>
      </section>
    </article>
  );
}
