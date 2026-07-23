import type { Metadata } from "next";
import { AdminWaitlist } from "@/components/redesign/AdminWaitlist";

export const metadata: Metadata = {
  title: "Waitlist",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

/** Private founder view. Not linked from the public site. */
export default function WaitlistPage() {
  return <AdminWaitlist />;
}
