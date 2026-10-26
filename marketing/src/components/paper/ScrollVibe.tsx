"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Vibe } from "@/components/paper/Vibe";
import { delight } from "@/lib/delight";

/** What Vibe says as you scroll further down the page. */
const LINES: Array<[number, string]> = [
  [0.0, ""],
  [0.06, "keep going, it gets good"],
  [0.25, "this is me, in the app"],
  [0.45, "oh, and it's free"],
  [0.65, "no card. no API key."],
  [0.85, "go on, download me"],
];

const HIDDEN = ["/founder", "/stats", "/s/", "/kit", "/waitlist", "/waitlist-admin", "/activate"];

/**
 * Site-wide scroll companion: a lime progress bar and Vibe riding down the right edge,
 * chatting on hover/focus and jumping to the free download when clicked.
 * Scrolling writes the bar's scale and Vibe's offset straight to the DOM (transforms only, no
 * re-render per frame); React state changes only when Vibe's line or the rest state changes.
 */
export function ScrollVibe() {
  const pathname = usePathname() ?? "/";
  const [line, setLine] = useState("");
  const [resting, setResting] = useState(true);
  const [bubbleHidden, setBubbleHidden] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLSpanElement>(null);
  const last = useRef({ y: 0, t: 0, tilt: 0 });

  useEffect(() => {
    let frame = 0;
    let settle = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const setTilt = (tilt: number) => {
      last.current.tilt = tilt;
      if (bodyRef.current) bodyRef.current.style.transform = tilt ? `rotate(${tilt.toFixed(2)}deg)` : "";
    };
    // Ease the tilt back to upright after scrolling stops; the timer chain ends once upright.
    const relax = () => {
      const next = Math.abs(last.current.tilt) < 0.5 ? 0 : last.current.tilt * 0.6;
      setTilt(next);
      settle = next ? window.setTimeout(relax, 120) : 0;
    };
    const paint = () => {
      frame = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const y = window.scrollY;
      const now = performance.now();
      const progress = Math.min(1, Math.max(0, y / max));
      const velocity = (y - last.current.y) / Math.max(16, now - last.current.t);
      last.current.y = y;
      last.current.t = now;
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress.toFixed(4)})`;
      buttonRef.current?.style.setProperty("--svibe-y", `calc(110px + ${progress.toFixed(4)} * (100vh - 290px))`);
      setResting(progress < 0.04);
      setLine([...LINES].reverse().find(([at]) => progress >= at)?.[1] ?? "");
      if (!reduce) {
        setTilt(Math.max(-14, Math.min(14, velocity * 10)));
        window.clearTimeout(settle);
        settle = window.setTimeout(relax, 120);
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearTimeout(settle);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => setBubbleHidden(false), [pathname]);

  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      <div className="svibe-progress" aria-hidden="true"><i ref={barRef} /></div>
      <button
        ref={buttonRef}
        type="button"
        className={resting ? "svibe is-resting" : "svibe"}
        aria-label="Vibe. Jump to the free download"
        onClick={() => {
          delight();
          setBubbleHidden(true);
          const target = document.getElementById("install");
          if (target) target.scrollIntoView({ block: "center" });
          else window.location.href = "/beta";
        }}
      >
        {line && !bubbleHidden ? <span className="svibe__bubble" key={line}>{line}</span> : null}
        <span className="svibe__body" ref={bodyRef}>
          <Vibe size={44} />
        </span>
      </button>
    </>
  );
}
