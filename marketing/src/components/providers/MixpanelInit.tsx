"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { initAnalytics, syncSessionRecording } from "@/lib/analytics";
import { NOTRACK_STORAGE_KEY } from "@/lib/trackingOptOut";

/**
 * Starts Mixpanel + PostHog (events, exception autocapture, surveys) on public pages. On every
 * client navigation, including one that only changes the query (`?notrack=1`), and when another
 * tab changes the opt-out, it turns capture and replay off or back on for the current page.
 */
export function MixpanelInit() {
  // useSearchParams needs a Suspense boundary, or every static page would render on the client only.
  return (
    <Suspense fallback={null}>
      <AnalyticsPageSync />
    </Suspense>
  );
}

function AnalyticsPageSync() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    initAnalytics();
    syncSessionRecording();
  }, [pathname, search]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      // A null key means another tab cleared all of this site's storage.
      if (event.key === NOTRACK_STORAGE_KEY || event.key === null) syncSessionRecording();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
