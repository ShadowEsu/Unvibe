import type { Metadata } from "next";
import { AdminWaitlist } from "@/components/redesign/AdminWaitlist";
import { REPLAY_BLOCK_CLASS } from "@/lib/analyticsPrivacy";

export const metadata: Metadata = {
  title: "Waitlist",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

/** Private founder view. Not linked from the public site. */
export default function WaitlistPage() {
  return (
    <div className={REPLAY_BLOCK_CLASS} style={{ display: "contents" }}>
      <AdminWaitlist />
    </div>
  );
}
