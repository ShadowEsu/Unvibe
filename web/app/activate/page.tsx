'use client';

import { useEffect, useState } from 'react';

export default function ActivatePage() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('code');
    if (fromUrl) {
      setCode(fromUrl.toUpperCase());
    }
  }, []);

  async function approve() {
    setStatus('working');
    try {
      const res = await fetch('/api/v1/auth/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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

  return (
    <>
      <h1>Connect your editor</h1>
      <p className="subtitle">Enter the code shown in VS Code or Cursor.</p>

      {status === 'done' ? (
        <div className="empty">
          <p className="empty__title">Connected</p>
          <p>You can return to your editor — Uncode will finish signing in automatically.</p>
        </div>
      ) : (
        <div style={{ maxWidth: 320 }}>
          <input
            className="field mono"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            aria-label="Device code"
          />
          <button className="btn" onClick={approve} disabled={status === 'working' || code.length < 4}>
            {status === 'working' ? 'Connecting…' : 'Connect'}
          </button>
          {status === 'error' && (
            <p style={{ marginTop: 12, color: 'var(--fg-muted)' }}>{message}</p>
          )}
        </div>
      )}
    </>
  );
}
