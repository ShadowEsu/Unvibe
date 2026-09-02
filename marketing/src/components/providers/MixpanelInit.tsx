"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

/** Starts Mixpanel + PostHog (events, exception autocapture, surveys). */
export function MixpanelInit() {
  useEffect(() => {
    const windowWithIdle = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (windowWithIdle.requestIdleCallback) {
      const handle = windowWithIdle.requestIdleCallback(initAnalytics, { timeout: 5000 });
      return () => windowWithIdle.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(initAnalytics, 3500);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
