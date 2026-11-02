"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { initAnalytics, syncSessionRecording } from "@/lib/analytics";
import { ANALYTICS_CONSENT_KEY } from "@/lib/analyticsConsent";
import { NOTRACK_STORAGE_KEY } from "@/lib/trackingOptOut";

/**
 * Starts Mixpanel (events, autocapture, session replay) on public pages, once the
 * visitor has pressed Allow on the analytics bar; before that `initAnalytics` loads nothing. On
 * every client navigation, including one that only changes the query (`?notrack=1`), and when
 * another tab changes the opt-out or the analytics answer, it turns capture and replay off or
 * back on for the current page.
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
      if (event.key === NOTRACK_STORAGE_KEY || event.key === ANALYTICS_CONSENT_KEY || event.key === null) {
        initAnalytics();
        syncSessionRecording();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
