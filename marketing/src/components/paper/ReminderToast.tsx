"use client";

import { useEffect, useState, type FormEvent } from "react";
import { delight } from "@/lib/delight";
import { track } from "@/lib/analytics";

export const DOWNLOADED_EVENT = "unvibe:downloaded";

/** After a download click: an optional one-field ask for the setup guide and a reminder tomorrow. */
export function ReminderToast() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let asked = false;
    try { asked = window.localStorage.getItem("unvibe.reminderAsked") === "1"; } catch { /* storage blocked */ }
    const onDownload = () => {
      if (asked) return;
      asked = true;
      try { window.localStorage.setItem("unvibe.reminderAsked", "1"); } catch { /* storage blocked */ }
      window.setTimeout(() => setOpen(true), 900);
    };
    window.addEventListener(DOWNLOADED_EVENT, onDownload);
    return () => window.removeEventListener(DOWNLOADED_EVENT, onDownload);
  }, []);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/beta-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not send that.");
      setState("done");
      delight();
      track("reminder_requested", { surface: "download_toast" });
      window.setTimeout(() => setOpen(false), 2600);
    } catch (reason) {
      setState("error");
      setError(reason instanceof Error ? reason.message : "Could not send that.");
    }
  };

  return (
    <div className="remind" role="dialog" aria-label="Get the setup guide">
      <button type="button" className="remind__close" aria-label="No thanks" onClick={() => setOpen(false)}>×</button>
      {state === "done" ? (
        <p className="remind__done">Sent! Check your inbox. <em>Have fun.</em></p>
      ) : (
        <form onSubmit={submit}>
          <p><b>Downloading!</b> Want the 2-minute setup guide and a nudge tomorrow?</p>
          <div className="remind__row">
            <input type="email" required maxLength={240} autoComplete="email" placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={state === "sending"}>{state === "sending" ? "…" : "Send it"}</button>
          </div>
          {error ? <p className="remind__error" role="alert">{error}</p> : null}
        </form>
      )}
    </div>
  );
}
