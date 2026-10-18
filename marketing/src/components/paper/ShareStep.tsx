"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * The referral as it actually works (web/supabase/migrations/20261006120000, claim_referral):
 * a friend who joins with a new email gives you both a month of Pro features, up to five
 * friends. Pro unlocks Expert depth and project-aware answers; it does not raise the
 * explanation allowance, so the copy doesn't claim more explanations.
 */
export const REFERRAL_OFFER =
  "When a friend joins with your link using a new email, you each get a month of Pro: Expert depth and answers that use nearby files. Up to five friends.";

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
      <p className="share-step__offer">{REFERRAL_OFFER}</p>
      <code className="share-step__link">{link}</code>
      <div className="share-step__actions">
        <button type="button" onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</button>
        <button type="button" className="is-ink" onClick={() => void share()}>Share</button>
      </div>
    </div>
  );
}
