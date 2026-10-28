import type { Metadata } from "next";
import { PricingPlans } from "@/components/redesign/PricingPlans";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { pricingCopy } from "@/lib/pricingCopy";

/** Re-read the API's payments status at most every 5 minutes (PAYMENTS_STATUS_REVALIDATE_SECONDS). */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Pricing",
    description: pricingCopy(await fetchPaymentsOpen()).description,
    alternates: { canonical: "/pricing" },
  };
}

/** One heading, then the tier cards: the first viewport answers "how much" at 1440 and on a phone. */
export default async function PricingPage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <article className="launch-subpage paper-pricing">
      <section className="paper-section" aria-labelledby="pricing-title">
        <div className="paper-wrap">
          <PricingPlans paymentsOpen={paymentsOpen} />
        </div>
      </section>
    </article>
  );
}
