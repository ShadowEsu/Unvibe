import type { Metadata } from "next";
import { AdminWaitlist } from "@/components/redesign/AdminWaitlist";
import { REPLAY_BLOCK_CLASS } from "@/lib/analyticsPrivacy";
import { pageMetadata } from "@/lib/pageMeta";

export const metadata: Metadata = {
  ...pageMetadata({ path: "/waitlist", title: "Waitlist", description: "Join the Unvibe waitlist." }),
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
