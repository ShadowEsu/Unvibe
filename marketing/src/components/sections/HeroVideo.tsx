"use client";

import { useRef, useState } from "react";
import { Play } from "lucide-react";
import { track } from "@/lib/analytics";
import { UnvibeBar } from "../UnvibeBar";

/**
 * Top-of-page demo slot. Drop a file at public/demo.mp4 (or set NEXT_PUBLIC_DEMO_VIDEO_URL)
 * and this plays it. Until then it shows a polished poster frame ready for recording.
 */
export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const src =
    process.env.NEXT_PUBLIC_DEMO_VIDEO_URL?.trim() || "/demo.mp4";

  const start = async () => {
    track("demo_started", { source: "hero_video" });
    const el = videoRef.current;
    if (!el) return;
    try {
      await el.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <section
      id="demo"
      className="container-page scroll-mt-24 pb-4 pt-6 sm:pt-10"
      aria-label="Product demo"
    >
      <div className="relative overflow-hidden rounded-card border border-line bg-[#0F1419] shadow-lift">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.35),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(37,99,235,0.28),_transparent_45%)]" />

        <video
          ref={videoRef}
          className="relative z-[1] aspect-[16/9] w-full object-cover"
          controls={playing}
          playsInline
          preload="metadata"
          poster="/og.png"
          onEnded={() => setPlaying(false)}
        >
          <source src={src} type="video/mp4" />
        </video>

        {!playing && (
          <button
            type="button"
            onClick={start}
            className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-5 bg-[#0F1419]/30 text-white transition-colors hover:bg-[#0F1419]/20"
          >
            <UnvibeBar tone="dark" busy hint="to explain" />
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#0F1419] shadow-lift">
              <Play size={22} fill="currentColor" aria-hidden="true" />
            </span>
            <span className="text-center">
              <span className="block text-base font-semibold tracking-tight sm:text-lg">
                Watch Unvibe in 30 seconds
              </span>
              <span className="mt-1 block text-sm text-white/75">
                Select code → choose depth → understand what shipped
              </span>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}
