'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function ActivatePage() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    if (fromUrl) {
      setCode(fromUrl.toUpperCase());
    }
  }, []);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setMessage('Sign-in is not configured for this environment.'); return; }
    const client = createClient(url, key);
    void client.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token ?? null));
  }, []);

  async function approve() {
    setStatus('working');
    try {
      const res = await fetch('/api/v1/auth/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ userCode: code.trim() }),
      });
      if (!res.ok) {
        setStatus('error');
        setMessage(res.status === 404 ? 'That code was not recognised.' : 'Something went wrong.');
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
    const client = createClient(url, key);
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.href } });
    setAuthMessage(error ? 'Could not send a sign-in link. Check the address and try again.' : 'Check your email, then return here to approve this device.');
  }

  return (
    <>
      <h1>Connect your editor</h1>
      <p className="subtitle">Enter the code shown in VS Code or Cursor.</p>

      {status === 'done' ? (
        <div className="empty">
          <p className="empty__title">Connected</p>
          <p>You can return to your desktop app — it will finish signing in automatically.</p>
        </div>
      ) : (
        <div style={{ maxWidth: 320 }}>
          {!accessToken && <><input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" /><button className="btn" onClick={sendMagicLink} disabled={!email}>Email me a secure sign-in link</button>{authMessage && <p style={{ marginTop: 12, color: 'var(--fg-muted)' }}>{authMessage}</p>}</>}
          <input
            className="field mono"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            aria-label="Device code"
          />
          <button className="btn" onClick={approve} disabled={status === 'working' || code.length < 4 || !accessToken}>
            {status === 'working' ? 'Connecting…' : 'Connect'}
          </button>
          {status === 'error' && (
            <p style={{ marginTop: 12, color: 'var(--fg-muted)' }}>{message}</p>
          )}
          {!accessToken && <p style={{ marginTop: 12, color: 'var(--fg-muted)' }}>{message || 'Sign in through Supabase Auth before approving this device.'}</p>}
        </div>
      )}
    </>
  );
}
