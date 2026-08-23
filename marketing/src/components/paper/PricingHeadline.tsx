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
      You will spend <span>15,000 hours+</span> on vibe coding.
      <span className="pricing-headline__next">Make them count.</span>
    </h1>
  );
}
