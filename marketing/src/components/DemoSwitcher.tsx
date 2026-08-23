"use client";

import { useState } from "react";
import { MarketingVideo } from "@/components/MarketingVideo";

const demos = {
  loop: {
    tab: "How it works",
    eyebrow: "THE LEARNING LOOP",
    title: "From selected code to retained context.",
    src: "/videos/unvibe-promo-animation.mp4",
    poster: "/videos/unvibe-animation-poster.jpg",
    label: "Animated Unvibe workflow showing code selection, five explanation depths, and learning progress",
  },
  tour: {
    tab: "Inside the app",
    eyebrow: "42 SECOND BETA TOUR",
    title: "Home, explanations, history, and Test Me.",
    src: "/videos/unvibe-app-tour.mp4",
    poster: "/videos/unvibe-app-tour-poster.jpg",
    label: "Real Unvibe beta walkthrough showing Home, saved explanations, History, and Quiz",
  },
} as const;

type DemoKey = keyof typeof demos;

export function DemoSwitcher() {
  const [active, setActive] = useState<DemoKey>("loop");
  const demo = demos[active];

  return (
    <div className="demo-switcher">
      <div className="demo-switcher__tabs" role="tablist" aria-label="Choose a product demo">
        {(Object.keys(demos) as DemoKey[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            aria-controls="unvibe-demo-panel"
            className={active === key ? "is-active" : undefined}
            onClick={() => setActive(key)}
          >
            {demos[key].tab}
          </button>
        ))}
      </div>
      <div className="demo-switcher__meta" aria-live="polite">
        <small>{demo.eyebrow}</small>
        <strong>{demo.title}</strong>
      </div>
      <div className="editorial-learning__film" id="unvibe-demo-panel" role="tabpanel">
        <MarketingVideo
          key={active}
          className="editorial-learning__video"
          src={demo.src}
          poster={demo.poster}
          label={demo.label}
        />
      </div>
    </div>
  );
}
