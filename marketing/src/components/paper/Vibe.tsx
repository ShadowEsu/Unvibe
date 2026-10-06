"use client";

import { useEffect, useRef } from "react";

/**
 * Vibe, the Unvibe mascot: a flat sticker blob with an ink outline and two black eyes.
 * Same shape as the desktop app. The eyes follow the pointer and it blinks now and then.
 */
export function Vibe({ size = 96, className = "", follow = true }: { size?: number; className?: string; follow?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!follow) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const node = ref.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const dist = Math.max(1, Math.hypot(dx, dy));
        const reach = Math.min(1, dist / 320);
        node.style.setProperty("--look-x", `${((dx / dist) * 2.2 * reach).toFixed(2)}px`);
        node.style.setProperty("--look-y", `${((dy / dist) * 1.8 * reach).toFixed(2)}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [follow]);

  return (
    <span ref={ref} className={`vibe ${className}`.trim()} style={{ width: size, height: size }} role="img" aria-label="Vibe, the Unvibe mascot">
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <ellipse className="vibe__shadow" cx="24" cy="45.5" rx="12" ry="1.8" />
        <g className="vibe__float">
          <path className="vibe__body" d="M24 8C33 8 38.5 14 40 22.5C41.5 31 43 38 37.5 41C32 43.6 16 43.6 10.5 41C5 38 6.5 31 8 22.5C9.5 14 15 8 24 8Z" />
          <g className="vibe__eyes">
            <ellipse cx="18.6" cy="24.2" rx="3.3" ry="4.6" className="vibe__iris" />
            <circle className="vibe__pupil" cx="17.6" cy="22.6" r="1.15" />
            <ellipse cx="29.4" cy="24.2" rx="3.3" ry="4.6" className="vibe__iris" />
            <circle className="vibe__pupil" cx="28.4" cy="22.6" r="1.15" />
          </g>
        </g>
      </svg>
    </span>
  );
}
