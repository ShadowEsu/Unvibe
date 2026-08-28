"use client";

import { PixelWaitlist } from "@/components/redesign/PixelWaitlist";

export function WaitlistInvite() {
  return (
    <div className="paper-invite is-lit" id="waitlist">
      <div className="paper-invite__card paper-glass">
        <p className="paper-meta">Private beta</p>
        <h2>Save a seat.</h2>
        <p className="paper-lead">Mac and Windows private beta. 30 AI explanations. Name and email. You can skip the rest.</p>
        <div className="paper-invite__form">
          <PixelWaitlist variant="hero" />
        </div>
      </div>
    </div>
  );
}
