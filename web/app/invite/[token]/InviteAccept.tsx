'use client';

import { useState } from 'react';
import Link from 'next/link';

export function InviteAccept({ token }: { token: string }) {
  const [status, setStatus] = useState('Sign in with the invited email address, then accept this invitation.');
  const [busy, setBusy] = useState(false);
  const accept = async () => {
    setBusy(true);
    const response = await fetch('/api/v1/workspaces/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) });
    const data = await response.json().catch(() => ({})) as { message?: string; workspace?: { name: string } };
    setStatus(response.ok ? `You joined ${data.workspace?.name ?? 'the workspace'}.` : data.message ?? 'Sign in first or ask for a new invitation.');
    setBusy(false);
  };
  return <div className="auth-page"><p className="eyebrow">Workspace invitation</p><h1>Join your team in Uncode</h1><p>{status}</p><button className="btn btn--primary" onClick={() => void accept()} disabled={busy}>{busy ? 'Accepting…' : 'Accept invitation'}</button><p className="auth-alt"><Link href="/login">Sign in</Link> · <Link href="/plan">Open Plan & usage</Link></p></div>;
}
