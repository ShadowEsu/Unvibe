"use client";

import { useEffect, useState } from "react";
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
      <img src="/hero/golden-gate.png" alt="" />
      <div className="paper-hero__veil" />
      <div className={ready ? "paper-hero__copy is-ready" : "paper-hero__copy"}>
        <div className="paper-hero__badge">
          <span className="paper-hero__badge-dot" aria-hidden="true" />
          <span>Desktop Overlay for Cursor & VS Code</span>
        </div>
        <h1>Understand the AI-generated code you ship.</h1>
        <p className="paper-hero__kicker">
          Highlight code in your editor → Unvibe explains it in a floating card beside your window → save it, quiz yourself, keep ownership.
        </p>
        <div className="paper-hero__actions">
          <a href="#install" className="paper-hero__cta-primary">
            Download for Mac & Windows
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </a>
          <a href="#product" className="paper-hero__cta-secondary">
            See how it works
          </a>
        </div>
      </div>
      <div className={ready ? "paper-hero__foot is-ready" : "paper-hero__foot"}>
        <ReleaseCountdown variant="hero" />
      </div>
    </section>
  );
}
