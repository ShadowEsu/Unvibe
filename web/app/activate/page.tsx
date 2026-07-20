'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEVICE_CODE_KEY = 'unvibe_device_user_code';

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="#3d2080" strokeOpacity="0.22" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" transform="translate(0.7 0.7)">
        <path d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z" />
        <path d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4" />
      </g>
      <g stroke="#3d2080" strokeOpacity="0.12" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" transform="translate(1 1)">
        <path d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z" />
        <path d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4" />
      </g>
      <g stroke="#6f45d2" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 2.4 20.4 7.2 V16.8 L12 21.6 3.6 16.8 V7.2 Z" />
        <path d="M8.8 8.4 V12.3 A3.2 3.2 0 0 0 15.2 12.3 V8.4" />
      </g>
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.4 14.7 2.4 12 2.4 6.9 2.4 2.7 6.6 2.7 11.7S6.9 21 12 21c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.5H12z" />
    </svg>
  );
}

function activateOrigin(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/activate`;
}

export default function ActivatePage() {
  const [code, setCode] = useState('');
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
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Device codes use user_code (or legacy device). Never treat OAuth ?code= as a device code.
    const fromDevice =
      params.get('user_code') ||
      params.get('device') ||
      params.get('device_code');
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
      setMessage('Sign-in is not configured for this environment yet.');
      setBootstrapping(false);
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      const params = new URLSearchParams(window.location.search);
      const oauthCode = params.get('code');
      // OAuth auth codes are long; device user codes are short (8 chars).
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
            ? 'Sign in with Google first, then approve this device.'
            : res.status === 404
              ? 'That code was not recognised. Check the desktop app and try again.'
              : 'Something went wrong. Please try again.',
        );
        return;
      }
      try {
        window.sessionStorage.removeItem(DEVICE_CODE_KEY);
      } catch {
        /* ignore */
      }
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
      if (code.trim()) {
        try {
          window.sessionStorage.setItem(DEVICE_CODE_KEY, code.trim().toUpperCase());
        } catch {
          /* ignore */
        }
      }
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
          ? 'Could not send a sign-in link. Check the address and try again.'
          : 'Check your email, then return here to approve this device.',
      );
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <div className="activate-shell">
      <div className="activate-brand">
        <span className="activate-brand__mark">
          <LogoMark />
        </span>
        <span className="activate-brand__name">Unvibe</span>
      </div>

      <div className="activate-card">
        {status === 'done' ? (
          <div className="activate-success">
            <div className="activate-success__icon" aria-hidden="true">
              ✓
            </div>
            <h2>You are connected</h2>
            <p>
              Return to the Unvibe desktop app — it will finish signing in on its
              own.
            </p>
          </div>
        ) : (
          <>
            <div className="activate-kicker">
              <span className="activate-kicker__dot" aria-hidden="true" />
              Device approval
            </div>
            <h1 className="activate-title">Connect your desktop app</h1>
            <p className="activate-sub">
              Sign in with Google, then approve the code from Unvibe to link this
              Mac.
            </p>

            <div className="activate-steps" aria-hidden="true">
              <div className="activate-step">
                <span className="activate-step__n">1</span>
                <div>
                  <div className="activate-step__t">Sign in with Google</div>
                  <div className="activate-step__d">
                    Use your Google account — Unvibe never sees your password.
                  </div>
                </div>
              </div>
              <div className="activate-step">
                <span className="activate-step__n">2</span>
                <div>
                  <div className="activate-step__t">Enter the device code</div>
                  <div className="activate-step__d">
                    Copy it from the desktop app or the shortcut prompt.
                  </div>
                </div>
              </div>
              <div className="activate-step">
                <span className="activate-step__n">3</span>
                <div>
                  <div className="activate-step__t">Return to Unvibe</div>
                  <div className="activate-step__d">
                    The app completes sign-in automatically.
                  </div>
                </div>
              </div>
            </div>

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
              <label className="activate-label" htmlFor="activate-code">
                Device code
              </label>
              <input
                id="activate-code"
                className="activate-field activate-field--code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXXXXXX"
                aria-label="Device code"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button
                className="activate-btn"
                type="button"
                onClick={approve}
                disabled={
                  status === 'working' || code.length < 4 || !accessToken || bootstrapping
                }
              >
                {status === 'working' ? 'Connecting…' : 'Connect this device'}
              </button>
              {status === 'error' && (
                <p className="activate-note activate-note--error">{message}</p>
              )}
              {!accessToken && (
                <p className="activate-note">
                  {configured
                    ? 'Sign in with Google (or email) above before approving this device.'
                    : message ||
                      'Sign-in is not configured for this environment yet.'}
                </p>
              )}
              {accessToken && (
                <p className="activate-note activate-note--ok">
                  Signed in. Enter the device code to finish.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      <p className="activate-foot">
        Private by design · Secrets stay on your Mac · Free during beta
      </p>
    </div>
  );
}
