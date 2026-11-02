import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/contact";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = pageMetadata({
  path: "/refund",
  title: "Refund policy",
  description:
    "The Unvibe Pro refund policy: a full refund within 14 days of your first payment, and how to cancel.",
});

export default function RefundPage() {
  return (
    <LegalLayout
      title="Refund policy"
      updated="November 2026"
      intro="How refunds and cancellation work for Unvibe Pro. Unvibe is the seller."
    >
      <LegalSection heading="Refunds">
        <p>
          If you&apos;re not happy, email <a href={supportMailto}>{SUPPORT_EMAIL}</a> within 14
          days of your first payment for a full refund. After that, you can cancel any time and
          keep Pro until the end of the period you paid for; no partial refunds.
        </p>
      </LegalSection>

      <LegalSection heading="How to cancel">
        <p>Open the Plan page in the app and choose Manage billing.</p>
      </LegalSection>

      <LegalSection heading="How refunds arrive">
        <p>
          Refunds go to the original payment method. They arrive in about 5 to 10 business
          days.
        </p>
      </LegalSection>

      <LegalSection heading="Seller and contact">
        <p>
          The seller is Unvibe. Questions about a payment or a refund go to{" "}
          <a href={supportMailto}>{SUPPORT_EMAIL}</a>. The <a href="/terms">terms</a> cover
          payments and cancellation.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
