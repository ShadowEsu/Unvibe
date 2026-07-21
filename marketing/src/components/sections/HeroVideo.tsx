"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * Top-of-page demo slot. Uses the investor product recording by default.
 * Attempts autoplay with audio; one tap enables sound if the browser blocks it.
 */
export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [mutedFallback, setMutedFallback] = useState(false);
  const src =
    process.env.NEXT_PUBLIC_DEMO_VIDEO_URL?.trim()
    || process.env.NEXT_PUBLIC_INVESTOR_DEMO_VIDEO_URL?.trim()
    || "https://kgtnwm7mfrhop6vj.public.blob.vercel-storage.com/investors/unvibe-demo.mp4";

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let cancelled = false;
    const run = async () => {
      el.muted = false;
      el.volume = 1;
      try {
        await el.play();
        if (!cancelled) {
          setBlocked(false);
          setMutedFallback(false);
          track("demo_started", { source: "hero_video", mode: "autoplay_audio" });
        }
      } catch {
        try {
          el.muted = true;
          await el.play();
          if (!cancelled) {
            setMutedFallback(true);
            setBlocked(true);
            track("demo_started", { source: "hero_video", mode: "autoplay_muted" });
          }
        } catch {
          if (!cancelled) setBlocked(true);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const enableSound = async () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    el.volume = 1;
    try {
      await el.play();
      setBlocked(false);
      setMutedFallback(false);
      track("demo_started", { source: "hero_video", mode: "unmuted" });
    } catch {
      setBlocked(true);
    }
  };

  return (
    <section
      id="demo"
      className="container-page scroll-mt-24 pb-4 pt-6 sm:pt-10"
      aria-label="Product demo"
    >
      <div className="relative overflow-hidden rounded-card border border-line bg-[#0F1419] shadow-lift">
        <video
          ref={videoRef}
          className="relative z-[1] aspect-[16/9] w-full object-cover"
          autoPlay
          playsInline
          controls
          preload="auto"
          poster="/og.png"
        >
          <source src={src} type="video/mp4" />
        </video>
        {blocked ? (
          <button
            type="button"
            onClick={() => void enableSound()}
            className="absolute bottom-5 left-1/2 z-[2] inline-flex -translate-x-1/2 items-center gap-2 rounded-pill border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary shadow-lift"
          >
            {mutedFallback ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
            {mutedFallback ? "Tap for sound" : "Tap to play with sound"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
