"use client";

import { useEffect, useRef } from "react";
import type { SharkSpec } from "@/vendor/ascii-sharks/world";

/** Two sharks, 1 and 0.85 (Design S-1 r2); the engine sizes them to the box. */
const SHARKS: SharkSpec[] = [
  { kind: "classic", size: 1 },
  { kind: "mako", size: 0.85 },
];

/**
 * The ocean beside the money card (ledger 598 N1): a canvas that is a box of its own in the section's grid (right of
 * the card at 1024 and wider, a 220 px band above it below that), so nothing swims under text. The engine
 * (vendor/ascii-sharks + our violet renderer, about 60 KB) is imported only once the section is within one screen of
 * the viewport, so the first paint and the LCP never wait for it. Decorative: aria-hidden, pointer-events none (the
 * pointer is read from window, so fish still scatter from it).
 */
export function OceanBand({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let ocean: { destroy(): void } | undefined;
    let cancelled = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // The smallest cell the renderer allows (8 px): a shark is at most 0.44 of the box's short side (the engine's
        // rule), so in a box this size it needs every cell it can get to read as a shark.
        const cellsAcross = Math.round(canvas.getBoundingClientRect().width / 8);
        const fish = window.innerWidth < 600 ? 40 : 60;
        import("./ocean").then(({ Ocean }) => {
          if (cancelled) return;
          ocean = new Ocean(canvas, { sharks: SHARKS, fish, still, cellsAcross });
        });
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(canvas);
    return () => {
      cancelled = true;
      io.disconnect();
      ocean?.destroy();
    };
  }, []);

  return <canvas ref={ref} className={`d-ocean d-mono ${className}`.trim()} aria-hidden="true" />;
}
