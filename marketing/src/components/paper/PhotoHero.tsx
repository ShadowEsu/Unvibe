"use client";

import { useEffect, useState } from "react";
import { JoinWaitlistRow } from "@/components/paper/JoinWaitlistLink";
import { ReleaseCountdown } from "@/components/ReleaseCountdown";

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
      <img src="/hero/golden-gate-v2.png" alt="" />
      <div className="paper-hero__veil" />
      <div className={ready ? "paper-hero__copy is-ready" : "paper-hero__copy"}>
        <h1>Learn the code<br />AI shipped.</h1>
        <p className="paper-hero__kicker">Select it. Press Command U. Keep it.</p>
        <JoinWaitlistRow href="/#waitlist" />
      </div>
      <div className={ready ? "paper-hero__foot is-ready" : "paper-hero__foot"}>
        <ReleaseCountdown variant="hero" />
      </div>
    </section>
  );
}
