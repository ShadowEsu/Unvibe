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
          src="/videos/unvibe-app-tour-v3.mp4"
          poster="/videos/unvibe-app-tour-v3-poster.jpg"
          label="Tour of the Unvibe desktop app: onboarding, Today, the Command U panel thinking and answering, a quiz, light mode, the library and Ask Vibe"
          controls={false}
        />
      </div>
      <p className="vtour__caption">Real screens from the app: onboarding, Today, the ⌘U panel thinking and answering, a quiz, light mode and the library.</p>
    </section>
  );
}
