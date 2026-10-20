"use client";

import { useEffect, useRef } from "react";
import { prefersLiteExperience } from "@/lib/performanceMode";

interface TextRevealProps {
  text: string;
  /** Words to set in the accent style. Matched case-insensitively, punctuation ignored. */
  accent?: string[];
  className?: string;
}

const START = 0.9; // reveal begins when the block's top reaches 90% of the viewport
const END = 0.3; // and is complete when its bottom reaches 30%

/**
 * A statement underlined word by word as it scrolls through the viewport.
 * Text stays fully opaque before, during and after the animation. Visitors who
 * prefer reduced motion (or lite devices) get readable text with no scroll work.
 */
export function TextReveal({ text, accent = [], className }: TextRevealProps) {
  const rootRef = useRef<HTMLParagraphElement>(null);
  const words = text.split(/\s+/);
  const accented = new Set(accent.map((word) => word.toLowerCase()));

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersLiteExperience()) return;
    const spans = Array.from(root.querySelectorAll<HTMLSpanElement>("[data-word]"));
    let frame = 0;
    let visible = false;

    const paint = () => {
      frame = 0;
      const rect = root.getBoundingClientRect();
      const vh = window.innerHeight;
      const span = rect.height + vh * (START - END);
      const progress = Math.min(1, Math.max(0, (vh * START - rect.top) / span));
      const lit = progress * spans.length;
      spans.forEach((word, index) => word.classList.toggle("is-lit", index < lit));
    };
    const schedule = () => { if (visible && !frame) frame = window.requestAnimationFrame(paint); };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });

    root.classList.add("treveal--live");
    paint();
    observer.observe(root);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
      root.classList.remove("treveal--live");
      spans.forEach((word) => word.classList.remove("is-lit"));
    };
  }, [text]);

  return (
    <p ref={rootRef} className={className ? `treveal ${className}` : "treveal"}>
      {words.map((word, index) => {
        const bare = word.replace(/\W/g, "").toLowerCase();
        return (
          <span key={`${word}-${index}`} data-word className={accented.has(bare) ? "treveal__accent" : undefined}>
            {word}{index < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </p>
  );
}
