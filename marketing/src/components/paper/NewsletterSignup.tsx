"use client";

import { useState, type FormEvent } from "react";
import { Button, Input } from "glisse";
import { useGlassLevel } from "@/components/glass/GlassLevel";
import { NEWSLETTER_CONSENT_TEXT } from "@/lib/newsletterConsent";
import { browserTrackingDisabled } from "@/lib/trackingOptOut";

const FAILED = "That didn't go through. Try again in a minute.";

/**
 * Email signup for product news (ledger 299). The consent box starts unticked on every load and is
 * never remembered; Subscribe sends nothing until it is ticked, and the server refuses a newsletter
 * post without `consent: true`. `id` keeps the ids unique when several forms share a page. The consent
 * box and its label stay native and off glass at both glass levels (Security); the email field is a
 * Glisse Input at the full level only.
 */
export function NewsletterSignup({ id }: { id: string }) {
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const glass = useGlassLevel();
  const ids = {
    email: `newsletter-${id}-email`,
    consent: `newsletter-${id}-consent`,
    hint: `newsletter-${id}-hint`,
    error: `newsletter-${id}-error`,
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agreed) {
      setBlocked(true);
      return;
    }
    const field = event.currentTarget.elements.namedItem("email");
    if (field instanceof HTMLInputElement && !field.checkValidity()) {
      setError("Enter a valid email.");
      return;
    }
    setState("busy");
    setError("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: "",
          lastName: "",
          source: "newsletter",
          consent: agreed,
          analytics: !browserTrackingDisabled(),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || FAILED);
      setState("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : FAILED);
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <p className="newsletter__done" role="status">
        You&apos;re on the list. One email when something ships.
      </p>
    );
  }

  const describedBy = [blocked && !agreed ? ids.hint : "", error ? ids.error : ""].filter(Boolean).join(" ") || undefined;
  const field = {
    id: ids.email,
    name: "email",
    type: "email",
    required: true,
    maxLength: 254,
    autoComplete: "email",
    inputMode: "email",
    placeholder: "you@example.com",
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? ids.error : undefined,
  } as const;
  return (
    <form className="newsletter" onSubmit={submit} noValidate>
      <div className="newsletter__row">
        <label className="sr-only" htmlFor={ids.email}>Email for product news</label>
        {glass === "full" ? (
          <Input {...field} value={email} onValueChange={setEmail} />
        ) : (
          <input {...field} value={email} onChange={(event) => setEmail(event.target.value)} />
        )}
        <Button
          type="submit"
          variant="filled"
          disabled={state === "busy"}
          aria-disabled={agreed ? undefined : true}
          aria-describedby={describedBy}
        >
          {state === "busy" ? "Subscribing…" : "Subscribe"}
        </Button>
      </div>
      <p className="newsletter__consent">
        <input
          type="checkbox"
          id={ids.consent}
          checked={agreed}
          onChange={(event) => {
            setAgreed(event.target.checked);
            if (event.target.checked) setBlocked(false);
          }}
          aria-required="true"
          aria-describedby={blocked && !agreed ? ids.hint : undefined}
        />
        <label htmlFor={ids.consent}>{NEWSLETTER_CONSENT_TEXT}</label>
      </p>
      {blocked && !agreed ? (
        <p className="newsletter__note" id={ids.hint} role="alert">Tick the box first to subscribe.</p>
      ) : null}
      {error ? (
        <p className="newsletter__note" id={ids.error} role="alert">{error}</p>
      ) : null}
    </form>
  );
}
