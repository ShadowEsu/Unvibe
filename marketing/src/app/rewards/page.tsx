import type { Metadata } from "next";
import { ReferralProgress } from "@/components/redesign/ReferralProgress";

export const metadata: Metadata = {
  title: "Private beta rewards",
  description: "Check your Unvibe private beta referral progress.",
  robots: { index: false, follow: false },
};

export default function RewardsPage({ searchParams }: { searchParams: { ref?: string } }) {
  return <ReferralProgress initialCode={typeof searchParams.ref === "string" ? searchParams.ref : ""} />;
}
