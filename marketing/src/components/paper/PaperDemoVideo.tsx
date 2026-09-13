"use client";

import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";

/** Homepage main product demo: Cursor integration recording. */
export function PaperDemoVideo() {
  return (
    <div className="paper-video">
      <AutoPlayVideo
        src="/videos/unvibe-brief-demo.mp4"
        poster="/videos/unvibe-brief-demo-poster.jpg"
        label="Unvibe overlay working beside Cursor"
      />
    </div>
  );
}
