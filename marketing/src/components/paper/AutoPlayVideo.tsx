"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { armAudioUnlock, isAudioUnlocked, whenAudioUnlocked } from "@/lib/autoplayAudio";

interface AutoPlayVideoProps {
  src: string;
  poster?: string;
  label: string;
  className?: string;
  active?: boolean;
  loop?: boolean;
  controls?: boolean;
}

export function AutoPlayVideo({
  src,
  poster,
  label,
  className,
  active = true,
  loop = true,
  controls = true,
}: AutoPlayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    armAudioUnlock();

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !active) {
      video.pause();
      video.muted = true;
      return;
    }

    let visible = true;
    const playWithSound = async () => {
      if (!visible || !active) return;
      video.volume = 1;
      video.muted = false;
      try {
        await video.play();
      } catch {
        video.muted = true;
        await video.play().catch(() => undefined);
      }
    };

    const release = whenAudioUnlocked(() => {
      if (!visible || !active) return;
      video.muted = false;
      video.volume = 1;
      void video.play().catch(() => undefined);
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) {
          setReady(true);
          void playWithSound();
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 },
    );

    if (isAudioUnlocked()) {
      video.muted = false;
    }
    observer.observe(video);

    return () => {
      release();
      observer.disconnect();
      video.pause();
    };
  }, [active, src]);

  return (
    <video
      ref={videoRef}
      className={cn(className)}
      src={src}
      poster={poster}
      autoPlay
      loop={loop}
      playsInline
      controls={controls}
      preload={ready ? "auto" : "none"}
      aria-label={label}
    />
  );
}
