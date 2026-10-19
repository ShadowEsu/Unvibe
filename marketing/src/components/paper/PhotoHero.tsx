"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DownloadLink } from "@/components/paper/DownloadLink";
import { ShareStep } from "@/components/paper/ShareStep";
import { Vibe } from "@/components/paper/Vibe";
import { track } from "@/lib/analytics";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";
import { markRefUsed, storedRef } from "@/lib/referral";
import { SHORTCUTS, detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";

const LEAD = "Understand the code";
const ACCENT = "AI writes for you.";

/**
 * Phones can't run the desktop app, so the one action there is "email me the link".
 * It joins the existing list (waitlist_entries) and sends the welcome email with the download.
 */
function EmailMeLink() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState("busy");
    setError("");
    const params = new URLSearchParams(window.location.search);
    const referredBy = storedRef();
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: "",
          lastName: "",
          referredBy,
          utmSource: (params.get("utm_source") ?? "").slice(0, 64),
          utmMedium: (params.get("utm_medium") ?? "").slice(0, 64),
          utmCampaign: (params.get("utm_campaign") ?? "").slice(0, 64),
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { referralCode?: string; duplicate?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || "That didn't go through. Try again in a minute.");
      if (referredBy) markRefUsed();
      setCode(body.referralCode ?? "");
      setState("done");
      track("waitlist_completed", { surface: "phone_hero", duplicate: Boolean(body.duplicate) });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That didn't go through. Try again in a minute.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="vhero__phone" id="email-link" role="status">
        <p><strong>Sent.</strong> Open the email on your Mac or PC to download Unvibe.</p>
        {code ? <ShareStep code={code} surface="phone_hero" /> : null}
      </div>
    );
  }

  return (
    <div className="vhero__phone" id="email-link">
      <p>Unvibe runs on your Mac or PC. We&apos;ll email you the download link.</p>
      <form className="vhero__email" onSubmit={submit}>
        <input
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          aria-label="Your email"
          aria-describedby={error ? "hero-email-note hero-email-error" : "hero-email-note"}
          aria-invalid={Boolean(error)}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="paper-join paper-join--win" disabled={state === "busy"}>
          <span className="paper-join__label">{state === "busy" ? "Sending…" : "Email me the link"}</span>
        </button>
      </form>
      {error ? <p className="vhero__error" id="hero-email-error" role="alert">{error}</p> : null}
      <p className="vhero__fine" id="hero-email-note">One email with the link. Unsubscribe any time.</p>
    </div>
  );
}

/** Desktop: one download button for this computer, plus the other OS as a quiet link. */
function DownloadForThisComputer({ device }: { device: "mac" | "windows" }) {
  const other = device === "mac" ? "windows" : "mac";
  return (
    <div className="vhero__cta">
      <DownloadLink href={device === "mac" ? BETA_MAC_DIRECT_DOWNLOAD : BETA_WINDOWS_DIRECT_DOWNLOAD} platform={device} />
      <p className="vhero__fine">
        Free · No card · No API key ·{" "}
        <a href={other === "mac" ? BETA_MAC_DIRECT_DOWNLOAD : BETA_WINDOWS_DIRECT_DOWNLOAD} onClick={() => track("download_cta_clicked", { platform: other, surface: "hero_other_os" })}>
          {other === "mac" ? "Get it for Mac" : "Get it for Windows"}
        </a>
      </p>
    </div>
  );
}

/** Homepage hero: one promise, one action for this device, a way to try it first. */
export function PhotoHero() {
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<VisitorDevice>("mac");

  useEffect(() => {
    setDevice(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setReady(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const shortcut = device === "windows" ? SHORTCUTS.windows.anywhere : SHORTCUTS.mac.anywhere;

  return (
    <section className={ready ? "vhero is-ready" : "vhero"} aria-label="Unvibe">
      <div className="vhero__copy">
        <div className="vhero__vibe">
          <Vibe size={96} />
          <span className="vhero__bubble">{device === "phone" ? "psst, I live on your Mac or PC" : `psst, select code and press ${shortcut}`}</span>
        </div>
        <h1 aria-label={`${LEAD} ${ACCENT}`}>
          <span className="vhero__lead">{LEAD}</span> <em>{ACCENT}</em>
        </h1>
        <p className="vhero__kicker">
          Select code, press one shortcut. Vibe explains it beside your editor, then checks you got it.
        </p>
        {device === "phone" ? <EmailMeLink /> : <DownloadForThisComputer device={device} />}
        <a className="vhero__try" href="#try-it" onClick={() => track("hero_try_clicked", { device })}>
          Or try it in your browser first
        </a>
      </div>
    </section>
  );
}
