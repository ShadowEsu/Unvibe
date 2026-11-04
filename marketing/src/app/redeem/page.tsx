"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GetUnvibe } from "@/components/paper/GetUnvibe";
import { agreementPayload, REDEEM_AGREEMENT_KEY, saveAgreement, storedAgreement } from "@/lib/accountAgreement";
import {
  clearPromoCode,
  formatCodeInput,
  normalisePromoCode,
  pendingPromoCode,
  PROMO_CODE_EXAMPLE,
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

/** A code value shown as text sits in <code> so it renders in JetBrains Mono (Design: 0/O and 1/l must differ). */
function withCodeExample(line: string) {
  const at = line.indexOf(PROMO_CODE_EXAMPLE);
  if (at < 0) return line;
  return (
    <>
      {line.slice(0, at)}
      <code>{PROMO_CODE_EXAMPLE}</code>
      {line.slice(at + PROMO_CODE_EXAMPLE.length)}
    </>
  );
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
 * site's public Supabase keys, after /activate's two unticked boxes (Terms and Privacy; 18 or
 * older). The access token goes to /api/redeem with the code and the agreement; the API checks
 * them and decides everything.
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
  const [terms, setTerms] = useState(false);
  const [age18, setAge18] = useState(false);
  const [agreeNote, setAgreeNote] = useState(false);
  const agreement = agreementPayload({ terms, age18 });
  const agreed = agreement !== null;
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

  // Only this person's own ticks from earlier in this browser session (the Google or email round trip).
  useEffect(() => {
    const saved = storedAgreement(REDEEM_AGREEMENT_KEY, sessionStore());
    setTerms(saved.terms);
    setAge18(saved.age18);
  }, []);

  function tick(which: "terms" | "age18", value: boolean) {
    const next = { terms, age18, [which]: value };
    setTerms(next.terms);
    setAge18(next.age18);
    if (next.terms && next.age18) setAgreeNote(false);
    saveAgreement(REDEEM_AGREEMENT_KEY, next, sessionStore());
  }

  /** Every way to sign in or redeem starts here: nothing is sent until both boxes are ticked. */
  function needsAgreement(): boolean {
    if (agreed) return false;
    setAgreeNote(true);
    return true;
  }

  async function redeem() {
    if (needsAgreement() || !agreement) return;
    setWorking(true);
    setOutcome(null);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessToken, code, agreement }),
      });
      const result = redeemOutcome(res.status, await res.json().catch(() => ({})));
      if (result.final) {
        clearPromoCode(sessionStore());
        saveAgreement(REDEEM_AGREEMENT_KEY, { terms: false, age18: false }, sessionStore());
      }
      setOutcome(result);
    } catch {
      setOutcome({ kind: "unavailable", ok: false, line: "Could not reach Unvibe. Check your connection and try again.", showDownload: false, final: false });
    } finally {
      setWorking(false);
    }
  }

  async function signInWithGoogle() {
    if (!client || needsAgreement()) return;
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
    if (!client || needsAgreement()) return;
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

  /** Someone else may sign in next, so the boxes are asked again. */
  async function signOut() {
    if (!client) return;
    await client.auth.signOut().catch(() => undefined);
    setOutcome(null);
    setTerms(false);
    setAge18(false);
    saveAgreement(REDEEM_AGREEMENT_KEY, { terms: false, age18: false }, sessionStore());
  }

  const codeReady = normalisePromoCode(code) !== null;

  return (
    <div className="redeem-shell">
      <div className="redeem-card">
        <h1 className="redeem-title">Redeem a promo code</h1>
        <p className="redeem-sub">
          Sign in, enter your code, and the Pro months go on your account. Use the account you sign in to the Unvibe app with.
        </p>

        <fieldset className="redeem-agree">
          <legend className="redeem-label">Before you sign in</legend>
          <label htmlFor="redeem-agree-terms">
            <input id="redeem-agree-terms" type="checkbox" checked={terms} onChange={(event) => tick("terms", event.target.checked)} />
            <span>
              I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and the{" "}
              <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
            </span>
          </label>
          <label htmlFor="redeem-agree-age">
            <input id="redeem-agree-age" type="checkbox" checked={age18} onChange={(event) => tick("age18", event.target.checked)} />
            <span>I&apos;m 18 or older</span>
          </label>
          {agreeNote && !agreed && <p className="redeem-note redeem-note--error" role="status">Tick both boxes first.</p>}
        </fieldset>

        {!accessToken && (
          <div>
            <button
              className="redeem-btn redeem-btn--quiet"
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={!configured || authBusy || bootstrapping}
              aria-disabled={!agreed}
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
              <button className="redeem-btn redeem-btn--quiet" type="submit" disabled={!configured || authBusy} aria-disabled={!agreed}>
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
            className="redeem-field redeem-field--code code-input"
            value={code}
            onChange={(event) => setCode(formatCodeInput(event.target.value))}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="redeem-code-hint"
          />
          <p className="redeem-hint" id="redeem-code-hint">16 letters and numbers. Dashes and spaces are optional.</p>
          <button className="redeem-btn" type="submit" disabled={working || !codeReady || !accessToken || bootstrapping} aria-disabled={!agreed}>
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
            {withCodeExample(outcome.line)}
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
