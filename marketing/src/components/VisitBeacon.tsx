"use client";

import { useEffect } from "react";
import { startVisitBeacon } from "@/lib/visitBeacon";

/** Page-view beacon for founder stats, sent only after Allow (src/lib/visitBeacon.ts). */
export function VisitBeacon() {
  useEffect(() => startVisitBeacon(), []);
  return null;
}
