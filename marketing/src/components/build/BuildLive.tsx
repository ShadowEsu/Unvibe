"use client";

import { useEffect, useMemo, useState } from "react";
import type { BuildStatus } from "@/lib/buildStatus";
import { readResponseJson } from "@/lib/readResponseJson";

type PublicStatus = BuildStatus & { isLive: boolean; sessionSeconds: number };

export function BuildLive() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/build-status", { cache: "no-store" });
        if (!response.ok) return;
        const next = await readResponseJson<PublicStatus>(response);
        if (alive) {
          setStatus(next);
          setTick(0);
        }
      } catch {
        // Keep the last known clock on the public page.
      }
    };
    void load();
    const poll = window.setInterval(() => void load(), 10_000);
    const clock = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, []);

  const seconds = useMemo(() => {
    if (!status) return 0;
    return status.totalSeconds + (status.isLive ? tick : 0);
  }, [status, tick]);
  const live = Boolean(status?.isLive);
  const clock = splitClock(seconds);

  if (!status) {
    return (
      <div className="paper-live paper-live--loading" aria-label="Loading live testing">
        <span />
        Loading live testing.
      </div>
    );
  }

  return (
    <div className={live ? "paper-live is-live" : "paper-live"}>
      <div className="paper-live__signal">
        <span />
        {live ? "Building live" : "Clock paused"}
      </div>
      <h2>{status.focus}</h2>
      <p className="paper-lead">{status.note}</p>
      <div className="paper-live__stats">
        <div>
          <span>Hours</span>
          <strong>{clock.hours}</strong>
        </div>
        <div>
          <span>Minutes</span>
          <strong>{clock.minutes}</strong>
        </div>
        <div>
          <span>Seconds</span>
          <strong>{clock.seconds}</strong>
        </div>
      </div>
      <p className="paper-live__updated">
        {live ? "The founder clock is on." : "The founder clock is off."}
      </p>
    </div>
  );
}

function splitClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  return {
    hours: String(Math.floor(safe / 3600)),
    minutes: String(Math.floor((safe % 3600) / 60)).padStart(2, "0"),
    seconds: String(safe % 60).padStart(2, "0"),
  };
}
