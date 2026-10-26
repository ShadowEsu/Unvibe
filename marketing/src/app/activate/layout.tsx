import type { Metadata } from "next";
import { REPLAY_BLOCK_CLASS } from "@/lib/analyticsPrivacy";
import "./activate.css";

export const metadata: Metadata = {
  title: "Connect Unvibe",
  description: "Approve your desktop app and finish signing in with Google.",
  robots: { index: false, follow: false },
};

/** The page holds a sign-in session: its content is left out of any replay (see REPLAY_BLOCK_CLASS). */
export default function ActivateLayout({ children }: { children: React.ReactNode }) {
  return <div className={`activate-root ${REPLAY_BLOCK_CLASS}`}>{children}</div>;
}
