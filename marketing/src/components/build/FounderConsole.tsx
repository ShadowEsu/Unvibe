"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BuildAction, BuildStatus } from "@/lib/buildStatus";
import { readResponseJson } from "@/lib/readResponseJson";

type PublicStatus = BuildStatus & { isLive: boolean; sessionSeconds: number };

export function FounderConsole() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [message, setMessage] = useState("Checking the founder clock.");
  const [busy, setBusy] = useState(false);
  const [hoursInput, setHoursInput] = useState("162");
  const [minutesInput, setMinutesInput] = useState("34");
  const [tick, setTick] = useState(0);

  const syncInputs = (totalSeconds: number) => {
    const safe = Math.max(0, Math.floor(totalSeconds));
    setHoursInput(String(Math.floor(safe / 3600)));
    setMinutesInput(String(Math.floor((safe % 3600) / 60)).padStart(2, "0"));
  };

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/build-status", { cache: "no-store" });
      const next = await readResponseJson<PublicStatus & { error?: string }>(response);
      if (!response.ok) throw new Error(next.error || "Could not load the founder clock.");
      setStatus(next);
      setTick(0);
      syncInputs(next.totalSeconds);
      setMessage(next.isLive ? "Clock is on. Hours and minutes are counting." : "Clock is off. Hours and minutes are paused.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load the founder clock.");
    }
  }, []);

  const send = useCallback(async (action: BuildAction, options?: { quiet?: boolean }) => {
    if (!options?.quiet) setBusy(true);
    try {
      const response = await fetch("/api/build-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const payload = await readResponseJson<PublicStatus & { error?: string }>(response);
      if (!response.ok) throw new Error(payload.error || "Could not update the founder clock.");
      setStatus(payload);
      setTick(0);
      if (action.action !== "heartbeat") syncInputs(payload.totalSeconds);
      setMessage(payload.isLive ? "Clock is on. Hours and minutes are counting." : "Clock is off. Hours and minutes are paused.");
    } catch (error) {
      if (!options?.quiet) {
        setMessage(error instanceof Error ? error.message : "Could not update the founder clock.");
      }
    } finally {
      if (!options?.quiet) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status?.isLive) return undefined;
    const beat = window.setInterval(() => {
      void send({ action: "heartbeat" }, { quiet: true });
    }, 20_000);
    const clock = window.setInterval(() => setTick((value) => value + 1), 1_000);
    return () => {
      window.clearInterval(beat);
      window.clearInterval(clock);
    };
  }, [status?.isLive, send]);

  const live = Boolean(status?.isLive);
  const liveSeconds = useMemo(() => {
    if (!status) return 0;
    return status.totalSeconds + (live ? tick : 0);
  }, [status, live, tick]);
  const liveClock = splitClock(liveSeconds);

  const saveClock = () => {
    const hours = Number.parseInt(hoursInput, 10);
    const minutes = Number.parseInt(minutesInput, 10);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
      setMessage("Hours must be 0 or more. Minutes must be 0 to 59.");
      return;
    }
    void send({ action: "set-clock", hours, minutes });
  };

  return (
    <div className="founder-console">
      <p className="paper-meta">Founder control</p>
      <h1>{live ? "Hours and minutes are on." : "Hours and minutes are off."}</h1>
      <p>{message}</p>
      <p className="founder-console__clock" aria-live="polite">
        <b>{liveClock.hours}</b>
        <small>hours</small>
        <b>{liveClock.minutes}</b>
        <small>minutes</small>
        <b>{liveClock.seconds}</b>
        <small>seconds</small>
      </p>
      <button
        type="button"
        className={live ? "paper-switch is-on" : "paper-switch"}
        role="switch"
        aria-checked={live}
        disabled={busy || !status}
        onClick={() => void send(live ? { action: "stop" } : { action: "start" })}
      >
        <span />
        {live ? "On" : "Off"}
      </button>
      <form
        className="founder-console__time"
        onSubmit={(event) => {
          event.preventDefault();
          saveClock();
        }}
      >
        <label>
          Hours
          <input
            inputMode="numeric"
            value={hoursInput}
            onChange={(event) => setHoursInput(event.target.value)}
            aria-label="Founder hours"
          />
        </label>
        <label>
          Minutes
          <input
            inputMode="numeric"
            value={minutesInput}
            onChange={(event) => setMinutesInput(event.target.value)}
            aria-label="Founder minutes"
          />
        </label>
        <button type="submit" disabled={busy || !status}>Save time</button>
      </form>
      <a href="/build" className="founder-public-link">Open the public view</a>
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
