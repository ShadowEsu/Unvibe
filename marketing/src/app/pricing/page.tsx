import type { Metadata } from "next";
import { PricingPlans } from "@/components/redesign/PricingPlans";
import { DiaMotion } from "@/site/dia/motion/DiaMotion";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { pricingCopy } from "@/lib/pricingCopy";
import { OG_CARDS, pageMetadata } from "@/lib/pageMeta";

/** Re-read the API's payments status at most every 5 minutes (PAYMENTS_STATUS_REVALIDATE_SECONDS). */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: "/pricing",
    card: OG_CARDS.pricing,
    // True whether payments are open or not; the description follows paymentsOpen through pricingCopy.
    title: "Unvibe Pricing: Free, with Pro for Expert Depth",
    absolute: true,
    description: pricingCopy(await fetchPaymentsOpen()).description,
  });
}

/** Pricing in Option A: one heading, then the tier cards, white on white with 1 px edges. */
export default async function PricingPage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <div className="d d-page dp-page">
      <DiaMotion />
      <article className="dp" aria-labelledby="pricing-title">
        <PricingPlans paymentsOpen={paymentsOpen} />
      </article>
    </div>
  );
}
