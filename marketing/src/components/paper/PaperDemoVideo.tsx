"use client";

import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";

/** Homepage main product demo: a recorded click-through of the current desktop app. */
export function PaperDemoVideo() {
  return (
    <div className="paper-video">
      <AutoPlayVideo
        src="/videos/unvibe-demo-v3.mp4"
        poster="/videos/unvibe-demo-v3-poster.jpg"
        label="Click-through of the Unvibe app: Today, Library, a quiz, After-Agent Review, Ask Vibe and the Command U panel"
      />
    </div>
  );
}
