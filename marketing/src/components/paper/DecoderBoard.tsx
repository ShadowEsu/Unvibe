"use client";

import { useEffect, useRef, useState } from "react";

const ROWS = [
  "SELECT CODE",
  "PRESS COMMAND U",
  "EXPLAIN IN PLACE",
  "TEST YOUR KNOWLEDGE",
  "KEEP WHAT YOU LEARN",
];

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Deterministic first frame so server and client render the same text. */
function noiseRow(row: string, rowIndex: number): string {
  return row
    .split("")
    .map((char, charIndex) =>
      char === " " ? " " : GLYPHS[(charIndex * 7 + rowIndex * 13 + char.charCodeAt(0)) % GLYPHS.length] ?? char,
    )
    .join("");
}

export function DecoderBoard() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(() => ROWS.map((row, index) => noiseRow(row, index)));
  const started = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = rootRef.current;
    if (!node) return;
    if (reduce) {
      setRows(ROWS);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || started.current) return;
        started.current = true;
        scramble();
        observer.disconnect();
      },
      { threshold: 0.62, rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scramble = () => {
    const ticks = 48;
    let tick = 0;
    const timer = window.setInterval(() => {
      tick += 1;
      setRows(ROWS.map((row, rowIndex) => {
        if (tick > ticks + rowIndex * 5) return row;
        return row.split("").map((char, charIndex) => {
          if (char === " ") return " ";
          if (tick > 20 + charIndex * 2 + rowIndex * 4) return char;
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? char;
        }).join("");
      }));
      if (tick > ticks + ROWS.length * 6) {
        window.clearInterval(timer);
        setRows(ROWS);
      }
    }, 70);
  };

  return (
    <div ref={rootRef} className="paper-decoder" aria-label="How Unvibe works">
      {rows.map((row, index) => (
        <div className="paper-decoder__row" key={ROWS[index]}>
          {row}
        </div>
      ))}
    </div>
  );
}
