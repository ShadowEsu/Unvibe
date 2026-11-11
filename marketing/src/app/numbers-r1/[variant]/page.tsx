import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Home } from "@/site/dia/Home";
import type { NumbersVariant } from "@/site/dia/NumbersR1";
import { D_FAQ } from "@/site/dia/content";
import { faqItems } from "@/data/faq";
import { fetchPaymentsOpen } from "@/lib/paymentsStatus";
import { pricingCopy } from "@/lib/pricingCopy";
import "@/site/dia/numbers-r1.css";

/**
 * Ledger 598 previews: the homepage with one of the three "Unvibe in numbers" candidates in place of the live section
 * (/numbers-r1/n1, /n2, /n3). Not indexed, not linked; removed once Preston has picked in Slack and the pick is built
 * into the homepage proper.
 */
const VARIANTS: readonly NumbersVariant[] = ["n1", "n2", "n3"];

export const metadata: Metadata = {
  title: "Unvibe in numbers: preview",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#4b2fc0" };
export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return VARIANTS.map((variant) => ({ variant }));
}

const homeFaq = D_FAQ.ids.flatMap((id) => faqItems.filter((item) => item.id === id));

export default async function NumbersPreviewPage({ params }: { params: { variant: string } }) {
  const variant = VARIANTS.find((v) => v === params.variant);
  if (!variant) notFound();
  const copy = pricingCopy(await fetchPaymentsOpen());
  return <Home copy={copy} faq={homeFaq.map(({ id, question, answer }) => ({ id, question, answer }))} numbers={variant} />;
}
