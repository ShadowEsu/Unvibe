import type { Metadata } from "next";
import { ArrowRight, Check, Gift } from "lucide-react";

export const metadata: Metadata = {
  title: "You’re on the private beta list",
  description: "Your Unvibe private beta request has been received.",
  robots: { index: false, follow: false },
};

export default function ThanksPage({ searchParams }: { searchParams: { ref?: string } }) {
  const rewardUrl = searchParams.ref ? `/rewards?ref=${encodeURIComponent(searchParams.ref)}` : "/#reviews";

  return (
    <article className="launch-subpage thanks-page">
      <header className="container-narrow launch-subpage__hero thanks-page__hero">
        <span className="thanks-page__mark"><Check size={22} aria-hidden="true" /></span>
        <p className="launch-label">Private beta</p>
        <h1>You&apos;re on the list.</h1>
        <p>
          Check your inbox for the next step. We&apos;ll send access as the private beta opens to more builders.
        </p>
        <div className="thanks-page__actions">
          <a href="/#how-it-works">Watch the demo <ArrowRight size={16} /></a>
          <a href={rewardUrl}><Gift size={16} /> Referral rewards</a>
        </div>
      </header>
    </article>
  );
}
