"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Vibe } from "@/components/paper/Vibe";
import { delight } from "@/lib/delight";
import { track } from "@/lib/analytics";

const MAX_WORDS = 100;
/** Same floor the server uses before the email link earns a Pro month. */
const BONUS_MIN_WORDS = 8;
const HIDDEN = ["/founder", "/stats", "/s/", "/waitlist-admin", "/activate"];

function words(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** A small "Feedback" tab on every page: stars plus up to 100 words. */
export function FeedbackWidget() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [claim, setClaim] = useState("");
  const [bonus, setBonus] = useState<"granted" | "already" | "too_short" | undefined>();
  const dialogRef = useRef<HTMLDivElement>(null);

  // The welcome email links to ?feedback=1&e=<email>&t=<signature>: open straight away, prefilled.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("feedback") !== "1") return;
    const fromEmail = params.get("e") ?? "";
    const token = params.get("t") ?? "";
    if (fromEmail.includes("@")) setEmail(fromEmail.slice(0, 254));
    if (/^[a-f0-9]{32}$/.test(token)) setClaim(token);
    setOpen(true);
    track("feedback_opened", { surface: "email_link" });
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector<HTMLButtonElement>(".fb-star")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;

  const count = words(message);
  const tooLong = count > MAX_WORDS;
  const earning = Boolean(claim) && email.includes("@");
  const tooShortForBonus = earning && count < BONUS_MIN_WORDS;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!rating || tooLong || tooShortForBonus) return;
    setStatus("sending");
    setError("");
    try {
      const response = await fetch("/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, message, email, website, source: "site", page: pathname, claim: earning ? claim : "" }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; bonus?: "granted" | "already" | "too_short" };
      if (!response.ok) throw new Error(body.error || "Could not send that.");
      setBonus(body.bonus);
      setStatus("done");
      delight();
      track("feedback_submitted", { rating, surface: "site" });
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "Could not send that.");
    }
  };

  const reset = () => { setOpen(false); window.setTimeout(() => { setStatus("idle"); setRating(0); setMessage(""); setEmail(""); setClaim(""); setBonus(undefined); }, 300); };

  return (
    <>
      <button type="button" className="fb-tab" onClick={() => { setOpen(true); track("feedback_opened", { surface: "site_tab" }); }}>
        Feedback
      </button>
      {open ? (
        <div className="fb-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) reset(); }}>
          <div className="fb-dialog" role="dialog" aria-modal="true" aria-labelledby="fb-title" ref={dialogRef}>
            <button type="button" className="fb-close" aria-label="Close" onClick={reset}>×</button>
            {status === "done" ? (
              <div className="fb-done">
                <Vibe size={84} />
                <h2 id="fb-title">Thank <em>you.</em></h2>
                <p>Every note gets read. That one just made Vibe&apos;s day.</p>
                {bonus === "granted" ? <p className="fb-bonus"><b>+1 month of Pro</b> added to {email}. Sign in to the app with that email to use it.</p> : null}
                {bonus === "already" ? <p className="fb-bonus">This email already got its feedback month. Thank you again!</p> : null}
                <button type="button" className="fb-send" onClick={reset}>Back to the site</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="fb-head">
                  <Vibe size={56} />
                  <div>
                    <h2 id="fb-title">How&apos;s <em>Unvibe?</em></h2>
                    <p>{earning ? <>Stars and a few honest words earn you <b>another month of Pro</b>.</> : <>Stars and a few words. That&apos;s it.</>}</p>
                  </div>
                </div>
                <div className="fb-stars" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={rating === n}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      className={`fb-star${(hover || rating) >= n ? " is-on" : ""}`}
                      onMouseEnter={() => setHover(n)}
                      onClick={() => { setRating(n); if (n >= 4) delight(); }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <label className="fb-label" htmlFor="fb-message">
                  {rating && rating <= 3 ? "What would make it better?" : "Anything you want to tell us?"} <span>{earning ? `at least ${BONUS_MIN_WORDS} words for the month` : "optional"}</span>
                </label>
                <textarea id="fb-message" rows={4} maxLength={1200} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Your words, up to 100." />
                <p className={`fb-count${tooLong ? " is-over" : ""}`}>{count}/{MAX_WORDS} words{tooShortForBonus ? ` · ${BONUS_MIN_WORDS - count} more to unlock your month` : ""}</p>
                <label className="fb-label" htmlFor="fb-email">Email <span>{earning ? "the month goes to this email" : "optional, only if you want a reply"}</span></label>
                <input id="fb-email" type="email" readOnly={Boolean(claim)} maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                <input className="fb-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} name="website" />
                {status === "error" ? <p className="fb-error" role="alert">{error}</p> : null}
                <button type="submit" className="fb-send" disabled={!rating || tooLong || tooShortForBonus || status === "sending"}>
                  {status === "sending" ? "Sending…" : rating ? "Send feedback" : "Pick some stars first"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
