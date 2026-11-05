/**
 * The branded intro overlay (lib/intro.ts; Design's vibrant B storyboard, 1.0 s): the mark scales in,
 * the name slides 4 px, a gradient rule draws, then the whole lockup fades away. Hidden unless the boot
 * script set `data-intro` on <html>; decorative, so screen readers skip it, and it never takes pointer
 * events from the page under it. The mark is inline SVG, so nothing waits on the network.
 */
export function Intro() {
  return (
    <div className="b-intro" aria-hidden="true">
      <div className="b-intro__lock">
        <svg className="b-intro__mark" viewBox="0 0 48 48" width="60" height="60">
          <path className="b-intro__body" d="M24 8C33 8 38.5 14 40 22.5C41.5 31 43 38 37.5 41C32 43.6 16 43.6 10.5 41C5 38 6.5 31 8 22.5C9.5 14 15 8 24 8Z" />
          <ellipse cx="18.6" cy="24.2" rx="3.3" ry="4.6" className="b-intro__eye" />
          <ellipse cx="29.4" cy="24.2" rx="3.3" ry="4.6" className="b-intro__eye" />
          <circle cx="17.6" cy="22.6" r="1.15" className="b-intro__glint" />
          <circle cx="28.4" cy="22.6" r="1.15" className="b-intro__glint" />
        </svg>
        <b className="b-intro__word">Unvibe</b>
        <i className="b-intro__rule" />
      </div>
    </div>
  );
}
