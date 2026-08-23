import type { Metadata } from "next";
import { FounderAnalytics } from "@/components/FounderAnalytics";
import { FounderConsole } from "@/components/build/FounderConsole";

export const metadata: Metadata = {
  title: "Founder analytics",
  description: "Live aggregate traffic, waitlist, and beta-request numbers for Unvibe.",
  robots: { index: false, follow: false },
};

export default function FounderPage() {
  return (
    <article className="founder-page">
      <div className="paper-wrap">
        <FounderConsole />
        <FounderAnalytics />
      </div>
    </article>
  );
}
