"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { track } from "@/lib/analytics";

const DEMO_SRC =
  process.env.NEXT_PUBLIC_DEMO_VIDEO_URL?.trim()
  || process.env.NEXT_PUBLIC_INVESTOR_DEMO_VIDEO_URL?.trim()
  || "https://kgtnwm7mfrhop6vj.public.blob.vercel-storage.com/investors/unvibe-demo.mp4";

/**
 * Homepage product demo — real Mac recording.
 * Attempts autoplay with audio; if the browser blocks sound, one tap enables it.
 */
export function HeroDemo() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [mutedFallback, setMutedFallback] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    let cancelled = false;
    const tryPlayWithSound = async () => {
      el.muted = false;
      el.volume = 1;
      try {
        await el.play();
        if (!cancelled) {
          setBlocked(false);
          setMutedFallback(false);
          track("demo_started", { source: "home_hero", mode: "autoplay_audio" });
        }
      } catch {
        // Browsers often block unmuted autoplay — start muted so motion still plays,
        // then ask once for sound.
        try {
          el.muted = true;
          await el.play();
          if (!cancelled) {
            setMutedFallback(true);
            setBlocked(true);
            track("demo_started", { source: "home_hero", mode: "autoplay_muted" });
          }
        } catch {
          if (!cancelled) setBlocked(true);
        }
      }
    };

    void tryPlayWithSound();
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
      track("demo_started", { source: "home_hero", mode: "unmuted" });
    } catch {
      setBlocked(true);
    }
  };

  return (
    <div className="home-demo" aria-label="Unvibe product demo video">
      <div className="home-demo__frame">
        <div className="home-demo__chrome" aria-hidden="true">
          <span>UNVIBE DEMO</span>
          <span>MACOS · PRODUCT RECORDING</span>
        </div>
        <video
          ref={videoRef}
          className="home-demo__video"
          autoPlay
          playsInline
          controls
          preload="auto"
          poster="/og.png"
          // Intentionally not muted — we want audio when the browser allows it.
        >
          <source src={DEMO_SRC} type="video/mp4" />
        </video>

        {blocked ? (
          <button type="button" className="home-demo__sound" onClick={() => void enableSound()}>
            {mutedFallback ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
            <span>{mutedFallback ? "Tap for sound" : "Tap to play with sound"}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
