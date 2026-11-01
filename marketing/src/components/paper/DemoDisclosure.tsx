"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The demo video behind a "Watch the demo" button (Design W2). A native <details>, so it opens without
 * JavaScript; links to /#tour (the palette's "Watch the demo") open it and scroll to it.
 */
export function DemoDisclosure({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const openForHash = () => {
      if (window.location.hash !== "#tour" || !ref.current) return;
      ref.current.open = true;
      document.getElementById("tour")?.scrollIntoView({ block: "start" });
    };
    openForHash();
    window.addEventListener("hashchange", openForHash);
    return () => window.removeEventListener("hashchange", openForHash);
  }, []);
  return (
    <details className="demo" ref={ref}>
      <summary className="dl-card__other demo__button">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" /></svg>
        <span>Watch the demo</span>
      </summary>
      {children}
    </details>
  );
}
