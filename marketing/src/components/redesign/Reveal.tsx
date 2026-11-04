"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
}

/** Blocks that come into view together enter 60 ms apart, capped at the 6th (Design motion spec). */
const STAGGER_MS = 60;
const STAGGER_CAP = 5;
let batch = 0;
let batchFrame = 0;

function nextDelay(): number {
  if (!batchFrame) {
    batchFrame = requestAnimationFrame(() => {
      batch = 0;
      batchFrame = 0;
    });
  }
  return Math.min(batch++, STAGGER_CAP) * STAGGER_MS;
}

/**
 * Fades a block in once, the first time it reaches 90 % of the viewport: opacity and a 16 px rise over
 * 400 ms. Never wrap a page's h1, kicker or primary CTA, which paint at once. Reduced motion: no motion.
 */
export function Reveal({ children, className }: RevealProps) {
  const reducedMotion = useReducedMotion();
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || reducedMotion) return;

    const reveal = () => {
      element.animate(
        [
          { opacity: 0, transform: "translate3d(0, 16px, 0)" },
          { opacity: 1, transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration: 400,
          delay: nextDelay(),
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "both",
        },
      );
    };

    if (!("IntersectionObserver" in window)) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        reveal();
        observer.disconnect();
      },
      { rootMargin: "0px 0px -10%", threshold: 0 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={elementRef}
      className={className}
    >
      {children}
    </div>
  );
}
