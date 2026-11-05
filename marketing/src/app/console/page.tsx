import type { Metadata } from "next";
import { ConsoleAnalytics } from "@/components/ConsoleAnalytics";
import { REPLAY_BLOCK_CLASS } from "@/lib/analyticsPrivacy";
import { BuildClockConsole } from "@/components/build/BuildClockConsole";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/console",
    title: "Analytics",
    description: "Live aggregate traffic, waitlist, and beta-request numbers for Unvibe.",
  }),
  robots: { index: false, follow: false },
};

export default function ConsolePage() {
  return (
    <article className={`console-page ${REPLAY_BLOCK_CLASS}`}>
      <div className="paper-wrap">
        <BuildClockConsole />
        <ConsoleAnalytics />
      </div>
    </article>
  );
}
