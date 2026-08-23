"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

/** Starts Mixpanel with autocapture, session replay, and named events. */
export function MixpanelInit() {
  useEffect(() => {
    initAnalytics();
  }, []);
  return null;
}
