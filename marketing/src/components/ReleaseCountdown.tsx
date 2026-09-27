export function ReleaseCountdown({ variant = "page" }: { variant?: "page" | "hero" }) {
  return (
    <div
      className={variant === "hero" ? "release-countdown release-countdown--hero" : "release-countdown"}
      role="status"
      aria-label="Unvibe verified release status"
    >
      <div className="release-countdown__heading">
        <span>VERIFIED RELEASE</span>
        <time dateTime="2026-09-23">IN PREPARATION</time>
      </div>
      <p className="release-countdown__status">Mac signing and Windows sign-in verification are underway. Join the community for verified availability updates.</p>
    </div>
  );
}
