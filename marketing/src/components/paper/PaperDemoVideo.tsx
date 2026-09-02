"use client";

import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";

/** Homepage main product demo: Cursor integration recording. */
export function PaperDemoVideo() {
  return (
    <div className="paper-video">
      <AutoPlayVideo
        src="/videos/unvibe-cursor-demo.mp4?v=20260902b"
        poster="/videos/unvibe-cursor-demo-poster.jpg"
        label="Unvibe overlay working beside Cursor"
      />
    </div>
  );
}
