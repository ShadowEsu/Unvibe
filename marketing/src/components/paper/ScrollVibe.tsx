"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Vibe } from "@/components/paper/Vibe";
import { BETA_MAC_DIRECT_DOWNLOAD, BETA_WINDOWS_DIRECT_DOWNLOAD } from "@/lib/betaOffer";
import { track } from "@/lib/analytics";
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

const HIDDEN = ["/founder", "/stats", "/waitlist", "/waitlist-admin", "/activate"];

/**
 * Site-wide scroll companion: a lime progress bar, Vibe riding down the right edge and
 * chatting, and a free download bar that slides in once you are most of the way down.
 */
export function ScrollVibe() {
  const pathname = usePathname() ?? "/";
  const [progress, setProgress] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [bubbleHidden, setBubbleHidden] = useState(false);
  const last = useRef({ y: 0, t: 0 });

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const y = window.scrollY;
        const now = performance.now();
        const velocity = (y - last.current.y) / Math.max(16, now - last.current.t);
        last.current = { y, t: now };
        setProgress(Math.min(1, Math.max(0, y / max)));
        setTilt(Math.max(-14, Math.min(14, velocity * 10)));
      });
    };
    const settle = window.setInterval(() => setTilt((t) => (Math.abs(t) < 0.5 ? 0 : t * 0.6)), 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearInterval(settle);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => setBubbleHidden(false), [pathname]);

  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;

  const line = [...LINES].reverse().find(([at]) => progress >= at)?.[1] ?? "";
  const showBar = progress > 0.5 && progress < 0.97;
  const onBeta = pathname.startsWith("/beta");

  return (
    <>
      <div className="svibe-progress" aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
      <button
        type="button"
        className={progress < 0.04 ? "svibe is-resting" : "svibe"}
        style={{ top: `calc(110px + ${progress} * (100vh - 290px))` }}
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
        <span className="svibe__body" style={{ transform: `rotate(${tilt}deg)` }}>
          <Vibe size={64} />
        </span>
      </button>
      {!onBeta ? (
        <div className={showBar ? "sfree is-in" : "sfree"} aria-hidden={!showBar}>
          <p><b>Unvibe is free.</b> <span>Mac and Windows · no card · no API key</span></p>
          <div className="sfree__links">
            <a href={BETA_MAC_DIRECT_DOWNLOAD} onClick={() => { delight(); track("download_cta_clicked", { platform: "mac", surface: "sticky_free" }); }}>Free for Mac</a>
            <a href={BETA_WINDOWS_DIRECT_DOWNLOAD} onClick={() => { delight(); track("download_cta_clicked", { platform: "windows", surface: "sticky_free" }); }}>Free for Windows</a>
          </div>
        </div>
      ) : null}
    </>
  );
}
