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
        <div className="vtour__media">
          {/* The poster at the size it renders (a <video poster> can't pick one). It sits behind the video, which stays
              transparent until playback paints a frame; the video itself loads only once it is on screen. */}
          <img
            className="vtour__poster"
            src="/videos/unvibe-real-demo-poster.webp"
            srcSet="/videos/unvibe-real-demo-poster-720.webp 720w, /videos/unvibe-real-demo-poster.webp 1280w"
            sizes="(max-width: 1120px) calc(100vw - 2.5rem), 1080px"
            width={1280}
            height={800}
            alt=""
          />
          <AutoPlayVideo
            src="/videos/unvibe-real-demo.mp4"
            preload="none"
            label="Screen recording of Unvibe: a code explanation streaming in, switching to Beginner depth, a follow-up question, then a Test me question"
          />
        </div>
      </div>
      <p className="vtour__caption">
        Screen recording of Unvibe {demo.version} on a {demo.platform}. Every explanation was generated live; only the waits between steps are cut.
      </p>
    </section>
  );
}
