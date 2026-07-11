/** Thin HTTP client for the Unvibe backend. Main process only. */
import type { LocalEvent } from '../core/learning';
import type { ComprehensionQuestion, ReviewRequestPayload } from '../core/protocol';

export const BACKEND = process.env.UNVIBE_BACKEND ?? 'http://localhost:8787';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

export interface Account {
  token: string;
  userId: string;
  email: string;
}

export async function signIn(email: string): Promise<Account> {
  const res = await fetch(`${BACKEND}/api/v1/auth/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.status === 400) throw new Error('Please enter a valid email address.');
  return json<Account>(res);
}

export async function deleteAccount(token: string): Promise<void> {
  const res = await fetch(`${BACKEND}/api/v1/account`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`delete failed (${res.status})`);
}

/** Best-effort event sync. Returns the ids the backend accepted (for outbox clearing). */
export async function pushEvents(token: string, events: LocalEvent[]): Promise<string[]> {
  if (events.length === 0) return [];
  const res = await fetch(`${BACKEND}/api/v1/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new Error(`sync failed (${res.status})`);
  return events.map((e) => e.id);
}

export async function fetchQuestion(payload: ReviewRequestPayload): Promise<ComprehensionQuestion> {
  const res = await fetch(`${BACKEND}/api/v1/comprehension`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return json<ComprehensionQuestion>(res);
}
