"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { DownloadLink } from "@/components/paper/DownloadLink";
import { ShareStep } from "@/components/paper/ShareStep";
import { Vibe } from "@/components/paper/Vibe";
import { track } from "@/lib/analytics";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";
import { trackDownloadClick, watchDownloadCtaView } from "@/lib/downloadTracking";
import { markRefUsed, storedRef } from "@/lib/referral";
import { SHORTCUTS, detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";

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
      const body = (await response.json().catch(() => ({}))) as { referralCode?: string; error?: string };
      if (!response.ok) throw new Error(body.error || "That didn't go through. Try again in a minute.");
      if (referredBy) markRefUsed();
      setCode(body.referralCode ?? "");
      setState("done");
      track("waitlist_completed", { surface: "phone_hero" });
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
      <p className="vhero__fine" id="hero-email-note">One email with the download link for your Mac or PC. Unsubscribe any time.</p>
    </div>
  );
}

/** A way to see a real explanation before installing anything. */
function TryInBrowser({ device }: { device: VisitorDevice }) {
  return (
    <a className="vhero__try" href="#try-it" onClick={() => track("hero_try_clicked", { device })}>
      Or try it online first
    </a>
  );
}

/**
 * Desktop: one download button for this computer, the browser demo beside it, the other OS in the trust line.
 * `actionsRef` marks the main call to action for the viewed event.
 */
export function DownloadForThisComputer({ device, actionsRef }: { device: "mac" | "windows"; actionsRef: RefObject<HTMLDivElement> }) {
  const other = device === "mac" ? "windows" : "mac";
  return (
    <div className="vhero__cta">
      <div className="vhero__actions" ref={actionsRef}>
        <DownloadLink href={device === "mac" ? BETA_MAC_DIRECT_DOWNLOAD : BETA_WINDOWS_DIRECT_DOWNLOAD} platform={device} surface="hero" />
        <TryInBrowser device={device} />
      </div>
      <p className="vhero__trust">
        Free for Mac + Windows · No API key · Keys and tokens filtered on your computer ·{" "}
        <a href={other === "mac" ? BETA_MAC_DIRECT_DOWNLOAD : BETA_WINDOWS_DIRECT_DOWNLOAD} onClick={() => trackDownloadClick("hero_other_os", other)}>
          {other === "mac" ? "Get it for Mac" : "Get it for Windows"}
        </a>
      </p>
    </div>
  );
}

/** Homepage hero: one promise, what happens when you use it, one action for this device. The recording follows. */
export function PhotoHero() {
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<VisitorDevice>("mac");
  // Until detection runs, `device` is a guess; the viewed event waits for the real platform.
  const [detected, setDetected] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDevice(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints));
    setDetected(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setReady(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!detected || device === "phone" || !actionsRef.current) return undefined;
    return watchDownloadCtaView(actionsRef.current, "hero", device);
  }, [detected, device]);

  const shortcut = device === "windows" ? SHORTCUTS.windows.anywhere : SHORTCUTS.mac.anywhere;

  return (
    <section className={ready ? "vhero is-ready" : "vhero"} aria-labelledby="hero-title">
      <div className="vhero__copy">
        <div className="vhero__vibe">
          <Vibe size={72} />
          <span className="vhero__bubble">{device === "phone" ? "psst, I live on your Mac or PC" : "hi, I'm Vibe"}</span>
        </div>
        <h1 id="hero-title">
          <span className="vhero__lead">Understand the code</span> <em>your AI just wrote.</em>
        </h1>
        <p className="vhero__kicker">
          {device === "phone" ? (
            "Select code on your Mac or PC, press one shortcut, and Vibe explains it in plain English beside your editor."
          ) : (
            <>
              Select code in any app, press <kbd>{shortcut}</kbd>, and Vibe explains it in plain English beside your editor.
            </>
          )}
        </p>
        {device === "phone" ? (
          <>
            <EmailMeLink />
            <p className="vhero__fine">Free for Mac + Windows · No API key · Keys and tokens filtered on your computer</p>
            <TryInBrowser device={device} />
          </>
        ) : (
          <DownloadForThisComputer device={device} actionsRef={actionsRef} />
        )}
      </div>
    </section>
  );
}
