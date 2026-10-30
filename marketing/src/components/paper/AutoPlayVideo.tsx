"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
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
  /** Intrinsic size, so the box is reserved before the file loads. */
  width?: number;
  height?: number;
  /** English WebVTT captions, off until chosen in the player (they repeat the burned-in text). */
  captions?: string;
  /** Told whether the video will autoplay: false for lite visitors and when the browser refuses even muted play. */
  onAutoplayChange?: (autoplays: boolean) => void;
}

/**
 * Autoplay stays muted, as browsers require. Sound turns on only with the "Sound on" toggle (or the
 * video's own controls); the toggle reads the element's muted state, so it keeps working when `src`
 * changes. With reduced motion (or a lite device) the video doesn't autoplay and has no toggle.
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
  width,
  height,
  captions,
  onAutoplayChange,
}: AutoPlayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [autoplays, setAutoplays] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const syncSound = () => setSoundOn(!video.muted);
    video.addEventListener("volumechange", syncSound);
    return () => video.removeEventListener("volumechange", syncSound);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (prefersLiteExperience() || !active) {
      setAutoplays(false);
      onAutoplayChange?.(false);
      video.pause();
      video.muted = true;
      return;
    }
    setAutoplays(true);
    onAutoplayChange?.(true);

    // Even muted autoplay can be refused (iOS Low Power Mode): then the visitor starts it, so the
    // "Sound on" toggle goes and the caller stops covering the player.
    const refused = (error: unknown) => {
      if ((error as DOMException | undefined)?.name !== "NotAllowedError") return;
      setAutoplays(false);
      onAutoplayChange?.(false);
    };

    let visible = false;
    let playToken = 0;

    const playSafe = async () => {
      if (!visible || !active) return;
      const token = ++playToken;
      if (!video.paused && !video.ended) return;
      try {
        await video.play();
      } catch (error) {
        if (token !== playToken) return;
        if (video.muted) {
          refused(error);
          return;
        }
        // Playing with sound was refused: fall back to muted, which most browsers allow.
        video.muted = true;
        await video.play().catch((mutedError: unknown) => {
          if (token === playToken) refused(mutedError);
        });
      }
    };

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
      observer.disconnect();
      video.removeEventListener("waiting", onWaiting);
      video.pause();
    };
  }, [active, src, onAutoplayChange]);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.muted) {
      video.muted = true;
      return;
    }
    video.muted = false;
    video.volume = 1;
    void video.play().catch(() => {
      video.muted = true;
    });
  };

  return (
    <>
      <video
        ref={videoRef}
        className={className}
        src={src}
        poster={poster}
        width={width}
        height={height}
        loop={loop}
        playsInline
        muted
        controls={controls}
        preload={preload}
        aria-label={label}
      >
        {captions ? <track kind="captions" srcLang="en" label="English" src={captions} /> : null}
      </video>
      {autoplays ? (
        // A toggle keeps one name; aria-pressed (and the filled style) says whether sound is on.
        <button type="button" className="vtour__sound" aria-pressed={soundOn} onClick={toggleSound}>
          {soundOn ? <Volume2 aria-hidden="true" size={18} /> : <VolumeX aria-hidden="true" size={18} />}
          Sound on
        </button>
      ) : null}
    </>
  );
}
