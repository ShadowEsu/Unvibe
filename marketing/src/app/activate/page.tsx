"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEVICE_CODE_KEY = "unvibe_device_user_code";

function activateOrigin(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/activate`;
}

function publicSupabase(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && key ? { url, key } : null;
}

export default function ActivatePage() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const config = publicSupabase();
  const configured = Boolean(config);

  const client = useMemo((): SupabaseClient | null => {
    if (!config) return null;
    return createClient(config.url, config.key, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }, [config?.url, config?.key]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromDevice = params.get("user_code") || params.get("device") || params.get("device_code");
    if (fromDevice) {
      const normalized = fromDevice.trim().toUpperCase();
      setCode(normalized);
      try {
        window.sessionStorage.setItem(DEVICE_CODE_KEY, normalized);
      } catch {
        /* ignore */
      }
    } else {
      try {
        const saved = window.sessionStorage.getItem(DEVICE_CODE_KEY);
        if (saved) setCode(saved);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!client) {
      setMessage("Sign-in is not configured for this environment yet.");
      setBootstrapping(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const oauthCode = params.get("code");
      if (oauthCode && oauthCode.length > 16) {
        const { error } = await client!.auth.exchangeCodeForSession(oauthCode);
        if (error && !cancelled) {
          setAuthMessage("Google sign-in did not finish. Try Continue with Google again.");
        }
        window.history.replaceState({}, "", activateOrigin());
      }

      const { data } = await client!.auth.getSession();
      if (!cancelled) {
        setAccessToken(data.session?.access_token ?? null);
        setBootstrapping(false);
      }
    }

    void bootstrap();

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  async function approve() {
    setStatus("working");
    setMessage("");
    try {
      const res = await fetch("/api/activate/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ userCode: code.trim() }),
      });
      if (!res.ok) {
        setStatus("error");
        setMessage(
          res.status === 401
            ? "Sign in with Google first, then approve this device."
            : res.status === 404
              ? "That code was not recognised. Check the desktop app and try again."
              : "Something went wrong. Please try again.",
        );
        return;
      }
      try {
        window.sessionStorage.removeItem(DEVICE_CODE_KEY);
      } catch {
        /* ignore */
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage("Could not reach the server.");
    }
  }

  async function signInWithGoogle() {
    if (!client) return;
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (code.trim()) {
        try {
          window.sessionStorage.setItem(DEVICE_CODE_KEY, code.trim().toUpperCase());
        } catch {
          /* ignore */
        }
      }
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: activateOrigin(),
          queryParams: { prompt: "select_account", access_type: "online" },
        },
      });
      if (error) {
        setAuthMessage(
          error.message?.includes("provider")
            ? "Google is not enabled yet in Supabase Auth. Enable the Google provider and add this redirect URL."
            : "Google sign-in failed. Check Supabase Auth, Google, and try again.",
        );
        setAuthBusy(false);
      }
    } catch {
      setAuthMessage("Google sign-in could not start. Try again.");
      setAuthBusy(false);
    }
  }

  async function sendMagicLink() {
    if (!client) return;
    setAuthBusy(true);
    setAuthMessage("");
    try {
      if (code.trim()) {
        try {
          window.sessionStorage.setItem(DEVICE_CODE_KEY, code.trim().toUpperCase());
        } catch {
          /* ignore */
        }
      }
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: activateOrigin() },
      });
      setAuthMessage(
        error
          ? "Could not send a sign-in link. Check the address and try again."
          : "Check your email, then return here to approve this device.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <div className="activate-shell">
      <div className="activate-brand">Unvibe</div>
      <div className="activate-card">
        {status === "done" ? (
          <div className="activate-success">
            <h2>You are connected</h2>
            <p>Return to the Unvibe desktop app. It will finish signing in on its own.</p>
          </div>
        ) : (
          <>
            <div className="activate-kicker">Device approval</div>
            <h1 className="activate-title">Make this Mac yours.</h1>
            <p className="activate-sub">
              Sign in with Google, approve the short code from the app, then go back to Unvibe.
            </p>
            {!accessToken && (
              <div>
                <button
                  className="activate-btn activate-btn--google"
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  disabled={!configured || authBusy || bootstrapping}
                >
                  {authBusy ? "Opening Google…" : "Continue with Google"}
                </button>
                {authMessage && <p className="activate-note activate-note--error">{authMessage}</p>}
                <div className="activate-divider">or email a link</div>
                <label className="activate-label" htmlFor="activate-email">Email</label>
                <input
                  id="activate-email"
                  className="activate-field"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.edu"
                  aria-label="Email address"
                />
                <button
                  className="activate-btn activate-btn--ghost"
                  type="button"
                  onClick={() => void sendMagicLink()}
                  disabled={!configured || !email || authBusy}
                >
                  {authBusy ? "Sending link…" : "Email me a secure sign-in link"}
                </button>
                <div className="activate-divider">then</div>
              </div>
            )}
            <div>
              <label className="activate-label" htmlFor="activate-code">Device code</label>
              <input
                id="activate-code"
                className="activate-field activate-field--code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                aria-label="Device code"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button
                className="activate-btn"
                type="button"
                onClick={() => void approve()}
                disabled={status === "working" || code.length < 4 || !accessToken || bootstrapping}
              >
                {status === "working" ? "Connecting…" : "Connect this device"}
              </button>
              {status === "error" && <p className="activate-note activate-note--error">{message}</p>}
              {!accessToken && (
                <p className="activate-note">
                  {configured
                    ? "Sign in with Google above before approving this device."
                    : message || "Sign-in is not configured for this environment yet."}
                </p>
              )}
              {accessToken && <p className="activate-note">Signed in. Enter the device code to finish.</p>}
            </div>
          </>
        )}
      </div>
      <p className="activate-foot">Private by design. Secrets stay on your Mac.</p>
    </div>
  );
}
