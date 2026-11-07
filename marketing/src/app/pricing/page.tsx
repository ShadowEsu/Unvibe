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

/**
 * Direction D pricing (plan mock 10; ANIMATIONS #31): one heading, then the tier cards. Hovering or focusing the Pro
 * card fades Van Gogh's Irises in full-bleed behind the page (public domain, credited while it shows) and the heading
 * turns white over a soft scrim; leaving restores the page. Visual only: no button changes what it does.
 */
export default async function PricingPage() {
  const paymentsOpen = await fetchPaymentsOpen();
  return (
    <div className="d d-page dp-page" data-d-bgswap-root="">
      <DiaMotion />
      <div className="dp__bg" data-d-bgswap="" aria-hidden="true" />
      <p className="dp__credit" data-d-bgswap="" aria-hidden="true">Irises, Vincent van Gogh, 1889 · public domain</p>
      <article className="dp" aria-labelledby="pricing-title">
        <PricingPlans paymentsOpen={paymentsOpen} />
      </article>
    </div>
  );
}
