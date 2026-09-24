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
  const [giftNotice, setGiftNotice] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [startedTracked, setStartedTracked] = useState(false);
  const [detailsStatus, setDetailsStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [tool, setTool] = useState<(typeof tools)[number] | "">("");
  const [experience, setExperience] = useState<(typeof experiences)[number] | "">("");
  const [message, setMessage] = useState("");
  const [utm, setUtm] = useState({ utmSource: "", utmMedium: "", utmCampaign: "" });
  const [refCode, setRefCode] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { firstName: "", lastName: "", email: "", referredBy: "", promoCode: "" },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = (params.get("ref") ?? "").trim().toLowerCase().slice(0, 32);
    const fromEmail = (params.get("from") ?? params.get("giver") ?? "").trim().toLowerCase().slice(0, 120);
    setUtm({
      utmSource: (params.get("utm_source") ?? "").slice(0, 64),
      utmMedium: (params.get("utm_medium") ?? "").slice(0, 64),
      utmCampaign: (params.get("utm_campaign") ?? "").slice(0, 64),
    });
    setRefCode(ref);
    if (ref) {
      setValue("promoCode", ref);
      setOfferOpen(true);
    }
    if (fromEmail.includes("@")) {
      setValue("referredBy", fromEmail);
      setOfferOpen(true);
    }
    track("waitlist_viewed", { surface: variant });
  }, [variant, setValue]);

  const markStarted = () => {
    if (startedTracked) return;
    setStartedTracked(true);
    track("waitlist_started", { surface: variant });
  };

  const submit = async (values: WaitlistInput) => {
    setStatus("submitting");
    setSubmitError("");
    setGiftNotice("");
    try {
      const friendEmail = (values.referredBy ?? "").trim();
      const promoCode = (values.promoCode ?? "").trim() || refCode;
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          // Cash attribution uses the referral code. Friend email stays for gift claim only.
          referredBy: friendEmail.includes("@") ? friendEmail : (promoCode || refCode || friendEmail),
          promoCode: promoCode || undefined,
          utmSource: utm.utmSource || undefined,
          utmMedium: utm.utmMedium || undefined,
          utmCampaign: utm.utmCampaign || undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as WaitlistResponse & { referralCode?: string };
      if (!response.ok) {
        setSubmitError(data.error || "We couldn't save your spot. Please try again.");
        setStatus("error");
        track("waitlist_failed", {
          surface: variant,
          status: response.status,
          code: data.code ?? "http_error",
        });
        return;
      }
      setSavedEmail(values.email.trim().toLowerCase());
      setReferralCode(typeof data.referralCode === "string" ? data.referralCode : "");
      setStatus(data.duplicate ? "duplicate" : "success");
      track("waitlist_completed", { duplicate: Boolean(data.duplicate), surface: variant });

      if (friendEmail.includes("@") && promoCode) {
        try {
          const giftRes = await fetch("/api/gifts/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipientEmail: values.email.trim(),
              giverEmail: friendEmail,
              promoCode,
            }),
          });
          const giftData = (await giftRes.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
          if (giftRes.ok && giftData.ok !== false) {
            setGiftNotice("Gift recorded. Both of you get 1 month of Pro after each person creates an Unvibe account (up to five gifts).");
            track("gift_claimed", { surface: variant });
          } else {
            setGiftNotice(giftData.message || "Waitlist saved. The gift code could not be claimed — check the friend email and 8-character code.");
          }
        } catch {
          setGiftNotice("Waitlist saved. Gift claim could not reach the Unvibe service right now.");
        }
      } else if (promoCode && !friendEmail.includes("@")) {
        setGiftNotice("Referral link counted for rewards. To also claim the Pro gift, add your friend’s email with the 8-character code.");
      }
    } catch {
      setSubmitError("We couldn't reach community signup. Check your connection and try again.");
      setStatus("error");
      track("waitlist_failed", { surface: variant, code: "network" });
    }
  };

  const referralUrl = referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : "https://unvibe.site"}/?ref=${referralCode}${savedEmail ? `&from=${encodeURIComponent(savedEmail)}` : ""}`
    : "";

  const copyReferral = async () => {
    if (!referralCode || !referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      track("referral_copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setSubmitError("Couldn't copy the link. Select it below and copy manually.");
    }
  };

  const shareReferral = async () => {
    if (!referralUrl) return;
    const shareText = "Unvibe explains AI-written code in your editor so you actually own what you ship. Download it here:";
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title: "Unvibe", text: shareText, url: referralUrl });
        track("referral_shared", { channel: "native" });
        return;
      }
    } catch {
      // User cancelled or share failed; fall through to X intent.
    }
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareText} ${referralUrl}`)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
    track("referral_shared", { channel: "x_intent" });
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
        <form onSubmit={handleSubmit(submit)} noValidate onFocusCapture={markStarted}>
          <div className="form-heading">
            <span className="brand-pixel" />
            <strong>Join the community</strong>
            <small>Get product notes and feedback invitations. You can skip the rest.</small>
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
          <details className="referral-offer" open={offerOpen} onToggle={(e) => setOfferOpen((e.target as HTMLDetailsElement).open)}>
            <summary>Referral or promo code</summary>
            <p>Optional. Friend&apos;s email and their 8-character code. Both get 1 month of Pro after creating an Unvibe account, up to five gifts.</p>
            <div className="referral-offer__fields">
              <label><span>Friend&apos;s email</span><input type="email" autoComplete="email" placeholder="friend@example.com" {...register("referredBy")} /></label>
              <label><span>8-character code</span><input placeholder="e.g. a1b2c3d4" {...register("promoCode")} /></label>
            </div>
          </details>
          {status === "error" && <p className="form-error" role="alert">{submitError}</p>}
          <button className="waitlist-submit" type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? <><Loader2 className="spin" size={18} />Joining</> : <>Join the community <Send size={17} /></>}
          </button>
          <p className="form-legal">By joining, you agree to the <a href="/terms">terms</a> and acknowledge the <a href="/privacy">privacy policy</a>.</p>
        </form>
      ) : (
        <div className="success-panel" role="status">
          <span className="success-pixel"><Check /></span>
          <p className="pixel-label">JOINED</p>
          <h3>{status === "duplicate" ? "You are already in the community." : "You are in."}</h3>
          <p>Thanks for joining. We will send product notes, feedback invitations, and Teams updates without adding a download gate.</p>
          {giftNotice && <p className="form-legal" role="status">{giftNotice}</p>}
          {referralCode && (
            <div className="referral-success">
              <Gift size={18} />
              <div>
                <strong>Your share link is ready. Every 3 verified joins = $5 (up to $25).</strong>
                <span>Rewards are reviewed before Unvibe credit or wire. Share in the next minute while it is fresh.</span>
                <code className="referral-success__link" aria-label="Your referral link">{referralUrl}</code>
                <div className="referral-success__actions">
                  <button type="button" onClick={copyReferral}>{copied ? "Copied" : <><Copy size={15} /> Copy link</>}</button>
                  <button type="button" onClick={shareReferral}>Share</button>
                  <a href={`/rewards?ref=${referralCode}`}>View reward progress <ArrowUpRight size={14} /></a>
                </div>
              </div>
            </div>
          )}
          {variant === "page" && (
            detailsStatus === "saved" ? (
              <div className="details-saved"><Check size={18} /><span>Thanks. Your optional details are saved.</span></div>
            ) : (
              <div className="optional-details">
                <label>Where you work<select value={tool} onChange={(event) => setTool(event.target.value as typeof tool)}><option value="">Skip</option>{tools.map((item) => <option key={item} value={item}>{toolLabels[item]}</option>)}</select></label>
                <label>Your experience<select value={experience} onChange={(event) => setExperience(event.target.value as typeof experience)}><option value="">Skip</option>{experiences.map((item) => <option key={item} value={item}>{experienceLabels[item]}</option>)}</select></label>
                {detailsStatus === "error" && <p className="form-error" role="alert">Optional details were not saved. Your community signup is still safe.</p>}
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
          <p className="section-number light">10 / COMMUNITY</p>
          <h2>Keep a real role in what we build next.</h2>
          <p>Download the app now. Join the community for product notes, feedback invitations, and a direct line on what improves next.</p>
          <ul>
            <li><Check size={16} />Mac and Windows downloads, available now</li>
            <li><Check size={16} />Selected-code explanations, saved learning, and early feature feedback</li>
            <li><Check size={16} />One week of Pro after a completed feedback survey</li>
            <li><Check size={16} />No credit card required to download</li>
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
