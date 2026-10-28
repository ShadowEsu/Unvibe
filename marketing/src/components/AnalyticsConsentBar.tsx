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

export const ANALYTICS_BAR_TEXT =
  "Unvibe would like to measure visits and record anonymous session replays with Mixpanel and PostHog to improve the site.";
export const ANALYTICS_GPC_TEXT = "Your browser sends Global Privacy Control, so Unvibe records no analytics.";

/**
 * First-visit analytics question: two equal buttons, nothing chosen for the visitor. Until Allow
 * is pressed nothing is tracked; ignoring the bar, or pressing Escape, leaves it that way. Not
 * shown to browsers that send Global Privacy Control, or on pages that never load analytics.
 * The footer's "Analytics settings" shows it again, so the answer can be changed at any time.
 */
export function AnalyticsConsentBar() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
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

  const close = () => {
    setOpen(false);
    setReopened(false);
    reopenedRef.current = false;
    returnFocus.current?.focus();
    returnFocus.current = null;
  };

  const choose = (choice: AnalyticsChoice) => {
    setAnalyticsConsent(choice);
    setCurrent(choice);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") close();
  };

  if (!open || (!reopened && !analyticsAllowedOnPath(pathname))) return null;

  return (
    <div className="consent-bar" role="region" aria-labelledby="consent-bar-text" tabIndex={-1} ref={barRef} onKeyDown={onKeyDown}>
      <p id="consent-bar-text">{gpc ? ANALYTICS_GPC_TEXT : ANALYTICS_BAR_TEXT}</p>
      {reopened && !gpc && current !== "ask" ? (
        <p className="consent-bar__now">Your choice now: {current === "allow" ? "Allow" : "No thanks"}.</p>
      ) : null}
      <div className="consent-bar__actions">
        <Link href="/privacy">Privacy</Link>
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
