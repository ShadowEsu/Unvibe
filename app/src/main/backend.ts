/** Thin HTTP client for the Unvibe backend. Main process only. */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { LocalEvent } from '../core/learning';
import type { ComprehensionQuestion, ReviewRequestPayload } from '../core/protocol';

/** Load .env into process.env when present (dev + packaged convenience). Never overrides existing vars. */
function loadAppEnv(): void {
  const candidates = [
    join(process.cwd(), '.env'),
    join(__dirname, '..', '..', '.env'),
    // Packaged app: ~/Library/Application Support/Unvibe/.env
    join(homedir(), 'Library', 'Application Support', 'Unvibe', '.env'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch {
      // ignore unreadable env files
    }
    // Keep scanning so userData .env can fill gaps left by an earlier file.
  }
}

loadAppEnv();

/** The desktop and `web/` development servers share this documented default. */
export function resolveBackendUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.UNVIBE_BACKEND || 'http://localhost:8787';
}

export const BACKEND = resolveBackendUrl();
const REQUEST_TIMEOUT_MS = 20_000;

/** Network access stays in the main process. Bound requests so an unavailable backend never
 * leaves the widget or account controls waiting indefinitely. */
async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('Unvibe could not reach the service in time. Check your connection and try again.');
    }
    throw new Error('Unvibe could not reach the service. You can keep learning locally and sync later.');
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401) throw new Error('Your session has expired. Please sign in again.');
    if (res.status === 429) throw new Error('Too many requests. Please wait a moment and try again.');
    if (res.status === 501) throw new Error('Cloud sign-in is not configured for this build. You can keep learning locally.');
    if (res.status >= 500) throw new Error('The service is temporarily unavailable. Please try again shortly.');
    throw new Error(`The service could not complete that request (${res.status}).`);
  }
  return (await res.json()) as T;
}

export interface Account {
  token: string;
  userId: string;
  email: string;
}

export interface DeviceStart { deviceCode: string; userCode: string; verificationUri: string; interval: number; }

export async function startDeviceAuth(): Promise<DeviceStart> {
  return json<DeviceStart>(await request(`${BACKEND}/api/v1/auth/device`, { method: 'POST' }));
}

export async function redeemDeviceAuth(deviceCode: string): Promise<{ token: string } | null> {
  const res = await request(`${BACKEND}/api/v1/auth/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deviceCode }) });
  if (res.status === 202) return null;
  return json<{ token: string }>(res);
}

export async function accountInfo(token: string): Promise<{ userId: string; email?: string }> {
  return json<{ userId: string; email?: string }>(await request(`${BACKEND}/api/v1/account`, { headers: { authorization: `Bearer ${token}` } }));
}

export async function signIn(email: string): Promise<Account> {
  const res = await request(`${BACKEND}/api/v1/auth/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.status === 400) throw new Error('Please enter a valid email address.');
  return json<Account>(res);
}

export async function signUp(email: string): Promise<Account> {
  const res = await request(`${BACKEND}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (res.status === 400) throw new Error('Please enter a valid email address.');
  if (res.status === 409) throw new Error('An account with this email already exists. Sign in instead.');
  return json<Account>(res);
}

export async function deleteAccount(token: string): Promise<void> {
  const res = await request(`${BACKEND}/api/v1/account`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  });
  await json<{ ok: boolean }>(res);
}

/** Best-effort event sync. Returns the ids the backend accepted (for outbox clearing). */
export async function pushEvents(token: string, events: LocalEvent[]): Promise<string[]> {
  if (events.length === 0) return [];
  const res = await request(`${BACKEND}/api/v1/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ events }),
  });
  await json<{ ok: boolean }>(res);
  return events.map((e) => e.id);
}

export async function fetchQuestion(payload: ReviewRequestPayload): Promise<ComprehensionQuestion> {
  const res = await request(`${BACKEND}/api/v1/comprehension`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return json<ComprehensionQuestion>(res);
}
