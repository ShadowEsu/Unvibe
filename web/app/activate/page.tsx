'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.6 19.8 7.1 V16.9 L12 21.4 4.2 16.9 V7.1 Z"
        fill="currentColor"
      />
      <path
        d="M9 9 V12.2 A3 3 0 0 0 15 12.2 V9"
        stroke="#4F46E5"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ActivatePage() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    if (fromUrl) setCode(fromUrl.toUpperCase());
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setMessage('Sign-in is not configured for this environment yet.');
      return;
    }
    const client = createClient(url, key);
    void client.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
  }, []);

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
          res.status === 404
            ? 'That code was not recognised. Check the desktop app and try again.'
            : 'Something went wrong. Please try again.',
        );
        return;
      }
      setStatus('done');
    } catch {
      setStatus('error');
      setMessage('Could not reach the server.');
    }
  }

  async function sendMagicLink() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    setAuthBusy(true);
    setAuthMessage('');
    try {
      const client = createClient(url, key);
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href },
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
              Sign in once in the browser, then enter the code shown in Unvibe
              to link this Mac.
            </p>

            <div className="activate-steps" aria-hidden="true">
              <div className="activate-step">
                <span className="activate-step__n">1</span>
                <div>
                  <div className="activate-step__t">Verify your email</div>
                  <div className="activate-step__d">
                    We send a secure link — Unvibe never sees your password.
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
                  className="activate-btn"
                  type="button"
                  onClick={sendMagicLink}
                  disabled={!configured || !email || authBusy}
                >
                  {authBusy ? 'Sending link…' : 'Email me a secure sign-in link'}
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
                  status === 'working' || code.length < 4 || !accessToken
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
                    ? 'Sign in with email above before approving this device.'
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
