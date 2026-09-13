"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { armAudioUnlock, isAudioUnlocked, whenAudioUnlocked } from "@/lib/autoplayAudio";
import { prefersLiteExperience } from "@/lib/performanceMode";

interface AutoPlayVideoProps {
  src: string;
  poster?: string;
  label: string;
  className?: string;
  active?: boolean;
  loop?: boolean;
  controls?: boolean;
  preload?: "none" | "metadata" | "auto";
}

/**
 * Autoplay stays muted so browsers do not stall mid-clip when unmuted play is
 * rejected. Sound only turns on after a prior user gesture unlocked audio.
 */
export function AutoPlayVideo({
  src,
  poster,
  label,
  className,
  active = true,
  loop = true,
  controls = true,
  preload = "metadata",
}: AutoPlayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    armAudioUnlock();

    if (prefersLiteExperience() || !active) {
      video.pause();
      video.muted = true;
      return;
    }

    let visible = false;
    let playToken = 0;

    const applyMutedPolicy = () => {
      video.muted = !isAudioUnlocked();
      if (!video.muted) video.volume = 1;
    };

    const playSafe = async () => {
      if (!visible || !active) return;
      const token = ++playToken;
      applyMutedPolicy();
      if (!video.paused && !video.ended) return;
      try {
        await video.play();
      } catch {
        if (token !== playToken) return;
        video.muted = true;
        await video.play().catch(() => undefined);
      }
    };

    const release = whenAudioUnlocked(() => {
      if (!visible || !active) return;
      applyMutedPolicy();
      void playSafe();
    });

    const onWaiting = () => {
      // Keep the element alive through short buffer stalls instead of restarting.
      if (visible && video.paused) void playSafe();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) void playSafe();
        else video.pause();
      },
      { threshold: 0.35 },
    );

    video.addEventListener("waiting", onWaiting);
    observer.observe(video);
    return () => {
      playToken += 1;
      release();
      observer.disconnect();
      video.removeEventListener("waiting", onWaiting);
      video.pause();
    };
  }, [active, src]);

  return (
    <video
      ref={videoRef}
      className={cn(className)}
      src={src}
      poster={poster}
      loop={loop}
      playsInline
      muted
      controls={controls}
      preload={preload}
      aria-label={label}
    />
  );
}
