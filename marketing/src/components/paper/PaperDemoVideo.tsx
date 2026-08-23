"use client";

import { AutoPlayVideo } from "@/components/paper/AutoPlayVideo";

/**
 * Homepage product demo from a site-hosted mp4.
 * YouTube embeds fail here because the site sends Referrer-Policy: no-referrer (Error 153).
 */
export function PaperDemoVideo() {
  return (
    <div className="paper-video">
      <AutoPlayVideo
        src="/videos/unvibe-app-tour.mp4"
        poster="/videos/unvibe-app-tour-poster.jpg"
        label="Unvibe explaining selected code beside an editor"
      />
    </div>
  );
}
