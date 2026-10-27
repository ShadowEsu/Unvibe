"use client";

import { useEffect } from "react";
import { sendVisitHit } from "@/lib/visitHit";

/** Anonymous page-view beacon for founder stats.html — no PII, no code. */
export function VisitBeacon() {
  useEffect(() => {
    sendVisitHit();
  }, []);

  return null;
}
