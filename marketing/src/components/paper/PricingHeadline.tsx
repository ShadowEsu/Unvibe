"use client";

import { useEffect, useState } from "react";

export function PricingHeadline() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setReady(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <h1 className={ready ? "pricing-headline is-ready" : "pricing-headline"}>
      Understanding should grow <span>with the codebase.</span>
      <span className="pricing-headline__next">Pick the layer you need.</span>
    </h1>
  );
}
