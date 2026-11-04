"use client";

import { useEffect } from "react";
import { glassBackdropFrom } from "@/lib/glassBackdrop";

/**
 * BRANCH-ONLY (site/glass): sets `<html data-glass>` from `?glass=a|b` once per page load
 * (lib/glassBackdrop). The pages are static, so the query is read here in the browser, never on the
 * server. The attribute outlives client navigation, so a backdrop picked on one page holds while
 * clicking through. Remove once Preston has picked a backdrop.
 */
export function GlassBackdropSwitch() {
  useEffect(() => {
    document.documentElement.dataset.glass = glassBackdropFrom(window.location.search);
  }, []);
  return null;
}
