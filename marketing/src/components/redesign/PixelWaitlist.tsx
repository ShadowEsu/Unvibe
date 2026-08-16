"use client";

import { cloneElement, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, Check, Copy, Gift, Loader2, Send } from "lucide-react";
import { track } from "@/lib/analytics";
import { Reveal } from "@/components/redesign/Reveal";
import {
  experienceLabels,
  experiences,
  toolLabels,
  tools,
  waitlistSchema,
  type WaitlistInput,
} from "@/lib/waitlistSchema";

type Status = "idle" | "submitting" | "success" | "duplicate" | "error";
type WaitlistResponse = {
  duplicate?: boolean;
  error?: string;
  code?: "waitlist_storage_setup_required" | "waitlist_storage_unavailable" | "waitlist_save_failed";
};

type Variant = "page" | "hero";

export function PixelWaitlist({ variant = "page" }: { variant?: Variant }) {
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [detailsStatus, setDetailsStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [tool, setTool] = useState<(typeof tools)[number] | "">("");
  const [experience, setExperience] = useState<(typeof experiences)[number] | "">("");
  const [message, setMessage] = useState("");
  const [tracking, setTracking] = useState({ referredBy: "", utmSource: "", utmMedium: "", utmCampaign: "" });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { firstName: "", lastName: "", email: "", referredBy: "", promoCode: "" },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTracking({
      referredBy: (params.get("ref") ?? "").slice(0, 32),
      utmSource: (params.get("utm_source") ?? "").slice(0, 64),
      utmMedium: (params.get("utm_medium") ?? "").slice(0, 64),
      utmCampaign: (params.get("utm_campaign") ?? "").slice(0, 64),
    });
    track("waitlist_started", { surface: variant });
  }, [variant]);

  const submit = async (values: WaitlistInput) => {
    setStatus("submitting");
    setSubmitError("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, ...tracking }),
      });
      const data = (await response.json().catch(() => ({}))) as WaitlistResponse;
      if (!response.ok) {
        setSubmitError(data.error || "We couldn't save your spot. Please try again.");
        setStatus("error");
        return;
      }
      setSavedEmail(values.email.trim().toLowerCase());
      setReferralCode(typeof (data as WaitlistResponse & { referralCode?: string }).referralCode === "string" ? (data as WaitlistResponse & { referralCode?: string }).referralCode ?? "" : "");
      setStatus(data.duplicate ? "duplicate" : "success");
      track("waitlist_completed", { duplicate: Boolean(data.duplicate), surface: variant });
    } catch {
      setSubmitError("We couldn't reach the private beta list. Check your connection and try again.");
      setStatus("error");
    }
  };

  const copyReferral = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/?ref=${referralCode}`);
      setCopied(true);
      track("referral_copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setSubmitError("Couldn't copy the link. You can copy it from your browser's address bar.");
    }
  };

  const saveDetails = async () => {
    setDetailsStatus("saving");
    try {
      const response = await fetch("/api/waitlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: savedEmail, tool: tool || undefined, experience: experience || undefined, message }),
      });
      if (!response.ok) throw new Error("details failed");
      setDetailsStatus("saved");
    } catch {
      setDetailsStatus("error");
    }
  };

  const complete = status === "success" || status === "duplicate";
  const form = (
    <div className={variant === "hero" ? "hero-waitlist-card" : "waitlist-card"}>
      {!complete ? (
        <form onSubmit={handleSubmit(submit)} noValidate>
          <div className="form-heading">
            <span className="brand-pixel" />
            <strong>Join the waitlist</strong>
            <small>Name and email. You can skip the rest.</small>
          </div>
          <div className="name-row">
            <Field label="First name" error={errors.firstName?.message}>
              <input autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} {...register("firstName")} />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <input autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} {...register("lastName")} />
            </Field>
          </div>
          <Field label="Email" error={errors.email?.message}>
            <input type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} {...register("email")} />
          </Field>
          <details className="referral-offer">
            <summary>Referral or promo code</summary>
            <p>Optional. Friend email and UNVIBE SPECIAL if you have them.</p>
            <div className="referral-offer__fields">
              <label><span>Friend&apos;s email</span><input type="email" autoComplete="email" placeholder="friend@example.com" {...register("referredBy")} /></label>
              <label><span>Promo code</span><input placeholder="UNVIBE SPECIAL" {...register("promoCode")} /></label>
            </div>
          </details>
          {status === "error" && <p className="form-error" role="alert">{submitError}</p>}
          <button className="waitlist-submit" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? <><Loader2 className="spin" size={18} />Saving your spot</> : <>Join the waitlist <Send size={17} /></>}
          </button>
          <p className="form-legal">By joining, you agree to the <a href="/terms">terms</a> and acknowledge the <a href="/privacy">privacy policy</a>.</p>
        </form>
      ) : (
        <div className="success-panel" role="status">
          <span className="success-pixel"><Check /></span>
          <p className="pixel-label">JOINED</p>
          <h3>{status === "duplicate" ? "You were already on the list." : "Joined the waitlist."}</h3>
          <p>Thanks for requesting access. Invitations are being issued gradually during the private Mac beta.</p>
          {referralCode && <div className="referral-success"><Gift size={18} /><div><strong>Invite friends, earn beta rewards.</strong><span>Every 3 verified referrals earns a $5 reward, up to 5 rewards ($25 total). Rewards are reviewed before Unvibe credit or wire transfer.</span><div className="referral-success__actions"><button type="button" onClick={copyReferral}>{copied ? "Copied" : <><Copy size={15} /> Copy referral link</>}</button><a href={`/rewards?ref=${referralCode}`}>View reward progress <ArrowUpRight size={14} /></a></div></div></div>}
          {variant === "page" && (
            detailsStatus === "saved" ? (
              <div className="details-saved"><Check size={18} /><span>Thanks. Your optional details are saved.</span></div>
            ) : (
              <div className="optional-details">
                <label>Where you work<select value={tool} onChange={(event) => setTool(event.target.value as typeof tool)}><option value="">Skip</option>{tools.map((item) => <option key={item} value={item}>{toolLabels[item]}</option>)}</select></label>
                <label>Your experience<select value={experience} onChange={(event) => setExperience(event.target.value as typeof experience)}><option value="">Skip</option>{experiences.map((item) => <option key={item} value={item}>{experienceLabels[item]}</option>)}</select></label>
                {detailsStatus === "error" && <p className="form-error" role="alert">Optional details were not saved. Your waitlist spot is still safe.</p>}
                <button type="button" className="details-button" disabled={detailsStatus === "saving"} onClick={saveDetails}>{detailsStatus === "saving" ? "Saving" : "Save optional details"}</button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );

  if (variant === "hero") {
    return (
      <div className="hero-waitlist" id="waitlist">
        {form}
      </div>
    );
  }

  return (
    <section className="waitlist-field" id="waitlist">
      <div className="waitlist-pixels" aria-hidden="true" />
      <Reveal className="container-page waitlist-layout">
        <div className="waitlist-copy">
          <p className="section-number light">10 / PRIVATE BETA</p>
          <h2>Private beta access, <em>with a real role in the product.</em></h2>
          <p>Join the waitlist to request access. Beta members help shape the reviews, learning flow, integrations, and release priorities.</p>
          <ul>
            <li><Check size={16} />Private Mac beta. Working product.</li>
            <li><Check size={16} />Selected-code explanations, saved learning, and early feature voting</li>
            <li><Check size={16} />Referral rewards: $5 per 3 verified referrals, up to $25</li>
            <li><Check size={16} />Invite-only access · no credit card required</li>
          </ul>
          <p className="beta-clarity">For beta partnerships or developer-community access, contact preston@unvibe.site.</p>
        </div>
        {form}
      </Reveal>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactElement }) {
  const errorId = `${label.toLowerCase().replace(/\s+/g, "-")}-error`;

  return (
    <label className="form-field">
      <span>{label}</span>
      {cloneElement(children, { "aria-describedby": error ? errorId : undefined })}
      {error && <small id={errorId} role="alert">{error}</small>}
    </label>
  );
}
