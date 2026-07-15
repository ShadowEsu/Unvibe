'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/signin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Sign-in failed.');
        return;
      }
      router.push('/');
    } catch {
      setError('Could not reach the service.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <h1>Sign in</h1>
      <p className="subtitle">Sign in to sync your learning across devices.</p>
      <form className="auth-form" onSubmit={submit}>
        <input
          className="field"
          type="email"
          autoComplete="email"
          placeholder="you@school.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <p className="auth-error">{error}</p>}
        <button className="btn" type="submit" disabled={busy || !email.trim()}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="auth-alt">
          No account? <a href="/signup">Create one</a>.
        </p>
      </form>
    </div>
  );
}
