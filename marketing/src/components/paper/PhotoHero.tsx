"use client";

import { useEffect, useState } from "react";
import { JoinWaitlistRow } from "@/components/paper/JoinWaitlistLink";

export function PhotoHero() {
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
    <section className="paper-hero" aria-label="Unvibe private beta">
      <img src="/hero/golden-gate.png" alt="" />
      <div className="paper-hero__veil" />
      <div className={ready ? "paper-hero__copy is-ready" : "paper-hero__copy"}>
        <h1>Understand the AI-generated code you ship.</h1>
        <p className="paper-hero__kicker">Select code. Unvibe explains it beside your editor. Save it, then quiz yourself.</p>
        <JoinWaitlistRow href="/#waitlist" />
      </div>
    </section>
  );
}
