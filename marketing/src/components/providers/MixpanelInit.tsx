"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { initAnalytics, syncSessionRecording } from "@/lib/analytics";

/**
 * Starts Mixpanel + PostHog (events, exception autocapture, surveys) on public pages, and on
 * every client navigation stops or resumes session replay for admin and capability pages.
 */
export function MixpanelInit() {
  const pathname = usePathname();
  useEffect(() => {
    initAnalytics();
    syncSessionRecording();
  }, [pathname]);
  return null;
}
