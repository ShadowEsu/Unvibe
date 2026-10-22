'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clearDeviceCode, pendingDeviceCode, saveDeviceCode } from '@/lib/deviceCode';

function localStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.52h3.24c1.9-1.75 2.81-4.33 2.81-7.29Z" />
      <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.23L15.21 17a5.82 5.82 0 0 1-8.67-3.06H3.19v2.6A9.75 9.75 0 0 0 12 21.75Z" />
      <path fill="#FBBC05" d="M6.54 13.94a5.85 5.85 0 0 1 0-3.74V7.6H3.19a9.74 9.74 0 0 0 0 8.94l3.35-2.6Z" />
      <path fill="#EA4335" d="M12 6.39c1.51 0 2.87.52 3.94 1.54l2.95-2.95C16.83 3.06 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.81 5.35l3.35 2.6A5.82 5.82 0 0 1 12 6.39Z" />
    </svg>
  );
}

function activateOrigin(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/activate`;
}

export default function ActivatePage() {
  const [code, setCode] = useState('');
  const [codeFromLink, setCodeFromLink] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const initialCodeRef = useRef('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const client = useMemo((): SupabaseClient | null => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createClient(url, key, {
      auth: {
        flowType: 'pkce',
        // The callback below performs the PKCE exchange exactly once.
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }, []);

  useEffect(() => {
    // Device codes use user_code (or legacy device). Never treat OAuth ?code= as a device code.
    const pending = pendingDeviceCode(window.location.search, localStore());
    initialCodeRef.current = pending.code;
    setCode(pending.code);
    setCodeFromLink(pending.fromLink);
    if (pending.cleanSearch !== null) {
      window.history.replaceState({}, '', `${window.location.pathname}${pending.cleanSearch}${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    if (!client) {
      setMessage('Sign-in is not configured for this environment yet.');
      setBootstrapping(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const oauthCode = params.get('code');
      // OAuth auth codes are distinct from the user_code query parameter.
      if (oauthCode && oauthCode.length > 16) {
        const { error } = await client!.auth.exchangeCodeForSession(oauthCode);
        if (error && !cancelled) {
          setAuthMessage('Google sign-in did not finish. Try Continue with Google again.');
        }
        // Drop the OAuth code from the address bar; keep /activate clean.
        const clean = activateOrigin();
        window.history.replaceState({}, '', clean);
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
    setStatus('working');
    setMessage('');
    try {
      const res = await fetch('/api/v1/auth/approve', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ userCode: code.trim() }),
      });
      if (!res.ok) {
        setStatus('error');
        setMessage(
          res.status === 401
            ? 'Sign in with Google first, then approve.'
            : res.status === 404
              ? 'That code was not recognised. Check the desktop app and try again.'
              : 'Something went wrong. Please try again.',
        );
        return;
      }
      clearDeviceCode(localStore());
      setStatus('done');
    } catch {
      setStatus('error');
      setMessage('Could not reach the server.');
    }
  }

  async function signInWithGoogle() {
    if (!client) return;
    setAuthBusy(true);
    setAuthMessage('');
    try {
      saveDeviceCode(code, codeFromLink, localStore());
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: activateOrigin(),
          queryParams: { prompt: 'select_account', access_type: 'online' },
        },
      });
      if (error) {
        setAuthMessage(
          error.message?.includes('provider')
            ? 'Google is not enabled yet in Supabase Auth. Enable the Google provider and add this redirect URL.'
            : 'Google sign-in failed. Check Supabase Auth → Google and try again.',
        );
        setAuthBusy(false);
      }
      // On success the browser navigates away to Google.
    } catch {
      setAuthMessage('Google sign-in could not start. Try again.');
      setAuthBusy(false);
    }
  }

  async function sendMagicLink() {
    if (!client) return;
    setAuthBusy(true);
    setAuthMessage('');
    try {
      saveDeviceCode(code, codeFromLink, localStore());
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: activateOrigin() },
      });
      setAuthMessage(
        error
          ? 'Could not send a sign-in link. Check the address and try again.'
          : 'Check your email, then return here to approve this device.',
      );
    } finally {
      setAuthBusy(false);
    }
  }

  // A code passed in from the desktop app is shown as a quiet chip instead of an empty-looking field.
  const codeLocked = initialCodeRef.current.length >= 4 && code === initialCodeRef.current;

  return (
    <div className="activate-shell">
      <a className="activate-brand" href="https://unvibe.site">unvibe</a>

      <div className="activate-card">
        {status === 'done' ? (
          <div className="activate-success">
            <div className="activate-success__icon" aria-hidden="true" />
            <h2>You are connected</h2>
            <p>
              Return to the Unvibe desktop app. It will finish signing in on its
              own.
            </p>
          </div>
        ) : (
          <>
            <ol className="activate-progress" aria-label="Sign-in progress">
              <li className={accessToken ? 'is-done' : 'is-current'}><span>1</span>Sign in</li>
              <li className={accessToken ? 'is-current' : ''}><span>2</span>Approve</li>
              <li><span>3</span>Back to the app</li>
            </ol>
            <h1 className="activate-title">Sign in the Unvibe app on your computer</h1>
            <p className="activate-sub">
              {accessToken
                ? 'You are signed in. Check the code below matches your Unvibe app, then approve.'
                : 'Sign in here, check the code, and the Unvibe app finishes on its own.'}
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
              <div className="activate-section">
                <button
                  className="activate-btn activate-btn--google"
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={!configured || authBusy || bootstrapping}
                >
                  <GoogleMark />
                  {authBusy ? 'Opening Google…' : 'Continue with Google'}
                </button>
                {authMessage && (
                  <p
                    className={`activate-note ${
                      authMessage.startsWith('Check')
                        ? 'activate-note--ok'
                        : 'activate-note--error'
                    }`}
                  >
                    {authMessage}
                  </p>
                )}
                <div className="activate-divider">or email a link</div>
                <label className="activate-label" htmlFor="activate-email">
                  Email
                </label>
                <input
                  id="activate-email"
                  className="activate-field"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  aria-label="Email address"
                />
                <button
                  className="activate-btn activate-btn--ghost"
                  type="button"
                  onClick={sendMagicLink}
                  disabled={!configured || !email || authBusy}
                >
                  {authBusy ? 'Sending link…' : 'Email me a secure sign-in link'}
                </button>
                <div className="activate-divider">then</div>
              </div>
            )}

            <div className="activate-section">
              {codeLocked && !editingCode ? (
                <div className="activate-codechip">
                  <span className="activate-codechip__label">Device code</span>
                  <code>{code}</code>
                  <button type="button" onClick={() => setEditingCode(true)}>Change</button>
                </div>
              ) : (
              <>
              <label className="activate-label" htmlFor="activate-code">
                Device code
              </label>
              <input
                id="activate-code"
                className="activate-field activate-field--code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXXXXXXXXXX"
                aria-label="Device code"
                autoCapitalize="characters"
                spellCheck={false}
              />
              </>
              )}
              <button
                className="activate-btn"
                type="button"
                onClick={approve}
                disabled={
                  status === 'working' || code.length < 4 || !accessToken || bootstrapping
                }
              >
                {status === 'working' ? 'Approving…' : 'Approve sign-in'}
              </button>
              {status === 'error' && (
                <p className="activate-note activate-note--error">{message}</p>
              )}
              {!accessToken && (
                <p className="activate-note">
                  {configured
                    ? 'Sign in with Google (or email) above, then approve.'
                    : message ||
                      'Sign-in is not configured for this environment yet.'}
                </p>
              )}
              {accessToken && (
                <p className="activate-note activate-note--ok">
                  {code.length >= 4
                    ? 'Signed in. Check the code matches the one in the Unvibe app, then approve.'
                    : 'Signed in. Type the code shown in the Unvibe app, then approve.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="activate-foot">
        <p style={{ margin: 0 }}>Private by design · Secrets stay on your computer · Free during beta</p>
        <nav className="activate-links" aria-label="Policies and help">
          <a href="https://unvibe.site/privacy" target="_blank" rel="noreferrer">Privacy</a>
          <a href="https://unvibe.site/terms" target="_blank" rel="noreferrer">Terms</a>
          <a href="https://unvibe.site/data-controls" target="_blank" rel="noreferrer">Data controls</a>
          <a href="https://unvibe.site/beta#help" target="_blank" rel="noreferrer">Help</a>
          <a href="mailto:support@unvibe.site">support@unvibe.site</a>
        </nav>
      </div>
    </div>
  );
}
