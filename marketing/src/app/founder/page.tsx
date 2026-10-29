import type { Metadata } from "next";
import { FounderAnalytics } from "@/components/FounderAnalytics";
import { REPLAY_BLOCK_CLASS } from "@/lib/analyticsPrivacy";
import { FounderConsole } from "@/components/build/FounderConsole";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/founder",
    title: "Analytics",
    description: "Live aggregate traffic, waitlist, and beta-request numbers for Unvibe.",
  }),
  robots: { index: false, follow: false },
};

export default function FounderPage() {
  return (
    <article className={`founder-page ${REPLAY_BLOCK_CLASS}`}>
      <div className="paper-wrap">
        <FounderConsole />
        <FounderAnalytics />
      </div>
    </article>
  );
}
