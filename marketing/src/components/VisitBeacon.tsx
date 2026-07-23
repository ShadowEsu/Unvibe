"use client";

import { useEffect } from "react";

const ANON_KEY = "unvibe_anon_id";

function shouldSkip(pathname: string): boolean {
  return (
    /\/waitlist(?:-admin)?(?:\/|$)/.test(pathname) ||
    /\/stats\.html$/i.test(pathname) ||
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

/** Anonymous page-view beacon for founder stats.html — no PII, no code. */
export function VisitBeacon() {
  useEffect(() => {
    if (shouldSkip(window.location.pathname)) return;
    const visitorId = anonId();
    void fetch("/api/stats/hit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitorId }),
      keepalive: true,
    }).catch(() => undefined);
  }, []);

  return null;
}
