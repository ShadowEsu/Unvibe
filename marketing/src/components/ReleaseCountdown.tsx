"use client";

import { useEffect, useState } from "react";

const RELEASE_ISO = "2026-09-15T00:00:00+08:00";
const RELEASE_LABEL = "SEPTEMBER 15, 2026";
const RELEASE_AT = new Date(RELEASE_ISO).getTime();

type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const EMPTY: Remaining = { days: 0, hours: 0, minutes: 0, seconds: 0 };

export function ReleaseCountdown({ variant = "page" }: { variant?: "page" | "hero" }) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    const update = () => setRemaining(getRemaining(RELEASE_AT - Date.now()));
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const values = remaining ?? EMPTY;
  const released = remaining !== null && Object.values(remaining).every((value) => value === 0);

  return (
    <div
      className={variant === "hero" ? "release-countdown release-countdown--hero" : "release-countdown"}
      role="timer"
      aria-label={released ? "Unvibe private beta release day" : countdownLabel(values)}
    >
      <div className="release-countdown__heading">
        <span>{released ? "RELEASE DAY" : "PRIVATE BETA RELEASE"}</span>
        <time dateTime={RELEASE_ISO}>{RELEASE_LABEL}</time>
      </div>
      <div className="release-countdown__grid" aria-hidden="true">
        {([
          [values.days, "DAYS"],
          [values.hours, "HOURS"],
          [values.minutes, "MINUTES"],
          [values.seconds, "SECONDS"],
        ] as const).map(([value, label]) => (
          <div key={label}>
            <strong>{remaining ? String(value).padStart(2, "0") : "--"}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function getRemaining(milliseconds: number): Remaining {
  const secondsTotal = Math.max(0, Math.floor(milliseconds / 1_000));
  return {
    days: Math.floor(secondsTotal / 86_400),
    hours: Math.floor((secondsTotal % 86_400) / 3_600),
    minutes: Math.floor((secondsTotal % 3_600) / 60),
    seconds: secondsTotal % 60,
  };
}

function countdownLabel(remaining: Remaining): string {
  return `Unvibe private beta releases in ${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes, and ${remaining.seconds} seconds`;
}
