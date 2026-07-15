"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Loader2, PartyPopper } from "lucide-react";
import { Section } from "../Section";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { waitlistSchema, type WaitlistInput } from "@/lib/waitlistSchema";

type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

interface SuccessData {
  referralCode: string;
  duplicate: boolean;
}

export function Waitlist() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SuccessData | null>(null);
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<WaitlistInput>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { name: "", email: "", role: "", message: "", referredBy: "" },
  });


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) setValue("referredBy", ref.slice(0, 32));
    const utmSource = params.get("utm_source");
    const utmMedium = params.get("utm_medium");
    const utmCampaign = params.get("utm_campaign");
    if (utmSource) setValue("utmSource", utmSource.slice(0, 64));
    if (utmMedium) setValue("utmMedium", utmMedium.slice(0, 64));
    if (utmCampaign) setValue("utmCampaign", utmCampaign.slice(0, 64));
  }, [setValue]);

  const markStarted = () => {
    if (!started) {
      setStarted(true);
      track("waitlist_started");
    }
  };

  const onSubmit = async (values: WaitlistInput) => {
    setStatus("submitting");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => ({}))) as {
        referralCode?: string;
        duplicate?: boolean;
        error?: string;
      };

      if (!res.ok) {
        setStatus("error");
        return;
      }

      setResult({
        referralCode: data.referralCode ?? "",
        duplicate: Boolean(data.duplicate),
      });
      setStatus(data.duplicate ? "duplicate" : "success");
      track("waitlist_completed", {
        duplicate: Boolean(data.duplicate),
        tool: values.tool,
        experience: values.experience,
      });
    } catch {
      setStatus("error");
    }
  };

  const shareUrl =
    result?.referralCode && typeof window !== "undefined"
      ? `${window.location.origin}/?ref=${result.referralCode}`
      : "";

  const copyReferral = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      track("referral_copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can fail silently in some browsers.
    }
  };

  return (
    <Section
      id="waitlist"
      eyebrow="Private beta"
      title="Join the private beta."
      subtitle="Mac first. We’ll email you when an invite is ready."
      narrow
    >
      <div className="rounded-card border border-line bg-surface p-6 sm:p-9">
        <AnimatePresence mode="wait">
          {status === "success" || status === "duplicate" ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.2, 0, 0.2, 1] }}
              className="text-center"
            >
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green/15 text-green">
                <PartyPopper size={28} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-fluid-xl font-semibold text-fg">
                {status === "duplicate"
                  ? "You are already on the list"
                  : "You are on the list"}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-fluid-base text-fg-muted">
                {status === "duplicate"
                  ? "Good news — we already had your spot saved. Here is your referral link either way."
                  : "We will email your invite when the Mac beta opens. Share your link to move up the list."}
              </p>

              {shareUrl && (
                <div className="mx-auto mt-7 flex max-w-md items-center gap-2 rounded-pill border border-line bg-surface-2/60 p-1.5 pl-5">
                  <span className="flex-1 truncate text-left font-mono text-fluid-sm text-fg-muted">
                    {shareUrl}
                  </span>
                  <button
                    type="button"
                    onClick={copyReferral}
                    className="flex items-center gap-1.5 rounded-pill bg-primary px-5 py-2.5 text-fluid-sm font-medium text-on-primary transition-colors hover:bg-primary-strong"
                  >
                    {copied ? (
                      <>
                        <Check size={15} aria-hidden="true" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={15} aria-hidden="true" /> Copy
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{
                opacity: status === "submitting" ? 0.64 : 1,
                y: status === "submitting" ? -2 : 0,
              }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.2, 0, 0.2, 1] }}
              onSubmit={handleSubmit(onSubmit)}
              onChange={markStarted}
              noValidate
              aria-busy={status === "submitting"}
              className="space-y-7"
            >
              <div>
                <p className="text-fluid-sm font-medium text-fg">A few quick details</p>
                <p className="mt-1 text-fluid-sm leading-relaxed text-fg-muted">
                  This takes less than a minute and helps us invite a useful mix of early testers.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="First name" htmlFor="name" error={errors.name?.message} optional>
                  <input
                    id="name"
                    type="text"
                    autoComplete="given-name"
                    placeholder="Preston"
                    aria-invalid={Boolean(errors.name)}
                    {...register("name")}
                    className={inputClass(Boolean(errors.name))}
                  />
                </Field>
                <Field label="Role or position" htmlFor="role" error={errors.role?.message} optional>
                  <input
                    id="role"
                    type="text"
                    autoComplete="organization-title"
                    placeholder="Software engineer"
                    aria-invalid={Boolean(errors.role)}
                    {...register("role")}
                    className={inputClass(Boolean(errors.role))}
                  />
                </Field>
              </div>

              <Field label="Email" htmlFor="email" error={errors.email?.message}>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                  className={inputClass(Boolean(errors.email))}
                />
              </Field>

              {status === "error" && (
                <p
                  role="alert"
                  className="rounded-xl border border-red/40 bg-red/10 px-4 py-3 text-fluid-sm text-red"
                >
                  Something went wrong. Please check your connection and try again.
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="btn-magnetic flex h-13 w-full items-center justify-center gap-2 rounded-pill bg-primary text-fluid-base font-medium text-on-primary transition-colors hover:bg-primary-strong disabled:opacity-60"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                    Joining
                  </>
                ) : (
                  "Join the private beta"
                )}
              </button>

              <p className="text-center text-fluid-sm text-fg-faint">
                By joining, you agree to our{" "}
                <a href="/terms" className="underline underline-offset-2 hover:text-fg">
                  terms
                </a>{" "}
                and{" "}
                <a href="/privacy" className="underline underline-offset-2 hover:text-fg">
                  privacy policy
                </a>
                .
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </Section>
  );
}

function inputClass(hasError: boolean): string {
  return cn(
    "w-full rounded-xl border bg-bg px-4 py-3.5 text-fluid-base text-fg placeholder:text-fg-faint transition-colors focus:border-primary focus-visible:outline-none",
    hasError ? "border-red/60" : "border-line hover:border-line-strong"
  );
}

function Field({
  label,
  htmlFor,
  error,
  optional,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2.5 flex items-center gap-2 text-fluid-sm font-medium text-fg"
      >
        {label}
        {optional && <span className="text-fg-faint">(optional)</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-fluid-sm text-red">
          {error}
        </p>
      )}
    </div>
  );
}
