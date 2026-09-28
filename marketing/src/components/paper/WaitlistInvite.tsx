"use client";

import { useEffect, useRef, useState } from "react";
import { PixelWaitlist } from "@/components/redesign/PixelWaitlist";

export function WaitlistInvite() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setLit(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setLit(true);
        observer.disconnect();
      },
      { threshold: 0.32 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className={lit ? "paper-invite is-lit" : "paper-invite"}>
      <div className="paper-invite__card paper-glass">
        <p className="paper-meta">Release updates</p>
        <h2>Keep up with Unvibe.</h2>
        <p className="paper-lead">The unsigned Mac and Windows beta downloads are available above. Join for signed release updates, product notes, feedback invitations, and Teams news. Everything beyond that is optional.</p>
        <div className="paper-invite__form">
          <PixelWaitlist variant="hero" />
        </div>
      </div>
    </div>
  );
}
