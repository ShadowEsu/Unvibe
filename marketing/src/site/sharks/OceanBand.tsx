"use client";

import { useEffect, useRef } from "react";
import type { SharkSpec } from "@/vendor/ascii-sharks/world";

const DESKTOP: SharkSpec[] = [
  { kind: "classic", size: 1 },
  { kind: "mako", size: 0.85 },
  { kind: "classic", size: 0.7 },
];
const PHONE: SharkSpec[] = [
  { kind: "classic", size: 1 },
  { kind: "mako", size: 0.85 },
];

/**
 * The ocean behind the numbers panel (ledger 598 N1): an absolutely positioned canvas that fills its section, so it
 * costs no layout. The engine (vendor/ascii-sharks + our violet renderer, about 60 KB) is imported only once the
 * section is within one screen of the viewport, so the first paint and the LCP never wait for it. Decorative:
 * aria-hidden, pointer-events none (the pointer is read from window, so fish still scatter from it).
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
        const phone = window.innerWidth < 600;
        import("./ocean").then(({ Ocean }) => {
          if (cancelled) return;
          ocean = new Ocean(canvas, { sharks: phone ? PHONE : DESKTOP, fish: phone ? 40 : 90, still, cellsAcross: phone ? 48 : 124 });
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
