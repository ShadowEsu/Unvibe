"use client";

import { useEffect } from "react";

const SPOTLIGHT_SELECTOR = ".paper-glass, .resources-card, .marketing-plan-card, .paper-quotes blockquote, .ld__card";

/**
 * Site-wide ambience: drifting light behind the page, a cursor spotlight on
 * glass surfaces, and a scroll progress value for the nav. All effects are
 * decorative and switch off for reduced motion.
 */
export function AmbientEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const max = Math.max(1, root.scrollHeight - window.innerHeight);
        root.style.setProperty("--scroll-progress", String(Math.min(1, window.scrollY / max)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onPointer = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.(SPOTLIGHT_SELECTOR) as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      target.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    if (finePointer && !reduce) window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="ambient" aria-hidden="true">
      <span className="ambient__orb ambient__orb--violet" />
      <span className="ambient__orb ambient__orb--coral" />
      <span className="ambient__orb ambient__orb--sky" />
      <span className="ambient__grain" />
    </div>
  );
}
