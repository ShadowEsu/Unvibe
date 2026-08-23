"use client";

const DEMO_EMBED =
  "https://www.youtube-nocookie.com/embed/a_X0MyBCkTo?rel=0&modestbranding=1&playsinline=1";

/**
 * Homepage product demo. YouTube hosts the recording so playback does not depend
 * on a missing public/videos deploy or a private/broken Blob URL.
 */
export function PaperDemoVideo() {
  return (
    <div className="paper-video paper-video--embed">
      <iframe
        className="paper-video__embed"
        src={DEMO_EMBED}
        title="Unvibe explaining selected code beside an editor"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
