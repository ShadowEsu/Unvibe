"use client";

import demo from "@/data/demoMedia.json";
import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";
import { DotGrid } from "@/components/paper/DotGrid";

/** The real app, recorded in one session, directly under the hero promise. */
export function AppTour() {
  return (
    <section className="vtour" id="tour" aria-labelledby="tour-title">
      <DotGrid />
      <div className="vtour__head">
        <h2 id="tour-title">
          Watch Unvibe <em>in action.</em>
        </h2>
      </div>
      <div className="vtour__window">
        <div className="vtour__bar" aria-hidden="true">
          <i /><i /><i />
          <span>Unvibe {demo.version}</span>
        </div>
        <AutoPlayVideo
          src="/videos/unvibe-real-demo.mp4"
          poster="/videos/unvibe-real-demo-poster.webp"
          label="Screen recording of Unvibe: first launch, a code explanation streaming in, switching to Beginner depth, a follow-up question, a Test me question, then the Today, Library, Quiz, Briefs and Momentum pages"
        />
      </div>
      <p className="vtour__caption">
        Screen recording of Unvibe {demo.version} on a {demo.platform}. Every explanation was generated live; only the waits between steps are cut.
      </p>
    </section>
  );
}
