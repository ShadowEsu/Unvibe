"use client";

import { useId, useState, type FormEvent } from "react";
import { ShareStep } from "@/components/paper/ShareStep";
import { track } from "@/lib/analytics";
import { browserTrackingDisabled } from "@/lib/trackingOptOut";
import { markRefUsed, storedRef } from "@/lib/referral";

/**
 * Phones can't run the desktop app, so the one action there is "email me the link".
 * It joins the existing list (waitlist_entries) and sends the welcome email with the download.
 * `surface` names where the form sits for waitlist_completed and the referral step; a page can hold two forms, so
 * the note and error ids are per form.
 */
export function EmailMeLink({ surface }: { surface: string }) {
  const id = useId();
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("busy");
    setError("");
    const params = new URLSearchParams(window.location.search);
    const referredBy = storedRef();
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: "",
          lastName: "",
          referredBy,
          utmSource: (params.get("utm_source") ?? "").slice(0, 64),
          utmMedium: (params.get("utm_medium") ?? "").slice(0, 64),
          utmCampaign: (params.get("utm_campaign") ?? "").slice(0, 64),
          analytics: !browserTrackingDisabled(),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { referralCode?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "That didn't go through. Try again in a minute.");
      if (referredBy) markRefUsed();
      setCode(body.referralCode ?? "");
      setState("done");
      track("waitlist_completed", { surface });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That didn't go through. Try again in a minute.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="vhero__phone" role="status">
        <p><strong>Sent.</strong> Open the email on your Mac or PC to download Unvibe.</p>
        {code ? <ShareStep code={code} surface={surface} /> : null}
      </div>
    );
  }

  return (
    <div className="vhero__phone">
      <form className="vhero__email" onSubmit={submit}>
        <input
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          aria-label="Your email"
          aria-describedby={error ? `${noteId} ${errorId}` : noteId}
          aria-invalid={Boolean(error)}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="paper-join paper-join--win" disabled={state === "busy"}>
          <span className="paper-join__label">{state === "busy" ? "Sending…" : "Email me the link"}</span>
        </button>
      </form>
      {error ? <p className="vhero__error" id={errorId} role="alert">{error}</p> : null}
      <p className="vhero__fine" id={noteId}>One email with the download link for your Mac or PC. Unsubscribe any time. <a href="/privacy">Privacy</a></p>
    </div>
  );
}
