import type { Metadata } from "next";
import { FounderConsole } from "@/components/build/FounderConsole";

export const metadata: Metadata = {
  title: "Founder build control",
  robots: { index: false, follow: false },
};

export default function FounderPage() {
  return (
    <article className="founder-page">
      <div className="container-narrow">
        <FounderConsole />
      </div>
    </article>
  );
}
