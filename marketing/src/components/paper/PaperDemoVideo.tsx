"use client";

import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";

/** Homepage main product demo: Cursor integration recording. */
export function PaperDemoVideo() {
  return (
    <div className="paper-video">
      <AutoPlayVideo
        src="/videos/unvibe-cursor-demo-v2.mp4"
        poster="/videos/unvibe-cursor-demo-v2-poster.jpg"
        label="Unvibe overlay working beside Cursor"
      />
    </div>
  );
}
