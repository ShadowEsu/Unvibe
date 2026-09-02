"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";

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
    meta: "In the editor",
    title: "The overlay sits on the code you selected.",
    body: "Depth from New to Expert. Follow-ups when you want them. Secrets are scanned on this Mac before anything is sent.",
    src: "/product/overlay-editor.png",
    alt: "Unvibe overlay explaining selected code beside an editor",
    kind: "image",
  },
  {
    meta: "The bar",
    title: "A small bar when you need it.",
    body: "It sits over the editor, dim when idle. Select code, then press Command U.",
    src: "/product/island-bar.png",
    alt: "Unvibe island bar floating over an editor",
    kind: "image",
  },
  {
    meta: "On this Mac",
    title: "What you learn stays here.",
    body: "History, concepts, and a short check so the explanation does not vanish after you close the tab.",
    src: "/product/overview.png",
    alt: "Unvibe companion dashboard on a Mac",
    kind: "image",
  },
  {
    meta: "Saved",
    title: "The record grows as you ship.",
    body: "Each explanation can be kept, revisited, and used the next time the same idea shows up in your project.",
    src: "/product/dashboard.png",
    alt: "Unvibe learning dashboard with saved explanations",
    kind: "image",
  },
  {
    meta: "Test your knowledge",
    title: "A short check so it sticks.",
    body: "After an explanation you can test yourself, then keep the note in your history.",
    src: "/product-shots/quiz-lessons-dark.png",
    alt: "Unvibe quiz checking what you just learned",
    kind: "image",
  },
  {
    meta: "Install",
    title: "Install once. Stay local.",
    body: "The Mac app owns the network path. Secrets are scanned on this machine before anything is sent.",
    src: "/product/installer.png",
    alt: "Unvibe Mac installer window",
    kind: "image",
  },
  {
    meta: "The pass",
    title: "See the overlay move.",
    body: "A quiet pass through the product. No extra window to manage.",
    src: "/videos/unvibe-app-tour.mp4",
    poster: "/videos/unvibe-app-tour-poster.jpg",
    alt: "Unvibe product tour playing in place",
    kind: "video",
  },
  {
    meta: "In Cursor",
    title: "It sits beside Cursor too.",
    body: "Same shortcut. Same overlay. The editor you already have.",
    src: "/videos/unvibe-cursor-integration-2026.mp4",
    poster: "/videos/unvibe-cursor-integration-2026-poster.jpg",
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
      />
    );
  }

  return <img src={beat.src} alt={active ? beat.alt : ""} />;
}

export function StoryStage() {
  const rootRef = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = rootRef.current;
    if (!node || reduce) return;

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
        if (fillRef.current) {
          fillRef.current.style.transform = `scaleX(${amount})`;
        }
        setActive((prev) => (prev === next ? prev : next));
      },
    });

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    requestAnimationFrame(refresh);
    return () => {
      window.removeEventListener("load", refresh);
      trigger.kill();
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
          {beats.map((beat, index) => (
            <div
              key={beat.src}
              className={index === active ? "paper-story__shot is-active" : "paper-story__shot"}
            >
              <StoryMedia beat={beat} active={index === active} />
            </div>
          ))}
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
