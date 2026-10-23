"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { prefersLiteExperience } from "@/lib/performanceMode";

interface TextRevealProps {
  text: string;
  /** Words to set in the accent style. Matched case-insensitively, punctuation ignored. */
  accent?: string[];
  className?: string;
}

/**
 * A statement whose accent words get one highlighter stroke when it is a third of the way up the
 * screen. Consecutive accent words share one stroke. Text is fully opaque throughout; without JS,
 * with reduced motion or on lite devices the stroke is simply there.
 */
export function TextReveal({ text, accent = [], className }: TextRevealProps) {
  const rootRef = useRef<HTMLParagraphElement>(null);
  const [marked, setMarked] = useState(false);
  const accented = new Set(accent.map((word) => word.toLowerCase()));

  const runs: { text: string; accent: boolean }[] = [];
  for (const word of text.split(/\s+/)) {
    const isAccent = accented.has(word.replace(/\W/g, "").toLowerCase());
    const last = runs[runs.length - 1];
    if (last && last.accent === isAccent) last.text += ` ${word}`;
    else runs.push({ text: word, accent: isAccent });
  }

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersLiteExperience() || typeof IntersectionObserver === "undefined") {
      setMarked(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setMarked(true);
      observer.disconnect();
    }, { rootMargin: "0px 0px -35% 0px" });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const classes = ["treveal", className, marked ? "is-marked" : null].filter(Boolean).join(" ");
  return (
    <p ref={rootRef} className={classes}>
      {runs.map((run, index) => (
        <Fragment key={index}>
          {index > 0 ? " " : null}
          {run.accent ? <span className="treveal__accent">{run.text}</span> : run.text}
        </Fragment>
      ))}
    </p>
  );
}
