"use client";

import { useLayoutEffect } from "react";
import { prefersLiteExperience } from "@/lib/performanceMode";

export function PerformanceMode() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      root.dataset.performance = prefersLiteExperience() ? "lite" : "full";
    };
    update();
    reducedMotion.addEventListener("change", update);
    return () => reducedMotion.removeEventListener("change", update);
  }, []);

  return null;
}
