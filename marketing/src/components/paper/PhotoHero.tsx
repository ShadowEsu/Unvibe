"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from "react";
import { InstallBox } from "@/components/paper/InstallBox";
import { ShareStep } from "@/components/paper/ShareStep";
import { STEPS } from "@/data/howItWorks";
import { track } from "@/lib/analytics";
import { AI_MAINTENANCE } from "@/lib/aiMaintenance";
import { browserTrackingDisabled } from "@/lib/trackingOptOut";
import { watchDownloadCtaView } from "@/lib/downloadTracking";
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
      <p className="vhero__fine" id="hero-email-note">One email with the download link for your Mac or PC. Unsubscribe any time. <a href="/privacy">Privacy</a></p>
    </div>
  );
}

/** A way to see a real explanation before installing anything. Gone while Try it is paused. */
function TryInBrowser({ device }: { device: VisitorDevice }) {
  if (AI_MAINTENANCE) return null;
  return (
    <a className="vhero__try" href="#try-it" onClick={() => track("hero_try_clicked", { device })}>
      Or try it online first
    </a>
  );
}

/**
 * Desktop: the install box for this computer (Terminal / PowerShell line first, the file second with its first-open
 * steps; the other OS one click away inside it), the browser demo under it. `actionsRef` marks the main call to
 * action for the viewed event.
 */
export function DownloadForThisComputer({ device, actionsRef }: { device: "mac" | "windows"; actionsRef: RefObject<HTMLDivElement> }) {
  return (
    <div className="vhero__cta">
      <div className="vhero__actions vhero__actions--install" ref={actionsRef}>
        <InstallBox os={device} surface="hero" />
        <TryInBrowser device={device} />
      </div>
      {/* Security-approved wording (2026-11-04). */}
      <p className="vhero__trust">
        <span className="vhero__trust-item">Free for Mac and Windows.</span>{" "}
        <span className="vhero__trust-item">No API key.</span>{" "}
        <span className="vhero__trust-item">Checks for keys and tokens on your computer.</span>
      </p>
    </div>
  );
}

/**
 * The demo's selected lines: a lime bar sweeps under each, and the ink copy of the text is revealed with it (a
 * transform-only window), so the swept part is ink on lime from its first frame, never white on lime (Design).
 */
function Selected({ line, text }: { line: 1 | 2; text: string }) {
  return (
    <span className={`ndemo__sel ndemo__sel--${line}`}>
      <i className="ndemo__bar" />
      <span className="ndemo__plain">{text}</span>
      <span className="ndemo__ink" aria-hidden="true"><span>{text}</span></span>
    </span>
  );
}

/**
 * The panel body's masks, as % of the capture, revealed in turn: the selected-code block first, then each answer
 * line. The panel's chrome (title row, tabs, Depth row, rail, buttons) is never masked, so the window reads as the
 * app from frame 0 (Design).
 */
const BODY_MASKS: readonly [top: number, height: number][] = [
  [20.2, 26.0],
  [47.5, 3.9], [52.1, 3.6], [55.6, 3.5], [59.1, 3.5], [62.5, 3.8], [67.6, 3.9], [72.1, 3.6], [75.8, 3.6], [79.3, 6.1],
];

/**
 * The window over the field: the selection as real editor text beside the real panel capture (data/howItWorks
 * step 1). CSS plays it in an 8 s loop (n.css `d-*`); off screen it pauses. Reduced motion and no JS show its
 * finished frame. Nothing in the capture is redrawn: the masks are the panel's own ground colour.
 */
function DemoWindow({ shortcut }: { shortcut: "mac" | "windows" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([entry]) => node.classList.toggle("is-paused", !entry.isIntersecting));
    io.observe(node);
    return () => io.disconnect();
  }, []);
  const panel = STEPS[0].image;
  const keys = shortcut === "windows" ? ["Ctrl", "Alt", "U"] : ["Control", "U"];
  return (
    <div className="ndemo" ref={ref}>
      <div className="ndemo__frame">
        <div className="ndemo__editor" aria-hidden="true">
          <p className="ndemo__path">src › debounce.js</p>
          <pre className="ndemo__code">
            <span className="k">function</span> debounce(fn, wait) {"{"}{"\n"}
            {"  "}<span className="k">let</span> timer;{"\n"}
            {"  "}<span className="k">return</span> (...args) =&gt; {"{"}{"\n"}
            <Selected line={1} text="    clearTimeout(timer);" />{"\n"}
            <Selected line={2} text="    timer = setTimeout(() => fn(...args), wait);" />{"\n"}
            {"  };\n"}
            {"}"}
          </pre>
          <div className="ndemo__keys">
            {keys.map((key, index) => (
              <span key={key} className={`ndemo__key ndemo__key--${index === keys.length - 1 ? 2 : 1}`}>{key}</span>
            ))}
          </div>
        </div>
        <div className="ndemo__panel">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size capture */}
          <img src={panel.src} width={panel.width} height={panel.height} alt={panel.alt} decoding="async" />
          <div className="ndemo__cover" aria-hidden="true">
            {BODY_MASKS.map(([top, height], k) => (
              <i key={top} style={{ "--k": k, top: `${top}%`, height: `${height}%` } as CSSProperties} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Homepage hero, direction N: the promise in white on the violet field, the giant wordmark behind the demo window,
 * and the light hill carrying one action for this device. The H1 and the wordmark never animate (LCP). Where the
 * browser has no scroll-driven animations, one rAF-throttled scroll handler moves the window and the wordmark while
 * the hero is on screen.
 */
export function PhotoHero() {
  const [device, setDevice] = useState<VisitorDevice>("mac");
  // Until detection runs, `device` is a guess; the viewed event waits for the real platform.
  const [detected, setDetected] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const parRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDevice(detectVisitorDevice(navigator.userAgent, navigator.maxTouchPoints));
    setDetected(true);
  }, []);

  useEffect(() => {
    if (!detected || device === "phone" || !actionsRef.current) return undefined;
    return watchDownloadCtaView(actionsRef.current, "hero", device);
  }, [detected, device]);

  useEffect(() => {
    const hero = heroRef.current, par = parRef.current, word = wordRef.current;
    if (!hero || !par || !word) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    if (window.CSS?.supports?.("animation-timeline: scroll()")) return undefined;
    let onScreen = true;
    let ticking = false;
    const paint = () => {
      ticking = false;
      const p = Math.min(Math.max(window.scrollY / 800, 0), 1);
      par.style.transform = `translate3d(0, ${(-40 * p).toFixed(2)}px, 0) scale(${(1 - 0.04 * p).toFixed(4)})`;
      word.style.transform = `translate3d(0, ${(-12 * p).toFixed(2)}px, 0)`;
    };
    const onScroll = () => {
      if (!onScreen || ticking) return;
      ticking = true;
      window.requestAnimationFrame(paint);
    };
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; });
    io?.observe(hero);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const shortcut = device === "windows" ? SHORTCUTS.windows.anywhere : SHORTCUTS.mac.anywhere;

  return (
    <section className="nhero" ref={heroRef} aria-labelledby="hero-title">
      <div className="nhero__field" aria-hidden="true" />
      <div className="nhero__copy">
        <h1 id="hero-title">
          Explain <span className="nhero__nowrap">AI-written</span> code in plain English.
        </h1>
        <p className="nhero__sub">
          {device === "phone" ? (
            "Unvibe is a free app for Mac and Windows. Select code on your computer, press one shortcut, and Vibe explains it beside your editor."
          ) : (
            <>
              Unvibe is a free app for Mac and Windows. Select code in any app, press <span className="nhero__nowrap"><kbd>{shortcut}</kbd>,</span> and Vibe explains it beside your editor.
            </>
          )}
        </p>
      </div>
      <div className="nhero__wm" ref={wordRef} aria-hidden="true">Unvibe</div>
      <div className="nhero__par" ref={parRef}>
        <DemoWindow shortcut={device === "windows" ? "windows" : "mac"} />
      </div>
      <div className="nhero__base" id="hill-cta">
        {device === "phone" ? (
          <>
            <EmailMeLink />
            <p className="vhero__fine vhero__claims">
              <span className="vhero__trust-item">Free for Mac and Windows.</span>{" "}
              <span className="vhero__trust-item">No API key.</span>{" "}
              <span className="vhero__trust-item">Checks for keys and tokens on your computer.</span>
            </p>
            <TryInBrowser device={device} />
          </>
        ) : (
          <DownloadForThisComputer device={device} actionsRef={actionsRef} />
        )}
      </div>
    </section>
  );
}
