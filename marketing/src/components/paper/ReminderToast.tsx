"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { delight } from "@/lib/delight";
import { track } from "@/lib/analytics";
import { DOWNLOADED_EVENT } from "@/lib/downloadTracking";
import { GIFT_CODE, markRefUsed, refUsed, rememberRef, storedRef } from "@/lib/referral";

const QUIET = ["/console", "/stats", "/s/", "/kit", "/waitlist-admin", "/activate"];
/** Present while a page shows the ask in its own flow (the thank-you page); the floating toast then stays closed. */
const INLINE_ATTR = "data-remind-inline";
/** Fired when that in-flow ask mounts: a toast still open from the page before (client navigation) closes. */
const INLINE_EVENT = "unvibe:remind-inline";
/** Set once the ask was shown or turned down; the floating toast never asks again. */
const ASKED_KEY = "unvibe.reminderAsked";

/**
 * The ask itself: the setup guide (or the invite's download link) by email, with an unticked box for a setup tip the
 * next day; only a ticked box asks the server for it. `inline` lays it out as a row inside the page (≥ 880 px: the
 * text left, the box, email and button right) instead of the toast's column.
 */
function ReminderForm({ code, inline, surface, onSent }: { code: string; inline?: boolean; surface: string; onSent?: () => void }) {
  const tipId = useId();
  const errorId = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [setupTip, setSetupTip] = useState(false);
  const invited = Boolean(code) && !refUsed();
  const giftCode = GIFT_CODE.test(code) && (invited || surface === "invite_toast") ? code : "";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/beta-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, referredBy: invited ? code : "", ...(setupTip ? { reminder: true } : {}) }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not send that.");
      if (invited) markRefUsed();
      setState("done");
      delight();
      track(invited ? "referral_joined" : "reminder_requested", { surface });
      onSent?.();
    } catch (reason) {
      setState("error");
      setError(reason instanceof Error ? reason.message : "Could not send that.");
    }
  };

  if (state === "done") {
    return (
      <p className="remind__done">
        {giftCode ? <>Sent! After you sign in to the app, enter <b>{giftCode}</b> on the Share page. <b>A month of Pro each.</b></> : <>Sent! Check your inbox. <b>Have fun.</b></>}
      </p>
    );
  }
  return (
    <form onSubmit={submit} className={inline ? "remind__form" : undefined}>
      {giftCode && !inline ? (
        <p className="remind__text"><b>A friend invited you.</b> Sign in to the Unvibe app and enter <b>{giftCode}</b> on the Share page. You each get <b>a month of Pro</b>. Want the download link by email?</p>
      ) : invited && !inline ? (
        <p className="remind__text"><b>A friend invited you.</b> Want the download link and setup guide by email?</p>
      ) : (
        <p className="remind__text"><b>Downloading!</b> First time opening it? <a href="/install-help">See how to approve it</a>. Want the setup guide by email?</p>
      )}
      <div className="remind__check">
        <input id={tipId} type="checkbox" checked={setupTip} onChange={(e) => setSetupTip(e.target.checked)} />
        <label htmlFor={tipId}>Also email me one setup tip tomorrow</label>
      </div>
      <div className="remind__row">
        <input type="email" required maxLength={240} autoComplete="email" placeholder="you@example.com" aria-label="Email" aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} value={email} onChange={(e) => setEmail(e.target.value)} />
        <button type="submit" disabled={state === "sending"}>{state === "sending" ? "…" : "Send it"}</button>
      </div>
      {error ? <p id={errorId} className="remind__error" role="alert">{error}</p> : null}
      <p className="remind__fine"><a href="/privacy">Privacy</a></p>
    </form>
  );
}

/**
 * One small email ask, floating. Opens when a friend's invite link brings you here (with an app gift code, it tells
 * you where to enter it) or right after a download click (setup guide), unless the page already shows the ask in its
 * own flow (ReminderInline on the thank-you page: a floating card there covered the first-open steps, QA 6 Nov).
 */
export function ReminderToast() {
  const pathname = usePathname() ?? "/";
  const [mode, setMode] = useState<"closed" | "invited" | "download">("closed");
  const [ref, setRef] = useState("");

  useEffect(() => {
    rememberRef();
    const code = storedRef();
    setRef(code);
    if (code && !refUsed() && !QUIET.some((p) => pathname.startsWith(p))) {
      const timer = window.setTimeout(() => setMode((current) => (document.querySelector(`[${INLINE_ATTR}]`) ? current : "invited")), 1400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [pathname]);

  useEffect(() => {
    const askedBefore = () => {
      try { return window.localStorage.getItem(ASKED_KEY) === "1"; } catch { return false; }
    };
    const onDownload = () => {
      // read at the click, not at mount: "No thanks" on the thank-you page also marks the ask as made
      if (askedBefore()) return;
      try { window.localStorage.setItem(ASKED_KEY, "1"); } catch { /* storage blocked */ }
      // Checked when it would open: a download click on home lands on the thank-you page, which asks in its own flow.
      window.setTimeout(() => setMode((current) => (current === "closed" && !document.querySelector(`[${INLINE_ATTR}]`) ? "download" : current)), 900);
    };
    // a toast already open when the thank-you page's own ask appears closes, so the page never shows both
    const onInline = () => setMode("closed");
    window.addEventListener(DOWNLOADED_EVENT, onDownload);
    window.addEventListener(INLINE_EVENT, onInline);
    return () => {
      window.removeEventListener(DOWNLOADED_EVENT, onDownload);
      window.removeEventListener(INLINE_EVENT, onInline);
    };
  }, []);

  if (mode === "closed") return null;
  const invited = Boolean(ref) && !refUsed();

  const close = () => {
    if (mode === "invited") markRefUsed();
    setMode("closed");
  };

  return (
    <div className="remind" role="dialog" aria-label={invited ? "A friend invited you" : "Get the setup guide"}>
      <button type="button" className="remind__close" aria-label="No thanks" onClick={close}>×</button>
      <ReminderForm
        code={ref}
        surface={mode === "invited" ? "invite_toast" : "download_toast"}
        onSent={() => window.setTimeout(() => setMode("closed"), 3200)}
      />
    </div>
  );
}

/**
 * The same ask inside the thank-you page, under its links row (Design 2055 §9): in the flow from the section's first
 * paint, so it never covers the steps or the other files' links and never shifts them. "No thanks" folds it away.
 */
export function ReminderInline() {
  const [open, setOpen] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  // the invite code, if a friend's link brought this visitor: read after mount (storage), sent with the email
  const [code, setCode] = useState("");
  useEffect(() => {
    setCode(storedRef());
    window.dispatchEvent(new Event(INLINE_EVENT));
  }, []);
  if (!open) return null;
  const dismiss = () => {
    try { window.localStorage.setItem(ASKED_KEY, "1"); } catch { /* storage blocked */ }
    // keep keyboard focus in place: the last link of the row just above ("Install help →") takes it
    const links = box.current?.previousElementSibling?.querySelectorAll<HTMLElement>("a");
    links?.[links.length - 1]?.focus();
    setOpen(false);
  };
  return (
    <div ref={box} className="remind remind--inline" {...{ [INLINE_ATTR]: "" }} role="group" aria-label="Get the setup guide">
      <ReminderForm code={code} inline surface="download_thanks" />
      <button type="button" className="remind__no" onClick={dismiss}>No thanks</button>
    </div>
  );
}
