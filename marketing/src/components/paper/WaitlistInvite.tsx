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
        <p className="paper-meta">Private beta</p>
        <h2>Save a seat.</h2>
        <p className="paper-lead">Mac ships first. Windows can join the list. Name and email. You can skip the rest.</p>
        <div className="paper-invite__form">
          <PixelWaitlist variant="hero" />
        </div>
      </div>
    </div>
  );
}
