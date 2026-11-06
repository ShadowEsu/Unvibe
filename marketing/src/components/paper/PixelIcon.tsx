"use client";

import { useEffect, useRef } from "react";
import { observeMotion } from "@/lib/motionInView";
import { prefersReducedMotion, stageArrival } from "@/lib/motionMoments";

/** The pixel icons the home page uses, from Motion's 32×32 set (kit/pixel, films-1105 DESIGN §5; site twins, no lime). */
export type PixelIconName = "09-notebook" | "13-floppy" | "17-magnifier" | "18-lightbulb";

/**
 * Margin art (Design's 530 spec §13.7): one icon at ×4, decorative, beside a section and never over product UI.
 * The server HTML shows it at rest. Only when motion is allowed and it starts below the fold does it wait, then
 * rise 16 px and fade in over 600 ms the first time it scrolls into view, step 1 grid pixel up every 200 ms for
 * 2 s, and stop (n.css `.npx`). Shown only where the page has room for it (n.css, ≥ 1280 px).
 */
export function PixelIcon({ name, className }: { name: PixelIconName; className: string }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const icon = ref.current;
    if (!icon || icon.dataset.px) return;
    const staged = stageArrival({
      reducedMotion: prefersReducedMotion(),
      hasObserver: typeof IntersectionObserver !== "undefined",
      top: icon.getBoundingClientRect().top,
      viewportHeight: window.innerHeight,
    });
    // Hidden at this width (display: none has no box): nothing to stage.
    if (!staged || icon.getClientRects().length === 0) return;
    icon.dataset.px = "wait";
    const stop = observeMotion(icon, () => {
      stop();
      icon.dataset.px = "go";
    });
    return () => {
      stop();
      if (icon.dataset.px === "wait") delete icon.dataset.px;
    };
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- a 32×32 pixel SVG at an integer scale; nothing to optimise
    <img ref={ref} className={`npx ${className}`} src={`/unvibe/pixel/${name}.svg`} width={128} height={128} alt="" aria-hidden="true" loading="lazy" decoding="async" />
  );
}
