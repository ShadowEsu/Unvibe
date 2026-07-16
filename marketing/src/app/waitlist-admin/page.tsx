import type { Metadata } from "next";
import { AdminWaitlist } from "@/components/redesign/AdminWaitlist";

export const metadata: Metadata = {
  title: "Waitlist admin",
  robots: { index: false, follow: false, noarchive: true },
};

export default function WaitlistAdminPage() {
  return <AdminWaitlist />;
}
