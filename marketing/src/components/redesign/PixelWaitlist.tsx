"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Send } from "lucide-react";
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

export function PixelWaitlist() {
  const [status, setStatus] = useState<Status>("idle");
  const [submitError, setSubmitError] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
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
    defaultValues: { firstName: "", lastName: "", email: "" },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTracking({
      referredBy: (params.get("ref") ?? "").slice(0, 32),
      utmSource: (params.get("utm_source") ?? "").slice(0, 64),
      utmMedium: (params.get("utm_medium") ?? "").slice(0, 64),
      utmCampaign: (params.get("utm_campaign") ?? "").slice(0, 64),
    });
  }, []);

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
      setStatus(data.duplicate ? "duplicate" : "success");
      track("waitlist_completed", { duplicate: Boolean(data.duplicate) });
    } catch {
      setSubmitError("We couldn't reach the private beta list. Check your connection and try again.");
      setStatus("error");
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

  return (
    <section className="waitlist-field" id="waitlist">
      <div className="waitlist-pixels" aria-hidden="true" />
      <Reveal className="container-page waitlist-layout">
        <div className="waitlist-copy">
          <p className="section-number light">10 / PRIVATE BETA</p>
          <h2>The product is ready. <em>Access is invite-only.</em></h2>
          <p>Join the waitlist so we know you&apos;re interested. If you want the Mac app, email <a href="mailto:preston@unvibe.site?subject=Unvibe%20private%20beta%20access">preston@unvibe.site</a> and we&apos;ll get it to you.</p>
          <ul>
            <li><Check size={16} />Private Mac beta — product ready</li>
            <li><Check size={16} />Waitlist first, then invite access</li>
            <li><Check size={16} />No credit card to join the list</li>
          </ul>
          <p className="beta-clarity">Want the product now? Email preston@unvibe.site after you join the waitlist.</p>
        </div>

        <div className="waitlist-card">
          {!complete ? (
            <form onSubmit={handleSubmit(submit)} noValidate>
              <div className="form-heading"><span className="brand-pixel" /><strong>Join the waitlist</strong><small>Three quick details. That&apos;s all.</small></div>
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
              {status === "error" && <p className="form-error" role="alert">{submitError}</p>}
              <button className="waitlist-submit" type="submit" disabled={status === "submitting"}>
                {status === "submitting" ? <><Loader2 className="spin" size={18} />Saving your spot</> : <>Join the waitlist <Send size={17} /></>}
              </button>
              <p className="form-legal">By joining, you agree to the <a href="/terms">terms</a> and acknowledge the <a href="/privacy">privacy policy</a>.</p>
            </form>
          ) : (
            <div className="success-panel" role="status">
              <span className="success-pixel"><Check /></span>
              <p className="pixel-label">SPOT SAVED</p>
              <h3>{status === "duplicate" ? "You were already on the list." : "You're on the list."}</h3>
              <p>Want the product? Email <a href="mailto:preston@unvibe.site?subject=Unvibe%20private%20beta%20access">preston@unvibe.site</a> and we&apos;ll send access. Optional details below help us prioritize invites.</p>
              {detailsStatus === "saved" ? (
                <div className="details-saved"><Check size={18} /><span>Thanks. Your optional details are saved.</span></div>
              ) : (
                <div className="optional-details">
                  <label>Where do you code?<select value={tool} onChange={(event) => setTool(event.target.value as typeof tool)}><option value="">Prefer not to say</option>{tools.map((item) => <option key={item} value={item}>{toolLabels[item]}</option>)}</select></label>
                  <label>Your experience<select value={experience} onChange={(event) => setExperience(event.target.value as typeof experience)}><option value="">Prefer not to say</option>{experiences.map((item) => <option key={item} value={item}>{experienceLabels[item]}</option>)}</select></label>
                  <label>What should Unvibe help you learn?<textarea value={message} maxLength={500} rows={3} onChange={(event) => setMessage(event.target.value)} /></label>
                  {detailsStatus === "error" && <p className="form-error" role="alert">Optional details weren&apos;t saved. Your beta spot is still safe.</p>}
                  <button type="button" className="details-button" disabled={detailsStatus === "saving"} onClick={saveDetails}>{detailsStatus === "saving" ? "Saving…" : "Save optional details"}</button>
                </div>
              )}
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}{error && <small role="alert">{error}</small>}</label>;
}
