import type { Metadata } from "next";
import "./activate.css";

export const metadata: Metadata = {
  title: "Connect Unvibe",
  description: "Approve your desktop app and finish signing in with Google.",
  robots: { index: false, follow: false },
};

export default function ActivateLayout({ children }: { children: React.ReactNode }) {
  return <div className="activate-root">{children}</div>;
}
