import type { Metadata } from "next";
import { ReferralProgress } from "@/components/redesign/ReferralProgress";

export const metadata: Metadata = {
  title: "Referral rewards",
  description:
    "Check your Unvibe referral progress. When a friend joins with your link and their email was never referred before, you each get a month of Pro, for up to five friends.",
  robots: { index: false, follow: false },
};

export default function RewardsPage({ searchParams }: { searchParams: { ref?: string } }) {
  return <ReferralProgress initialCode={typeof searchParams.ref === "string" ? searchParams.ref : ""} />;
}
