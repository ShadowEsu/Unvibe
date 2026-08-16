"use client";

import { useEffect, useMemo, useState } from "react";
import type { BuildStatus } from "@/lib/buildStatus";

type PublicStatus = BuildStatus & { isLive: boolean; sessionSeconds: number };

export function BuildLive() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/build-status", { cache: "no-store" });
        if (!response.ok) throw new Error("status unavailable");
        const next = await response.json() as PublicStatus;
        if (alive) {
          setStatus(next);
          setTick(0);
          setError(false);
        }
      } catch {
        if (alive) setError(true);
      }
    };
    void load();
    const poll = window.setInterval(load, 30_000);
    const clock = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => {
      alive = false;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, []);

  const sessionSeconds = useMemo(
    () => (status?.isLive ? status.sessionSeconds + tick : 0),
    [status, tick],
  );

  if (!status) {
    return (
      <div className="paper-live paper-glass paper-live--loading" aria-live="polite">
        <span />
        <p>{error ? "Build signal is reconnecting." : "Checking the build signal."}</p>
      </div>
    );
  }

  return (
    <div className={status.isLive ? "paper-live paper-glass is-live" : "paper-live paper-glass"} aria-live="polite">
      <div className="paper-live__signal">
        <span />
        <p className="paper-meta">{status.isLive ? "Building live" : "Last build session"}</p>
      </div>
      <h2>{status.focus}</h2>
      <p className="paper-lead">{status.note}</p>
      <div className="paper-live__stats">
        <Metric label={status.isLive ? "This session" : "Status"} value={status.isLive ? duration(sessionSeconds) : "Offline"} />
        <Metric label="Today" value={duration(status.todaySeconds + (status.isLive ? tick : 0))} />
        <Metric label="Total invested" value={`${(status.totalSeconds / 3600).toFixed(1)}h`} />
      </div>
      <p className="paper-live__updated">Updated {relativeTime(status.updatedAt)}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function duration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${minutes}m ${String(secs).padStart(2, "0")}s`;
}

function relativeTime(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
