import { ANALYTICS_CONSENT_CHANGED } from "@/lib/analyticsConsent";
import { browserTrackingDisabled } from "@/lib/trackingOptOut";

const ANON_KEY = "unvibe_anon_id";

function shouldSkip(pathname: string): boolean {
  return (
    /\/waitlist(?:-admin)?(?:\/|$)/.test(pathname) ||
    /\/(?:stats(?:\.html)?|founder)(?:\/|$)/i.test(pathname) ||
    pathname.startsWith("/api/")
  );
}

function anonId(): string {
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `anon_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return `anon_${Date.now()}`;
  }
}

/**
 * Anonymous page-view beacon for founder stats.html: no PII, no code. Sent at most once per page,
 * and only once the visitor has allowed analytics, including when they press Allow on this page.
 * Returns the cleanup for the consent listener.
 */
export function startVisitBeacon(): () => void {
  let sent = false;
  const send = () => {
    if (sent || shouldSkip(window.location.pathname) || browserTrackingDisabled()) return;
    sent = true;
    const visitorId = anonId();
    void fetch("/api/stats/hit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitorId }),
      keepalive: true,
    }).catch(() => undefined);
  };
  send();
  window.addEventListener(ANALYTICS_CONSENT_CHANGED, send);
  return () => window.removeEventListener(ANALYTICS_CONSENT_CHANGED, send);
}
