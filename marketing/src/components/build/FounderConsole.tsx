"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { BUILD_FOCUS_OPTIONS, type BuildAction, type BuildStatus } from "@/lib/buildStatus";

type PublicStatus = BuildStatus & { isLive: boolean; sessionSeconds: number };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const founderSupabase = url && key ? createClient(url, key) : null;

export function FounderConsole() {
  const supabase = founderSupabase;
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [focus, setFocus] = useState<string>(BUILD_FOCUS_OPTIONS[0]);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("Checking founder session…");
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/build-status", { cache: "no-store" });
    if (!response.ok) return;
    const next = await response.json() as PublicStatus;
    setStatus(next);
    setFocus(next.focus);
    setNote(next.note);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setMessage("Google sign-in is not configured on this deployment.");
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setMessage(data.session ? "Founder session ready." : "Sign in with the founder Google account.");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setMessage(next ? "Founder session ready." : "Sign in with the founder Google account.");
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const send = useCallback(async (action: BuildAction) => {
    if (!session) return;
    setBusy(true);
    try {
      const response = await fetch("/api/build-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(action),
      });
      const payload = await response.json() as PublicStatus & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Update failed.");
      setStatus(payload);
      setMessage(action.action === "stop" ? "Build session stopped." : "Public build signal updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session || !status?.isBuilding) return;
    const timer = window.setInterval(() => void send({ action: "heartbeat" }), 30_000);
    return () => window.clearInterval(timer);
  }, [send, session, status?.isBuilding]);

  const signIn = async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/founder` },
    });
  };

  if (!session) {
    return (
      <div className="founder-signin">
        <p className="launch-label">Founder control</p>
        <h1>Start a public build session.</h1>
        <p>{message}</p>
        <button type="button" onClick={signIn} disabled={!supabase}>Continue with Google</button>
        <a href="/build">View the public build page →</a>
      </div>
    );
  }

  return (
    <div className="founder-console">
      <div className="founder-console__head">
        <div>
          <p className="launch-label">Founder control</p>
          <h1>{status?.isBuilding ? "Building live." : "Ready to build."}</h1>
          <p>{message}</p>
        </div>
        <button type="button" onClick={() => supabase?.auth.signOut()}>Sign out</button>
      </div>

      <section>
        <label>Current focus</label>
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
        <label htmlFor="build-note">Short public note</label>
        <textarea id="build-note" value={note} maxLength={220} onChange={(event) => setNote(event.target.value)} />
        <div className="founder-actions">
          <button type="button" disabled={busy} onClick={() => void send({ action: "update", focus, note })}>
            Save message
          </button>
          {status?.isBuilding ? (
            <button type="button" className="danger" disabled={busy} onClick={() => void send({ action: "stop" })}>
              Stop building
            </button>
          ) : (
            <button type="button" className="primary" disabled={busy} onClick={() => void send({ action: "start", focus, note })}>
              Start building live
            </button>
          )}
        </div>
      </section>
      <a href="/build" className="founder-public-link">Open the public view →</a>
    </div>
  );
}
