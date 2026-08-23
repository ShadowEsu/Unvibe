"use client";

import { useEffect, useRef } from "react";
import { armAudioUnlock, isAudioUnlocked, whenAudioUnlocked } from "@/lib/autoplayAudio";

export function MarketingVideo({
  src,
  poster,
  label,
  className,
  autoPlay = true,
  captions,
}: {
  src: string;
  poster: string;
  label: string;
  className?: string;
  autoPlay?: boolean;
  captions?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoPlay) return;
    armAudioUnlock();

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) return;

    const playWithSound = async () => {
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
      video.muted = false;
      video.volume = 1;
      void video.play().catch(() => undefined);
    });

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (isAudioUnlocked()) video.muted = false;
          void playWithSound();
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(video);
    return () => {
      release();
      observer.disconnect();
    };
  }, [autoPlay]);

  return (
    <video
      ref={videoRef}
      className={className}
      aria-label={label}
      autoPlay={autoPlay}
      controls
      loop
      playsInline
      preload="auto"
      poster={poster}
    >
      <source src={src} type="video/mp4" />
      {captions ? <track kind="captions" src={captions} srcLang="en" label="English" default /> : null}
      Your browser does not support embedded video.
    </video>
  );
}
