"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { delight } from "@/lib/delight";
import { track } from "@/lib/analytics";
import { DOWNLOADED_EVENT } from "@/lib/downloadTracking";
import { GIFT_CODE, markRefUsed, refUsed, rememberRef, storedRef } from "@/lib/referral";

const QUIET = ["/founder", "/stats", "/s/", "/kit", "/waitlist-admin", "/activate"];

/**
 * One small email ask. Opens when a friend's invite link brings you here (with an app gift code,
 * it tells you where to enter it) or right after a download click (setup guide). A setup tip the
 * next day is its own unticked box; only a ticked box asks the server for it.
 */
export function ReminderToast() {
  const pathname = usePathname() ?? "/";
  const [mode, setMode] = useState<"closed" | "invited" | "download">("closed");
  const [ref, setRef] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [setupTip, setSetupTip] = useState(false);

  useEffect(() => {
    rememberRef();
    const code = storedRef();
    setRef(code);
    if (code && !refUsed() && !QUIET.some((p) => pathname.startsWith(p))) {
      const timer = window.setTimeout(() => setMode("invited"), 1400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [pathname]);

  useEffect(() => {
    let asked = false;
    try { asked = window.localStorage.getItem("unvibe.reminderAsked") === "1"; } catch { /* storage blocked */ }
    const onDownload = () => {
      if (asked) return;
      asked = true;
      try { window.localStorage.setItem("unvibe.reminderAsked", "1"); } catch { /* storage blocked */ }
      window.setTimeout(() => setMode((current) => (current === "closed" ? "download" : current)), 900);
    };
    window.addEventListener(DOWNLOADED_EVENT, onDownload);
    return () => window.removeEventListener(DOWNLOADED_EVENT, onDownload);
  }, []);

  if (mode === "closed") return null;
  const invited = Boolean(ref) && !refUsed();
  const giftCode = GIFT_CODE.test(ref) && (invited || mode === "invited") ? ref : "";

  const close = () => {
    if (mode === "invited") markRefUsed();
    setMode("closed");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/beta-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, referredBy: invited ? ref : "", ...(setupTip ? { reminder: true } : {}) }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not send that.");
      if (invited) markRefUsed();
      setState("done");
      delight();
      track(invited ? "referral_joined" : "reminder_requested", { surface: mode === "invited" ? "invite_toast" : "download_toast" });
      window.setTimeout(() => setMode("closed"), 3200);
    } catch (reason) {
      setState("error");
      setError(reason instanceof Error ? reason.message : "Could not send that.");
    }
  };

  return (
    <div className="remind" role="dialog" aria-label={invited ? "A friend invited you" : "Get the setup guide"}>
      <button type="button" className="remind__close" aria-label="No thanks" onClick={close}>×</button>
      {state === "done" ? (
        <p className="remind__done">
          {giftCode ? <>Sent! After you sign in to the app, enter <b>{giftCode}</b> on the Share page. <em>A month of Pro each.</em></> : <>Sent! Check your inbox. <em>Have fun.</em></>}
        </p>
      ) : (
        <form onSubmit={submit}>
          {giftCode ? (
            <p><b>A friend invited you.</b> Sign in to the Unvibe app and enter <b>{giftCode}</b> on the Share page. You each get <em>a month of Pro</em>. Want the download link by email?</p>
          ) : invited ? (
            <p><b>A friend invited you.</b> Want the download link and setup guide by email?</p>
          ) : (
            <p><b>Downloading!</b> First time opening it? <a href="/install-help">See how to approve it</a>. Want the setup guide by email?</p>
          )}
          <div className="remind__check">
            <input id="remind-setup-tip" type="checkbox" checked={setupTip} onChange={(e) => setSetupTip(e.target.checked)} />
            <label htmlFor="remind-setup-tip">Also email me one setup tip tomorrow</label>
          </div>
          <div className="remind__row">
            <input type="email" required maxLength={240} autoComplete="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={state === "sending"}>{state === "sending" ? "…" : "Send it"}</button>
          </div>
          {error ? <p className="remind__error" role="alert">{error}</p> : null}
          <p className="remind__fine"><a href="/privacy">Privacy</a></p>
        </form>
      )}
    </div>
  );
}
