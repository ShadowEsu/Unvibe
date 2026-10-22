"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { GIFT_CODE_HOME, GIFT_OFFER } from "@/lib/giftOffer";

export function ShareStep({ code, surface }: { code: string; surface: string }) {
  const [copied, setCopied] = useState(false);
  const link = `https://unvibe.site/?ref=${code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      track("referral_copied", { surface });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the link is visible and selectable */
    }
  };

  const share = async () => {
    if (typeof navigator.share !== "function") return copy();
    try {
      await navigator.share({ title: "Unvibe", text: "Unvibe explains the code AI writes for you. Free for Mac and Windows.", url: link });
      track("referral_shared", { surface });
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <div className="share-step">
      <p className="share-step__offer">Share Unvibe with this link. {GIFT_CODE_HOME} {GIFT_OFFER}</p>
      <code className="share-step__link">{link}</code>
      <div className="share-step__actions">
        <button type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</button>
        <button type="button" className="is-ink" onClick={() => void share()}>Share</button>
      </div>
    </div>
  );
}
