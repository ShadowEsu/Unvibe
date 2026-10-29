import type { Metadata } from "next";
import { REPLAY_BLOCK_CLASS } from "@/lib/analyticsPrivacy";
import { pageMetadata } from "@/lib/pageMeta";
import "./redeem.css";

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/redeem",
    title: "Redeem a promo code",
    description: "Sign in and add the Pro months from your promo code to your Unvibe account.",
  }),
  robots: { index: false, follow: false },
};

/** The page holds a sign-in session: its content is left out of any replay (see REPLAY_BLOCK_CLASS). */
export default function RedeemLayout({ children }: { children: React.ReactNode }) {
  return <div className={`redeem-root ${REPLAY_BLOCK_CLASS}`}>{children}</div>;
}
