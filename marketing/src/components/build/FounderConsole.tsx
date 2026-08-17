"use client";

import { useCallback, useEffect, useState } from "react";
import type { BuildAction, BuildStatus } from "@/lib/buildStatus";
import { readResponseJson } from "@/lib/readResponseJson";

type PublicStatus = BuildStatus & { isLive: boolean; sessionSeconds: number };

export function FounderConsole() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [message, setMessage] = useState("Checking live testing.");
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/build-status", { cache: "no-store" });
      const next = await readResponseJson<PublicStatus & { error?: string }>(response);
      if (!response.ok) throw new Error(next.error || "Could not load live testing.");
      setStatus(next);
      setMessage(next.isLive ? "Live testing is on." : "Live testing is off.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load live testing.");
    }
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
      const payload = await readResponseJson<PublicStatus & { error?: string }>(response);
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
