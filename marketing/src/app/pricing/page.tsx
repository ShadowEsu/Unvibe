import type { Metadata } from "next";
import { PricingHeadline } from "@/components/paper/PricingHeadline";
import { PricingPlans } from "@/components/redesign/PricingPlans";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { pricingCopy } from "@/lib/pricingCopy";

/** Re-read the API's payments status at most every 5 minutes (PAYMENTS_STATUS_REVALIDATE_SECONDS). */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Pricing", description: pricingCopy(await fetchPaymentsOpen()).description };
}

export default async function PricingPage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <article className="launch-subpage paper-pricing">
      <header className="paper-photo-band paper-photo-band--short">
        <img src="/hero/golden-gate.png" alt="" />
        <div className="paper-hero__veil" />
        <div className="paper-photo-band__copy">
          <p className="paper-meta">Pricing</p>
          <PricingHeadline />
        </div>
      </header>
      <section className="paper-section">
        <div className="paper-wrap">
          <PricingPlans paymentsOpen={paymentsOpen} />
        </div>
      </section>
    </article>
  );
}
