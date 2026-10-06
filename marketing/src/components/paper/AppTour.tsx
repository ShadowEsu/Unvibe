"use client";

import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";

/** A quick look at the current desktop app: onboarding, Today, the ⌘U panel, the library. */
export function AppTour() {
  return (
    <section className="vtour" id="tour" aria-label="A tour of the Unvibe app">
      <div className="vtour__head">
        <p className="vtour__eyebrow">the new app</p>
        <h2>
          Paper, ink and <em>a little blob.</em>
        </h2>
      </div>
      <div className="vtour__window">
        <div className="vtour__bar" aria-hidden="true">
          <i /><i /><i />
          <span>Unvibe</span>
        </div>
        <AutoPlayVideo
          src="/videos/unvibe-demo-v3.mp4"
          poster="/videos/unvibe-demo-v3-poster.jpg"
          label="Click-through of the Unvibe app: Today, Library, a quiz, After-Agent Review, Ask Vibe and the Command U panel explaining code"
        />
      </div>
      <p className="vtour__caption">A recorded click-through of the app: Today, the library, a quiz, After-Agent Review, Ask Vibe and the ⌘U panel. The explanation text in the panel is a written sample.</p>
    </section>
  );
}
