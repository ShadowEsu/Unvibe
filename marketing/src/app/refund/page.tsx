import type { Metadata } from "next";
import { LegalLayout, LegalSection } from "@/components/LegalLayout";
import { SUPPORT_EMAIL, supportMailto } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Refund policy",
  description:
    "How refunds and cancellation work for Unvibe Pro: a full refund within 14 days of a charge, and cancel any time.",
};

export default function RefundPage() {
  return (
    <LegalLayout
      title="Refund policy"
      updated="October 2026"
      intro="How refunds and cancellation work for Unvibe Pro. Free use needs no card, so there is nothing to refund on the Free plan."
    >
      <LegalSection heading="Full refund within 14 days of a charge">
        <p>
          If Unvibe Pro isn&apos;t working for you, email{" "}
          <a href={supportMailto}>{SUPPORT_EMAIL}</a> within 14 days of a charge and we&apos;ll
          refund that charge in full. No questions asked, once per customer.
        </p>
      </LegalSection>

      <LegalSection heading="Cancel any time">
        <p>
          You can cancel at any time with Manage billing on the Plan page in the app. You keep
          Pro until the end of the period you paid for, and you won&apos;t be charged again.
          After the 14 days, we don&apos;t give partial refunds for unused time, except where the
          law requires it.
        </p>
      </LegalSection>

      <LegalSection heading="If we can't deliver">
        <p>
          If Unvibe can&apos;t deliver what you paid for, for example an outage that stops
          explanations for days, tell us and we&apos;ll refund.
        </p>
      </LegalSection>

      <LegalSection heading="How refunds arrive">
        <p>
          Refunds go back to the original payment method and usually take 5 to 10 business
          days to appear. The <a href="/terms">terms</a> cover payments and cancellation.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
