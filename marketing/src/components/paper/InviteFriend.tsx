"use client";

import { useState, type FormEvent } from "react";
import { delight } from "@/lib/delight";
import { track } from "@/lib/analytics";

/** Get a personal link. When a friend joins with it, you both get a month of Pro. */
export function InviteFriend() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName: "", lastName: "" }),
      });
      const body = (await response.json().catch(() => ({}))) as { referralCode?: string; error?: string };
      if (!response.ok || !body.referralCode) throw new Error(body.error || "Could not make your link.");
      setLink(`${window.location.origin}/?ref=${body.referralCode}`);
      delight();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not make your link.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      delight();
      track("referral_copied", { surface: "invite_section" });
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Copy failed. Select the link and copy it yourself.");
    }
  };

  const share = async () => {
    const data = { title: "Unvibe", text: "Unvibe explains the code AI writes for you. Free for Mac and Windows.", url: link };
    try {
      if (navigator.share) await navigator.share(data);
      else await copy();
      track("referral_shared", { surface: "invite_section" });
    } catch {
      /* share sheet closed */
    }
  };

  return (
    <div className="invite">
      <div className="invite__copy">
        <p className="paper-meta">Bring a friend</p>
        <h2>One link. <em>A month of Pro each.</em></h2>
        <p className="paper-lead">Grab your personal link and send it to a friend. When they join with it, you both get a month of Pro, up to five friends.</p>
      </div>
      {link ? (
        <div className="invite__result">
          <code>{link}</code>
          <div className="invite__actions">
            <button type="button" onClick={() => void copy()}>{copied ? "Copied!" : "Copy link"}</button>
            <button type="button" className="is-ink" onClick={() => void share()}>Share</button>
          </div>
        </div>
      ) : (
        <form className="invite__form" onSubmit={submit}>
          <input type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" aria-label="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" disabled={busy}>{busy ? "Making your link…" : "Get my link"}</button>
        </form>
      )}
      {error ? <p className="invite__error" role="alert">{error}</p> : null}
    </div>
  );
}
