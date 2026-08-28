import type { Metadata } from "next";
import { FounderAnalytics } from "@/components/FounderAnalytics";

export const metadata: Metadata = {
  title: "Founder analytics",
  description: "Live aggregate traffic, waitlist, and beta-request numbers for Unvibe.",
  robots: { index: false, follow: false },
};

export default function StatsPage() {
  return (
    <article className="founder-page">
      <div className="container-wide">
        <FounderAnalytics />
      </div>
    </article>
  );
}
