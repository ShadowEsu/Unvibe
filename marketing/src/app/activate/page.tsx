"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clearDeviceCode, pendingDeviceCode, saveDeviceCode } from "@/lib/deviceApproval";

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

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
  const [codeFromLink, setCodeFromLink] = useState(false);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const emailField = useRef<HTMLInputElement>(null);
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
    const pending = pendingDeviceCode(window.location.search, sessionStore());
    setCode(pending.code);
    setCodeFromLink(pending.fromLink);
    if (pending.cleanSearch !== null) {
      window.history.replaceState({}, "", `${window.location.pathname}${pending.cleanSearch}${window.location.hash}`);
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
            ? "Sign in first, then approve."
            : res.status === 404
              ? "That code was not recognised. Check the desktop app and try again."
              : "Something went wrong. Please try again.",
        );
        return;
      }
      clearDeviceCode(sessionStore());
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
      saveDeviceCode(code, codeFromLink, sessionStore());
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
            ? "Google sign-in is not available right now. Use the email link below instead."
            : "Google sign-in did not start. Try again, or use the email link below.",
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
      saveDeviceCode(code, codeFromLink, sessionStore());
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

  /** The browser's own email check, shown inline: an empty or partial address never reaches Supabase. */
  function submitMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = emailField.current;
    if (field && !field.checkValidity()) {
      setEmailError(field.validity.valueMissing ? "Enter your email." : "Enter a full email address, like you@school.edu.");
      field.focus();
      return;
    }
    setEmailError("");
    void sendMagicLink();
  }

  return (
    <div className="activate-shell">
      <div className="activate-brand">Unvibe</div>
      <div className="activate-card">
        {status === "done" ? (
          <div className="activate-success" role="status">
            <h1>You are connected</h1>
            <p>Return to the Unvibe desktop app. It will finish signing in on its own.</p>
          </div>
        ) : (
          <>
            <h1 className="activate-title">Sign in the Unvibe app on your computer</h1>
            <p className="activate-sub">
              Sign in here, check the code, then go back to the app.
            </p>
            {codeFromLink && (
              <section className="activate-check" aria-labelledby="activate-check-title">
                <h2 className="activate-check__title" id="activate-check-title">
                  <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" focusable="false">
                    <path d="M8 1.5 15 14.5H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M8 6v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="8" cy="12.2" r="0.9" fill="currentColor" />
                  </svg>
                  Check before you approve
                </h2>
                <ul>
                  <li>Approving signs in an Unvibe app with your account.</li>
                  <li>Only approve if the code below matches the code your Unvibe app is showing right now.</li>
                  <li>If someone else sent you this link, stop here. Approving would let them use your account.</li>
                </ul>
              </section>
            )}
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
                {authMessage && <p className="activate-note activate-note--error" role="alert">{authMessage}</p>}
                <div className="activate-divider">or email a link</div>
                <form noValidate onSubmit={submitMagicLink}>
                  <label className="activate-label" htmlFor="activate-email">Email</label>
                  <input
                    ref={emailField}
                    id="activate-email"
                    className="activate-field"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError("");
                    }}
                    placeholder="you@school.edu"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? "activate-email-error" : undefined}
                  />
                  {emailError && (
                    <p className="activate-note activate-note--error activate-note--field" id="activate-email-error" role="alert">
                      {emailError}
                    </p>
                  )}
                  <button
                    className="activate-btn activate-btn--ghost"
                    type="submit"
                    disabled={!configured || authBusy}
                  >
                    {authBusy ? "Sending link…" : "Email me a secure sign-in link"}
                  </button>
                </form>
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
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button
                className="activate-btn"
                type="button"
                onClick={() => void approve()}
                disabled={status === "working" || code.length < 4 || !accessToken || bootstrapping}
              >
                {status === "working" ? "Approving…" : "Approve sign-in"}
              </button>
              {status === "error" && <p className="activate-note activate-note--error" role="alert">{message}</p>}
              {!accessToken && (
                <p className="activate-note">
                  {configured
                    ? "Sign in above, then approve."
                    : message || "Sign-in is not configured for this environment yet."}
                </p>
              )}
              {accessToken && <p className="activate-note">Signed in. Check the code matches your app, then approve.</p>}
            </div>
          </>
        )}
      </div>
      <p className="activate-foot">Private by design. Secrets stay on your computer.</p>
    </div>
  );
}
