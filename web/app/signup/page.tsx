'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Sign-up failed.');
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
      <h1>Create an account</h1>
      <p className="subtitle">Your learning syncs across every device you use Unvibe on.</p>
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
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="auth-alt">
          Already have an account? <a href="/login">Sign in</a>.
        </p>
      </form>
    </div>
  );
}
