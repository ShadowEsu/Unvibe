"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

/** Starts Mixpanel + PostHog (events, exception autocapture, surveys). */
export function MixpanelInit() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return null;
}
