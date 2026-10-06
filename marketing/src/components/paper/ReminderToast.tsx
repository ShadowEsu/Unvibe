"use client";

import { useEffect, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { delight } from "@/lib/delight";
import { track } from "@/lib/analytics";
import { markRefUsed, refUsed, rememberRef, storedRef } from "@/lib/referral";

export const DOWNLOADED_EVENT = "unvibe:downloaded";

const QUIET = ["/founder", "/stats", "/waitlist-admin", "/activate"];

/**
 * One small email ask. Opens when a friend's invite link brings you here (you both get a month
 * of Pro) or right after a download click (setup guide plus a nudge tomorrow).
 */
export function ReminderToast() {
  const pathname = usePathname() ?? "/";
  const [mode, setMode] = useState<"closed" | "invited" | "download">("closed");
  const [ref, setRef] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

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
        body: JSON.stringify({ email, referredBy: invited ? ref : "" }),
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
    <div className="remind" role="dialog" aria-label={invited ? "Claim your free month of Pro" : "Get the setup guide"}>
      <button type="button" className="remind__close" aria-label="No thanks" onClick={close}>×</button>
      {state === "done" ? (
        <p className="remind__done">
          {invited ? <>You&apos;re in! A month of Pro is waiting for you <em>and your friend.</em></> : <>Sent! Check your inbox. <em>Have fun.</em></>}
        </p>
      ) : (
        <form onSubmit={submit}>
          {invited ? (
            <p><b>A friend invited you.</b> Pop your email in and you both get <em>a month of Pro</em> free. Use the same email when you sign in to the app.</p>
          ) : (
            <p><b>Downloading!</b> Want the 2-minute setup guide and a nudge tomorrow?</p>
          )}
          <div className="remind__row">
            <input type="email" required maxLength={240} autoComplete="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={state === "sending"}>{state === "sending" ? "…" : invited ? "Claim it" : "Send it"}</button>
          </div>
          {error ? <p className="remind__error" role="alert">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
