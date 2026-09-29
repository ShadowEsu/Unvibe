"use client";

import { useEffect, useState } from "react";
import { DownloadRow } from "@/components/paper/DownloadLink";

const HEADLINE = "Understand the AI-generated code you ship.";

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
    <section className="paper-hero" aria-label="Unvibe">
      <img src="/hero/golden-gate.png" alt="" />
      <div className="paper-hero__veil" />
      <div className={ready ? "paper-hero__copy is-ready" : "paper-hero__copy"}>
        <h1 aria-label={HEADLINE}>
          {HEADLINE.split(" ").map((word, index, words) => (
            <span key={index} aria-hidden="true">
              <span className="hw" style={{ "--i": index } as React.CSSProperties}>{word}</span>
              {index < words.length - 1 ? " " : null}
            </span>
          ))}
        </h1>
        <p className="paper-hero__kicker">Select code. Unvibe explains it beside your editor. Save it, then quiz yourself.</p>
        <DownloadRow />
        <p className="paper-hero__fine">Free · No API key · No card</p>
      </div>
      <a href="#product" className="paper-hero__scroll" aria-label="Scroll to the demo">
        <span />
      </a>
    </section>
  );
}
