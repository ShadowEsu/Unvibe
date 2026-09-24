export function ReleaseCountdown({ variant = "page" }: { variant?: "page" | "hero" }) {
  return (
    <div
      className={variant === "hero" ? "release-countdown release-countdown--hero" : "release-countdown"}
      role="status"
      aria-label="Unvibe public beta is available now"
    >
      <div className="release-countdown__heading">
        <span>PUBLIC BETA</span>
        <time dateTime="2026-09-23">AVAILABLE NOW</time>
      </div>
      <p className="release-countdown__status">Download for Mac or Windows. Start with 30 days, 50 AI explanations, and 50 selected-code reviews.</p>
    </div>
  );
}
