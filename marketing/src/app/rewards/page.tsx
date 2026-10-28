import type { Metadata } from "next";
import { ReferralProgress } from "@/components/redesign/ReferralProgress";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/rewards",
    title: "Referral rewards",
    description:
      "When a friend signs in to the Unvibe app (version 0.1.44 or later) and enters your gift code, you each get a month of Pro, for up to five friends. Check how many friends joined with your invite link.",
  }),
  robots: { index: false, follow: false },
};

export default function RewardsPage({ searchParams }: { searchParams: { ref?: string } }) {
  return <ReferralProgress initialCode={typeof searchParams.ref === "string" ? searchParams.ref : ""} />;
}
