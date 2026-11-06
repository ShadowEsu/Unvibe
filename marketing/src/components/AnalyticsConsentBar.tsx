"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { setAnalyticsConsent } from "@/lib/analytics";
import {
  ANALYTICS_CONSENT_KEY,
  OPEN_ANALYTICS_SETTINGS,
  browserAnalyticsConsent,
  browserGlobalPrivacyControl,
  type AnalyticsChoice,
  type AnalyticsConsent,
} from "@/lib/analyticsConsent";
import { analyticsAllowedOnPath } from "@/lib/analyticsPrivacy";
import { sendConsentAnswer } from "@/lib/consentAnswerClient";

export const ANALYTICS_BAR_TEXT =
  "Unvibe would like to measure visits and record session replays, with page text hidden, using Mixpanel to improve the site.";
export const ANALYTICS_GPC_TEXT =
  "Your browser sends Global Privacy Control, so Unvibe loads no analytics. The site still counts daily totals, with no ID or cookie.";

/**
 * First-visit analytics question: two equal buttons, nothing chosen for the visitor. Until Allow
 * is pressed nothing is tracked; ignoring the bar, or pressing Escape, leaves it that way. Not
 * shown to browsers that send Global Privacy Control, or on pages that never load analytics.
 * The footer's "Analytics settings" shows it again, so the answer can be changed at any time.
 *
 * The server renders it open, so a first visit sees it with the page rather than after hydration
 * (it is the largest text in a phone's first view, so its paint time was the home page's LCP). Until
 * the client has read the stored answer (`data-live`), CSS hides it for browsers whose boot script
 * found an answer or GPC (`consent-known`, theme.ts) and for browsers without JS.
 */
export function AnalyticsConsentBar() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(true);
  const [live, setLive] = useState(false);
  const [reopened, setReopened] = useState(false);
  const [current, setCurrent] = useState<AnalyticsConsent>("ask");
  const [gpc, setGpc] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const reopenedRef = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const consent = browserAnalyticsConsent();
    setCurrent(consent);
    setOpen(consent === "ask");
    setLive(true);
    const onOpen = () => {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      reopenedRef.current = true;
      setGpc(browserGlobalPrivacyControl());
      setCurrent(browserAnalyticsConsent());
      setReopened(true);
      setOpen(true);
    };
    // An answer given in another tab closes the first-visit bar here too.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== ANALYTICS_CONSENT_KEY && event.key !== null) return;
      const next = browserAnalyticsConsent();
      setCurrent(next);
      setOpen(next === "ask" || reopenedRef.current);
    };
    window.addEventListener(OPEN_ANALYTICS_SETTINGS, onOpen);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(OPEN_ANALYTICS_SETTINGS, onOpen);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Opened from the footer: move focus to the bar so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (open && reopened) barRef.current?.focus();
  }, [open, reopened]);

  // While it shows, keyboard focus scrolls into view above it, not under it (WCAG 2.4.11).
  useEffect(() => {
    const bar = barRef.current;
    if (!open || !live || !bar) return undefined;
    const html = document.documentElement;
    const fit = () => {
      html.style.removeProperty("scroll-padding-bottom");
      const base = getComputedStyle(html).scrollPaddingBottom;
      const space = Math.ceil(window.innerHeight - bar.getBoundingClientRect().top) + 12;
      html.style.scrollPaddingBottom = `max(${base === "auto" ? "0px" : base}, ${space}px)`;
    };
    fit();
    const resize = new ResizeObserver(fit);
    resize.observe(bar);
    window.addEventListener("resize", fit);
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", fit);
      html.style.removeProperty("scroll-padding-bottom");
    };
  }, [open, live]);

  // Focus goes back to where the footer reopen came from; after a first-visit answer it moves on to the
  // page (#main), never to <body>.
  const close = () => {
    const hadFocus = barRef.current?.contains(document.activeElement) ?? false;
    const back = returnFocus.current;
    returnFocus.current = null;
    setOpen(false);
    setReopened(false);
    reopenedRef.current = false;
    if (back?.isConnected) back.focus();
    else if (hadFocus) document.getElementById("main")?.focus({ preventScroll: true });
  };

  // Only the two answer buttons count, one per press (Security C-1). Escape and the GPC bar's OK
  // call close() and send nothing.
  const choose = (choice: AnalyticsChoice) => {
    setAnalyticsConsent(choice);
    sendConsentAnswer(choice);
    setCurrent(choice);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") close();
  };

  if (!open || (!reopened && !analyticsAllowedOnPath(pathname))) return null;

  return (
    <div className="consent-bar" data-live={live ? "" : undefined} role="region" aria-label="Analytics choice" aria-describedby="consent-bar-text" tabIndex={-1} ref={barRef} onKeyDown={onKeyDown}>
      {/* Under 360px the Privacy link ends the text so the two buttons fit on one row (Design, 320px pass). Only one of the two links is ever displayed. */}
      <p id="consent-bar-text">{gpc ? ANALYTICS_GPC_TEXT : ANALYTICS_BAR_TEXT} <Link className="consent-bar__privacy consent-bar__privacy--inline" href="/privacy">Privacy</Link></p>
      {reopened && !gpc && current !== "ask" ? (
        <p className="consent-bar__now">Your choice now: {current === "allow" ? "Allow" : "No thanks"}.</p>
      ) : null}
      <div className="consent-bar__actions">
        <Link className="consent-bar__privacy" href="/privacy">Privacy</Link>
        {gpc ? (
          <button type="button" className="consent-bar__btn" onClick={close}>OK</button>
        ) : (
          <>
            <button type="button" className="consent-bar__btn" onClick={() => choose("allow")}>Allow</button>
            <button type="button" className="consent-bar__btn" onClick={() => choose("deny")}>No thanks</button>
          </>
        )}
      </div>
    </div>
  );
}
