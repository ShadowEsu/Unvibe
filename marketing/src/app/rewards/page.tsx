import type { Metadata } from "next";
import { ReferralProgress } from "@/components/redesign/ReferralProgress";

export const metadata: Metadata = {
  title: "Referral rewards",
  description:
    "Gift codes arrive with the next app update: when a friend signs in to the Unvibe app and enters your code, you each get a month of Pro, for up to five friends. Check how many friends joined with your invite link.",
  robots: { index: false, follow: false },
};

export default function RewardsPage({ searchParams }: { searchParams: { ref?: string } }) {
  return <ReferralProgress initialCode={typeof searchParams.ref === "string" ? searchParams.ref : ""} />;
}
