"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GetUnvibe } from "@/components/paper/GetUnvibe";
import {
  clearPromoCode,
  formatCodeInput,
  normalisePromoCode,
  pendingPromoCode,
  redeemOutcome,
  savePromoCode,
  type RedeemOutcome,
} from "@/lib/promoRedeem";
import { SIGN_IN_DID_NOT_FINISH, signInReturnFailed, withoutSignInError } from "@/lib/oauthReturn";

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function redeemOrigin(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/redeem`;
}

/** The same Supabase project and keys /activate signs in with. */
function publicSupabase(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && key ? { url, key } : null;
}

/**
 * Promo codes for Pro months. Sign-in is /activate's: Google or an email link, PKCE, with the
 * site's public Supabase keys. The access token goes to /api/redeem with the code; the API checks
 * it and decides everything.
 */
export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const emailField = useRef<HTMLInputElement>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [signInFailed, setSignInFailed] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [working, setWorking] = useState(false);
  const [outcome, setOutcome] = useState<RedeemOutcome | null>(null);
  const config = publicSupabase();
  const configured = Boolean(config);
  const supabaseUrl = config?.url;
  const supabaseKey = config?.key;

  const client = useMemo((): SupabaseClient | null => {
    if (!supabaseUrl || !supabaseKey) return null;
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        flowType: "pkce",
        // The page reads ?code= (sign-in code only) itself and exchanges it once; ?promo= is the promo code.
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }, [supabaseUrl, supabaseKey]);

  useEffect(() => {
    let cancelled = false;
    const failed = signInReturnFailed(window.location.search, window.location.hash);
    const pending = pendingPromoCode(window.location.search, sessionStore());
    setCode(pending.code);
    // Cancel at Google, an expired email link or any sign-in error: say so, show none of the provider's text.
    if (failed) setSignInFailed(true);
    if (pending.cleanSearch !== null || failed) {
      const search = withoutSignInError(pending.cleanSearch ?? window.location.search);
      window.history.replaceState({}, "", `${window.location.pathname}${search}${failed ? "" : window.location.hash}`);
    }
    if (!client) {
      setBootstrapping(false);
      return;
    }

    async function bootstrap() {
      if (pending.authCode) {
        const { error } = await client!.auth.exchangeCodeForSession(pending.authCode);
        if (error && !cancelled) {
          setAuthMessage("Sign-in did not finish. Open the email link in this browser, or try Google again.");
        }
      }
      const { data } = await client!.auth.getSession();
      if (!cancelled) {
        setAccessToken(data.session?.access_token ?? null);
        setAccountEmail(data.session?.user.email ?? null);
        setBootstrapping(false);
      }
    }

    void bootstrap();

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setAccessToken(session?.access_token ?? null);
      setAccountEmail(session?.user.email ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  async function redeem() {
    setWorking(true);
    setOutcome(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken, code }),
      });
      const result = redeemOutcome(res.status, await res.json().catch(() => ({})));
      if (result.final) clearPromoCode(sessionStore());
      setOutcome(result);
    } catch {
      setOutcome({ kind: "unavailable", ok: false, line: "Could not reach Unvibe. Check your connection and try again.", showDownload: false, final: false });
    } finally {
      setWorking(false);
    }
  }

  async function signInWithGoogle() {
    if (!client) return;
    setAuthBusy(true);
    setAuthMessage("");
    setSignInFailed(false);
    try {
      savePromoCode(code, sessionStore());
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redeemOrigin(),
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
      savePromoCode(code, sessionStore());
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redeemOrigin() },
      });
      setAuthMessage(
        error
          ? "Could not send a sign-in link. Check the address and try again."
          : "Check your email and open the link in this browser to come back here.",
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
      setEmailError(field.validity.valueMissing ? "Enter your email." : "Enter a full email address, like you@example.com.");
      field.focus();
      return;
    }
    setEmailError("");
    void sendMagicLink();
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut().catch(() => undefined);
    setOutcome(null);
  }

  const codeReady = normalisePromoCode(code) !== null;

  return (
    <div className="redeem-shell">
      <div className="redeem-card">
        <h1 className="redeem-title">Redeem a promo code</h1>
        <p className="redeem-sub">
          Sign in, enter your code, and the Pro months go on your account. Use the account you sign in to the Unvibe app with.
        </p>

        {!accessToken && (
          <div>
            <button
              className="redeem-btn redeem-btn--quiet"
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={!configured || authBusy || bootstrapping}
            >
              {authBusy ? "Opening Google…" : "Continue with Google"}
            </button>
            {authMessage && <p className="redeem-note redeem-note--error" role="alert">{authMessage}</p>}
            {signInFailed && (
              <p className="redeem-note redeem-note--error" role="alert">
                {SIGN_IN_DID_NOT_FINISH}{" "}
                <button className="redeem-link redeem-link--inline" type="button" onClick={() => void signInWithGoogle()} disabled={!configured || authBusy}>
                  Try again with Google
                </button>
              </p>
            )}
            <div className="redeem-divider">or email a link</div>
            <form noValidate onSubmit={submitMagicLink}>
              <label className="redeem-label" htmlFor="redeem-email">Email</label>
              <input
                ref={emailField}
                id="redeem-email"
                className="redeem-field"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailError("");
                }}
                placeholder="you@example.com"
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? "redeem-email-error" : undefined}
              />
              {emailError && (
                <p className="redeem-note redeem-note--error redeem-note--field" id="redeem-email-error" role="alert">
                  {emailError}
                </p>
              )}
              <button className="redeem-btn redeem-btn--quiet" type="submit" disabled={!configured || authBusy}>
                {authBusy ? "Sending link…" : "Email me a secure sign-in link"}
              </button>
            </form>
            <div className="redeem-divider">then</div>
          </div>
        )}

        {accessToken && (
          <p className="redeem-account">
            Signed in{accountEmail ? <> as <strong>{accountEmail}</strong></> : null}.{" "}
            <button className="redeem-link" type="button" onClick={() => void signOut()}>Use a different account</button>
          </p>
        )}

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!working && codeReady && accessToken && !bootstrapping) void redeem();
          }}
        >
          <label className="redeem-label" htmlFor="redeem-code">Promo code</label>
          <input
            id="redeem-code"
            className="redeem-field redeem-field--code"
            value={code}
            onChange={(event) => setCode(formatCodeInput(event.target.value))}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="redeem-code-hint"
          />
          <p className="redeem-hint" id="redeem-code-hint">16 letters and numbers. Dashes and spaces are optional.</p>
          <button className="redeem-btn" type="submit" disabled={working || !codeReady || !accessToken || bootstrapping}>
            {working ? "Redeeming…" : "Redeem code"}
          </button>
        </form>
        {!accessToken && (
          <p className="redeem-note">
            {configured ? "Sign in above, then redeem." : "Sign-in is not configured for this environment yet."}
          </p>
        )}

        {outcome && (
          <p
            className={outcome.ok ? "redeem-result redeem-result--ok" : "redeem-result redeem-result--error"}
            role={outcome.ok ? "status" : "alert"}
          >
            {outcome.line}
          </p>
        )}

        {outcome?.showDownload && (
          <section className="redeem-next" aria-labelledby="redeem-next-title">
            <h2 className="redeem-next__title" id="redeem-next-title">Download Unvibe and sign in with the same account</h2>
            <p className="redeem-next__body">
              {accountEmail
                ? <>In the app, sign in as <strong>{accountEmail}</strong>. The Plan page there shows the Pro end date.</>
                : <>In the app, sign in with the account you used here. The Plan page there shows the Pro end date.</>}
            </p>
            <GetUnvibe surface="redeem" />
          </section>
        )}
      </div>
    </div>
  );
}
