"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { BUILD_FOCUS_OPTIONS, type BuildAction, type PublicBuildStatus } from "@/lib/buildStatus";
import {
  founderActionFailureMessage,
  type BuildStatusErrorPayload,
} from "@/lib/buildStatusError";

const PASSCODE_STORAGE_KEY = "unvibe-founder-control-passcode";

export function FounderConsole() {
  const [status, setStatus] = useState<PublicBuildStatus | null>(null);
  const [focus, setFocus] = useState<string>(BUILD_FOCUS_OPTIONS[0]);
  const [note, setNote] = useState("");
  const [passcode, setPasscode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState("Enter your founder passcode to start the public timer.");
  const [messageTone, setMessageTone] = useState<"default" | "error">("default");
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/build-status", { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json() as PublicBuildStatus;
      setStatus(next);
      setFocus(next.focus);
      setNote(next.note);
    } catch {
      // The status is a convenience; the user can still make a fresh action.
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(PASSCODE_STORAGE_KEY);
      if (!saved) return;
      setPasscode(saved);
      setUnlocked(true);
      setMessage("Founder control ready.");
    } catch {
      // Session storage is a convenience only; the control still works without it.
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const send = useCallback(async (action: BuildAction) => {
    if (requestInFlight.current) return;
    if (!passcode) {
      setMessage("Enter your founder passcode first.");
      setMessageTone("error");
      return;
    }
    requestInFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/build-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Founder-Control": passcode,
        },
        body: JSON.stringify(action),
      });
      const payload = await response.json().catch(() => null) as (PublicBuildStatus & BuildStatusErrorPayload) | null;
      if (!response.ok) {
        setMessage(founderActionFailureMessage(response.status, payload));
        setMessageTone("error");
        return;
      }
      if (!payload) {
        setMessage("Couldn’t save that update. Please try again.");
        setMessageTone("error");
        return;
      }
      setStatus(payload);
      setMessage(action.action === "stop" ? "Timer stopped." : "Saved to the public build page.");
      setMessageTone("default");
    } catch {
      setMessage("Couldn’t reach the timer. Check your connection and try again.");
      setMessageTone("error");
      void loadStatus();
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }, [loadStatus, passcode]);

  const unlock = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!passcode.trim()) {
      setMessage("Enter the founder passcode first.");
      setMessageTone("error");
      return;
    }
    try {
      window.sessionStorage.setItem(PASSCODE_STORAGE_KEY, passcode.trim());
    } catch {
      // The passcode remains available for this page even if storage is blocked.
    }
    setPasscode(passcode.trim());
    setUnlocked(true);
    setMessage("Founder control ready.");
    setMessageTone("default");
  };

  const lock = () => {
    try {
      window.sessionStorage.removeItem(PASSCODE_STORAGE_KEY);
    } catch {
      // Nothing else to clean up.
    }
    setPasscode("");
    setUnlocked(false);
    setMessage("Founder control locked.");
    setMessageTone("default");
  };

  if (!unlocked) {
    return (
      <form className="founder-signin" onSubmit={unlock}>
        <p className="launch-label">Founder control</p>
        <h1>Control the public timer.</h1>
        <p>{message} The passcode stays only in this browser session.</p>
        <label htmlFor="founder-passcode">Founder passcode</label>
        <input id="founder-passcode" type="password" autoComplete="current-password" value={passcode} onChange={(event) => setPasscode(event.target.value)} />
        <button type="submit">Open founder control</button>
        <a href="/build">View the public build page →</a>
      </form>
    );
  }

  return (
    <div className="founder-console">
      <div className="founder-console__head">
        <div>
          <p className="launch-label">Founder control</p>
          <h1>{status?.isBuilding ? "Timer is running." : "Start your timer."}</h1>
          <p className={`founder-console__message founder-console__message--${messageTone}`}>{message}</p>
        </div>
        <button type="button" onClick={lock}>Lock</button>
      </div>

      <section>
        <label>What are you working on?</label>
        <div className="founder-focus">
          {BUILD_FOCUS_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              className={focus === option ? "active" : ""}
              onClick={() => setFocus(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <label htmlFor="build-note">Optional public note</label>
        <textarea id="build-note" value={note} maxLength={220} placeholder="A short update for the public build page." onChange={(event) => setNote(event.target.value)} />
        <div className="founder-actions">
          <button type="button" disabled={busy} onClick={() => void send({ action: "update", focus, note })}>
            Save note
          </button>
          {status?.isBuilding ? (
            <button type="button" className="danger" disabled={busy} onClick={() => void send({ action: "stop" })}>
              Stop timer
            </button>
          ) : (
            <button type="button" className="primary" disabled={busy} onClick={() => void send({ action: "start", focus, note })}>
              Start timer
            </button>
          )}
        </div>
      </section>
      <a href="/build" className="founder-public-link">Open the public view →</a>
    </div>
  );
}
