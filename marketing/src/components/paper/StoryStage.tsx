"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";
import { track } from "@/lib/analytics";
import { prefersLiteExperience } from "@/lib/performanceMode";

type StoryBeat = {
  meta: string;
  title: string;
  body: string;
  src: string;
  alt: string;
  kind: "image" | "video";
  poster?: string;
};

const beats: StoryBeat[] = [
  {
    meta: "How to start",
    title: "Select code. Press Command U.",
    body: "Unvibe sits beside Cursor and VS Code. Highlight what you want to keep, press the shortcut, and read the explanation in place.",
    src: "/product/onboarding-welcome.jpg",
    alt: "Unvibe welcome screen: select code and press Command U",
    kind: "image",
  },
  {
    meta: "The Island",
    title: "A quiet bar when you need it.",
    body: "Pin it top, right, bottom, or corner. Dim when idle. Expand on hover or keep it click-only.",
    src: "/product/island-settings.jpg",
    alt: "Unvibe Island settings with overlay preview",
    kind: "image",
  },
  {
    meta: "On this Mac",
    title: "Your learning record starts on this Mac.",
    body: "Home keeps local reviews, lines understood, and your next lesson together. Signed-in learning records can sync to your account.",
    src: "/product/home-today.jpg",
    alt: "Unvibe companion Home with Today and recent reviews",
    kind: "image",
  },
  {
    meta: "Saved",
    title: "Every explanation has a place.",
    body: "History keeps Understood and Review states so you can open a note again without hunting the chat log.",
    src: "/product/history.jpg",
    alt: "Unvibe History of saved explanations on this Mac",
    kind: "image",
  },
  {
    meta: "Progress",
    title: "An honest count of what stuck.",
    body: "Lines understood, concepts developing, streak heat map. Unvibe tracks the app you were in, never the keystrokes.",
    src: "/product/progress.jpg",
    alt: "Unvibe Progress dashboard with streak and lines understood",
    kind: "image",
  },
  {
    meta: "Test me",
    title: "A short check so it sticks.",
    body: "Pick a lesson. One question fills the screen. Press a letter to answer, then keep building.",
    src: "/product/quiz.jpg",
    alt: "Unvibe Quiz list for checking what you learned",
    kind: "image",
  },
  {
    meta: "Privacy",
    title: "Secrets are scanned before sending.",
    body: "When you request an explanation, selected code and limited context go to the configured cloud AI provider after an on-device secret scan. Unvibe does not crawl or upload your whole repository.",
    src: "/product/privacy-data.jpg",
    alt: "Unvibe Privacy and Data settings with on-device secret scan",
    kind: "image",
  },
  {
    meta: "Mac access",
    title: "Accessibility when you need it.",
    body: "⌘U in Cursor and VS Code uses the Desktop Bridge. Control+U elsewhere needs Accessibility turned on once.",
    src: "/product/onboarding-access.jpg",
    alt: "Unvibe Mac access onboarding for Accessibility permission",
    kind: "image",
  },
  {
    meta: "The pass",
    title: "See the companion move.",
    body: "A quiet pass through Home and the Island. No extra window to manage.",
    src: "/videos/unvibe-app-tour.mp4",
    poster: "/videos/unvibe-app-tour-poster.jpg",
    alt: "Unvibe product tour playing in place",
    kind: "video",
  },
  {
    meta: "In Cursor",
    title: "It sits beside Cursor too.",
    body: "Same shortcut. Same overlay. The editor you already have.",
    src: "/videos/unvibe-cursor-demo.mp4?v=20260902b",
    poster: "/videos/unvibe-cursor-demo-poster.jpg",
    alt: "Unvibe overlay working beside Cursor",
    kind: "video",
  },
];

function StoryMedia({ beat, active }: { beat: StoryBeat; active: boolean }) {
  if (beat.kind === "video") {
    return (
      <AutoPlayVideo
        src={beat.src}
        poster={beat.poster}
        label={beat.alt}
        active={active}
        preload="none"
      />
    );
  }

  return (
    <Image
      src={beat.src}
      alt={active ? beat.alt : ""}
      fill
      sizes="(max-width: 900px) calc(100vw - 2rem), 46vw"
      style={{ objectFit: "contain" }}
    />
  );
}

export function StoryStage() {
  const rootRef = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);
  const lastTracked = useRef(-1);

  useEffect(() => {
    if (lastTracked.current === active) return;
    lastTracked.current = active;
    const beat = beats[active];
    if (!beat) return;
    track("story_beat_viewed", {
      index: active,
      meta: beat.meta,
      kind: beat.kind,
    });
  }, [active]);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || prefersLiteExperience()) return;

    let cancelled = false;
    let cleanupAnimation: (() => void) | undefined;
    const loadAnimation = async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const trigger = ScrollTrigger.create({
        trigger: node,
        start: "top top",
        end: () => `+=${beats.length * 280}vh`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: 1.75,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const raw = self.progress * beats.length;
          const next = Math.min(beats.length - 1, Math.floor(raw));
          const amount = next === beats.length - 1 && self.progress === 1 ? 1 : raw - next;
          if (fillRef.current) fillRef.current.style.transform = `scaleX(${amount})`;
          setActive((previous) => (previous === next ? previous : next));
        },
      });
      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener("load", refresh);
      requestAnimationFrame(refresh);
      cleanupAnimation = () => {
        window.removeEventListener("load", refresh);
        trigger.kill();
      };
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        void loadAnimation();
      },
      { rootMargin: "600px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
      cleanupAnimation?.();
    };
  }, []);

  return (
    <section ref={rootRef} className="paper-story" aria-label="How Unvibe looks">
      <div className="paper-story__grid">
        <div className="paper-story__copy">
          {beats.map((beat, index) => (
            <div
              key={beat.title}
              className={index === active ? "paper-story__beat is-active" : "paper-story__beat"}
              aria-hidden={index !== active}
            >
              <p className="paper-meta">{beat.meta}</p>
              <h2>{beat.title}</h2>
              <p className="paper-lead">{beat.body}</p>
            </div>
          ))}
        </div>
        <div className="paper-story__media">
          <div className="paper-story__shot is-active" key={beats[active]?.src}>
            {beats[active] ? <StoryMedia beat={beats[active]} active /> : null}
          </div>
        </div>
      </div>
      <div className="paper-story__meter">
        <span className="paper-story__count">{String(active + 1).padStart(2, "0")} / {String(beats.length).padStart(2, "0")}</span>
        <div className="paper-story__track" aria-hidden="true">
          <span ref={fillRef} className="paper-story__fill" />
        </div>
        <div className="paper-story__ticks" aria-hidden="true">
          {beats.map((beat, index) => (
            <span key={beat.src} className={index === active ? "is-active" : undefined}>
              {String(index + 1).padStart(2, "0")}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
