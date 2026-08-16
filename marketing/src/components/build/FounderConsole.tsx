"use client";

import { useCallback, useEffect, useState } from "react";
import type { BuildAction, BuildStatus } from "@/lib/buildStatus";

type PublicStatus = BuildStatus & { isLive: boolean; sessionSeconds: number };

export function FounderConsole() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [message, setMessage] = useState("Checking live testing.");
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/build-status", { cache: "no-store" });
    if (!response.ok) return;
    const next = await response.json() as PublicStatus;
    setStatus(next);
    setMessage(next.isLive ? "Live testing is on." : "Live testing is off.");
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const send = useCallback(async (action: BuildAction) => {
    setBusy(true);
    try {
      const response = await fetch("/api/build-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const payload = await response.json() as PublicStatus & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Update failed.");
      setStatus(payload);
      setMessage(payload.isLive ? "Live testing is on." : "Live testing is off.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  const live = Boolean(status?.isLive);

  return (
    <div className="founder-console">
      <p className="paper-meta">Founder control</p>
      <h1>{live ? "Live testing is on." : "Live testing is off."}</h1>
      <p>{message}</p>
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
      <a href="/build" className="founder-public-link">Open the public view</a>
    </div>
  );
}
