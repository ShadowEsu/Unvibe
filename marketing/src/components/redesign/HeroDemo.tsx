const DEMO_EMBED = "https://www.youtube-nocookie.com/embed/a_X0MyBCkTo?rel=0&modestbranding=1";

/**
 * Homepage product demo. YouTube hosts the recording so the marketing site does not
 * depend on a downloadable build artifact or a fragile remote Blob URL.
 */
export function HeroDemo() {
  return (
    <div className="home-demo" aria-label="Unvibe product demo video">
      <div className="home-demo__frame">
        <div className="home-demo__chrome" aria-hidden="true">
          <span>UNVIBE DEMO</span>
          <span>MACOS · PRODUCT RECORDING</span>
        </div>
        <iframe
          className="home-demo__video"
          src={DEMO_EMBED}
          title="Unvibe product demo"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}
