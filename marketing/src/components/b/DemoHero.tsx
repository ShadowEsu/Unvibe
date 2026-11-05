"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { DownloadLink } from "@/components/paper/DownloadLink";
import { ShareStep } from "@/components/paper/ShareStep";
import { track } from "@/lib/analytics";
import { AI_MAINTENANCE } from "@/lib/aiMaintenance";
import { browserTrackingDisabled } from "@/lib/trackingOptOut";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";
import { trackDownloadClick, watchDownloadCtaView } from "@/lib/downloadTracking";
import { markRefUsed, storedRef } from "@/lib/referral";
import { SHORTCUTS, detectVisitorDevice, type VisitorDevice } from "@/lib/shortcuts";
import { DEMO_CODE, demoPhases, type DemoPhase } from "@/lib/demoLoop";

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
          analytics: !browserTrackingDisabled(),
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
      <div className="b-hero__phone" id="email-link" role="status">
        <p><strong>Sent.</strong> Open the email on your Mac or PC to download Unvibe.</p>
        {code ? <ShareStep code={code} surface="phone_hero" /> : null}
      </div>
    );
  }

  return (
    <div className="b-hero__phone" id="email-link">
      <form className="b-hero__email" onSubmit={submit}>
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
        <button type="submit" className="b-btn b-btn--ink" disabled={state === "busy"}>
          {state === "busy" ? "Sending…" : "Email me the link"}
        </button>
      </form>
      {error ? <p className="b-hero__error" id="hero-email-error" role="alert">{error}</p> : null}
      <p className="b-hero__fine" id="hero-email-note">One email with the download link for your Mac or PC. Unsubscribe any time. <a href="/privacy">Privacy</a></p>
    </div>
  );
}

/** A way to see a real explanation before installing anything. Gone while Try it is paused. */
function TryInBrowser({ device }: { device: VisitorDevice }) {
  if (AI_MAINTENANCE) return null;
  return (
    <a className="b-hero__try" href="#try-it" onClick={() => track("hero_try_clicked", { device })}>
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
    <div className="b-hero__cta">
      <div className="b-hero__actions" ref={actionsRef}>
        <DownloadLink href={device === "mac" ? BETA_MAC_DIRECT_DOWNLOAD : BETA_WINDOWS_DIRECT_DOWNLOAD} platform={device} surface="hero" tone="dark" />
        <TryInBrowser device={device} />
      </div>
      {/* Security-approved wording (2026-11-04); the other OS stays a plain link. */}
      <p className="b-hero__trust">
        Free for Mac and Windows. No API key. Checks for keys and tokens on your computer.{" "}
        <a href={other === "mac" ? BETA_MAC_DIRECT_DOWNLOAD : BETA_WINDOWS_DIRECT_DOWNLOAD} onClick={() => trackDownloadClick("hero_other_os", other)}>
          {other === "mac" ? "Get it for Mac" : "Get it for Windows"}
        </a>
      </p>
    </div>
  );
}

/** One line of the demo's JavaScript, coloured like the editor: keywords, then the rest. */
function CodeLine({ text, index }: { text: string; index: number }) {
  const match = /^(\s*)(function|let|return)?(.*)$/.exec(text);
  const [, indent = "", keyword, rest = ""] = match ?? [];
  return (
    <span className="b-code__line" style={{ ["--line" as string]: index }}>
      {indent}
      {keyword ? <span className="b-code__kw">{keyword}</span> : null}
      {rest}
      {"\n"}
    </span>
  );
}

/**
 * The hero plays the product: the code is selected, the shortcut is pressed, and the real 0.1.48 panel
 * (a screenshot of this exact function) appears. The server HTML is the finished frame, so no JS,
 * reduced motion and the first paint all show the panel; the loop only starts after hydration, pauses
 * off-screen and in hidden tabs, and returns to the finished frame whenever it stops.
 */
function DemoStage({ keys }: { keys: readonly string[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<DemoPhase>("done");

  useEffect(() => {
    const node = stage.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let timer = 0;
    let step = 0;
    let visible = false;
    const phases = demoPhases(keys.length);
    const run = () => {
      const [next, wait] = phases[step % phases.length]!;
      setPhase(next);
      step += 1;
      timer = window.setTimeout(run, wait);
    };
    const sync = () => {
      const play = visible && !document.hidden;
      // The ribbon's slow drift (b.css) pauses with the demo.
      node.dataset.in = String(play);
      window.clearTimeout(timer);
      if (play) {
        // First start waits for the page to settle; a resume starts the loop from the top.
        timer = window.setTimeout(run, step === 0 ? 1400 : 300);
        step = 0;
      } else {
        setPhase("done");
      }
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      sync();
    });
    io.observe(node);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [keys.length]);

  return (
    <div className="b-stage" ref={stage} data-phase={phase}>
      {/* Design's vibrant ribbon: 3 rotated gradient strands behind the demo; no blur. It drifts slowly (transform only) while on screen. */}
      <div className="b-ribbon" aria-hidden="true"><i className="b-ribbon__1" /><i className="b-ribbon__2" /><i className="b-ribbon__3" /></div>
      <div className="b-editor" aria-hidden="true">
        <div className="b-editor__path">src › debounce.js</div>
        <pre className="b-code"><code>{DEMO_CODE.map((line, index) => <CodeLine key={index} text={line} index={index} />)}</code></pre>
        <div className="b-keys">
          {keys.map((key, index) => (
            <kbd key={key} style={{ ["--key" as string]: index }}>{key}</kbd>
          ))}
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size real screenshot */}
      <img
        className="b-stage__panel"
        src="/unvibe/real/panel-explained-top.webp"
        width={880}
        height={1131}
        alt="The Unvibe panel explaining this debounce function at the Intermediate depth."
        decoding="async"
      />
    </div>
  );
}

/** Homepage hero: the promise and one action centred, the product working under it. */
export function DemoHero() {
  const [device, setDevice] = useState<VisitorDevice>("mac");
  // Until detection runs, `device` is a guess; the viewed event waits for the real platform.
  const [detected, setDetected] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDevice(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints));
    setDetected(true);
  }, []);

  useEffect(() => {
    if (!detected || device === "phone" || !actionsRef.current) return undefined;
    return watchDownloadCtaView(actionsRef.current, "hero", device);
  }, [detected, device]);

  const shortcut = device === "windows" ? SHORTCUTS.windows.anywhere : SHORTCUTS.mac.anywhere;

  return (
    <section className="b-hero" aria-labelledby="hero-title">
      <div className="b-wrap b-hero__grid">
        <div className="b-hero__copy">
          {/* The h1 is the LCP: no entrance motion on it. */}
          <h1 id="hero-title">
            Understand the code <span className="b-hl">your AI just wrote.</span>
          </h1>
          <p className="b-hero__kicker" data-b-in="1">
            {device === "phone" ? (
              "Select code on your Mac or PC, press one shortcut, and Vibe explains it in plain English beside your editor."
            ) : (
              <>
                Select code in any app, press <kbd>{shortcut}</kbd>, and Vibe explains it in plain English beside your editor.
              </>
            )}
          </p>
          <div data-b-in="2">
            {device === "phone" ? (
              <>
                <EmailMeLink />
                <p className="b-hero__trust">Free for Mac and Windows. No API key. Checks for keys and tokens on your computer.</p>
                <TryInBrowser device={device} />
              </>
            ) : (
              <DownloadForThisComputer device={device} actionsRef={actionsRef} />
            )}
          </div>
        </div>
        <div className="b-hero__demo" data-b-in="3">
          <DemoStage keys={shortcut.split("+")} />
        </div>
      </div>
    </section>
  );
}
