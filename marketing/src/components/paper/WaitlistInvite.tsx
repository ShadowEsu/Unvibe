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
        <p className="paper-meta">Unvibe community</p>
        <h2>Download now. Stay close to what ships next.</h2>
        <p className="paper-lead">Unvibe is available on Mac and Windows. Leave your name and email for product notes, feedback invitations, and Teams updates. Everything beyond that is optional.</p>
        <div className="paper-invite__form">
          <PixelWaitlist variant="hero" />
        </div>
      </div>
    </div>
  );
}
