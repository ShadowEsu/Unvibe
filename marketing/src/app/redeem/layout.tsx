import type { Metadata } from "next";
import "./redeem.css";

export const metadata: Metadata = {
  title: "Redeem a promo code",
  description: "Sign in and add the Pro months from your promo code to your Unvibe account.",
  robots: { index: false, follow: false },
};

export default function RedeemLayout({ children }: { children: React.ReactNode }) {
  return <div className="redeem-root">{children}</div>;
}
