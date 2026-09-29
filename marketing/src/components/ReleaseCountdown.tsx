"use client";

import { useEffect, useState } from "react";

/**
 * Replaces the expired September 7 countdown with a live status badge
 * that shows the current beta is active and available.
 */
export function ReleaseCountdown({ variant = "page" }: { variant?: "page" | "hero" }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div
      className={variant === "hero" ? "release-status release-status--hero" : "release-status"}
      role="status"
      aria-label="Unvibe is available now for Mac and Windows"
    >
      <div className="release-status__badge">
        <span className="release-status__dot" aria-hidden="true" />
        <span className="release-status__label">Live now</span>
      </div>
      {ready && (
        <p className="release-status__platforms">
          <strong>Mac</strong> (Apple silicon) and <strong>Windows</strong> (x64) · No API key · No card
        </p>
      )}
    </div>
  );
}
