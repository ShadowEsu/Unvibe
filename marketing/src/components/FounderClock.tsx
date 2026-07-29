"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { BuildStatus } from "@/lib/buildStatus";

type PublicStatus = BuildStatus & { isLive: boolean; sessionSeconds: number };

const FALLBACK_SECONDS = 160 * 60 * 60;

export function FounderClock({
  compact = false,
  prominent = false,
  onNavigate,
}: {
  compact?: boolean;
  prominent?: boolean;
  onNavigate?: () => void;
}) {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/build-status", { cache: "no-store" });
        if (!response.ok) return;
        const next = await response.json() as PublicStatus;
        if (alive) {
          setStatus(next);
          setTick(0);
        }
      } catch {
        // The visible fallback keeps this tiny status useful while the signal reconnects.
      }
    };
    void load();
    const poll = window.setInterval(load, 10_000);
    const clock = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, []);

  const seconds = useMemo(() => {
    if (!status) return FALLBACK_SECONDS;
    return status.totalSeconds + (status.isLive ? tick : 0);
  }, [status, tick]);
  const live = Boolean(status?.isLive);

  return (
    <Link
      href="/build"
      className={`founder-clock${live ? " founder-clock--live" : ""}${compact ? " founder-clock--compact" : ""}${prominent ? " founder-clock--prominent" : ""}`}
      aria-label={`${live ? "Founder is building live" : "Founder build time"}: ${longDuration(seconds)}`}
      title={live && status ? `Building: ${status.focus}` : "See the public build log"}
      onClick={onNavigate}
    >
      <span className="founder-clock__dial" aria-hidden="true"><i /></span>
      <span className="founder-clock__copy">
        <b>{clockDuration(seconds)}</b>
        <small>{live ? "building live" : "founder time"}</small>
      </span>
    </Link>
  );
}

function clockDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function longDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  return `${hours} hours ${minutes} minutes`;
}
