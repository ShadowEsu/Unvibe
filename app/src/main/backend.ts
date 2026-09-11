/** Thin HTTP client for the Unvibe backend. Main process only. */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { forSync, type LocalEvent } from '../core/learning';
import type { ComprehensionQuestion, ReviewRequestPayload } from '../core/protocol';
import { store } from './store';
import { bakedTrialToken } from './trial';
import { resolveBackendUrl } from './backendUrl';
import { specialCharForEmail } from './giftCode';

export { resolveBackendUrl } from './backendUrl';
export { specialCharForEmail } from './giftCode';

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

export const BACKEND = resolveBackendUrl();
const REQUEST_TIMEOUT_MS = 20_000;

/** Session bearer when signed in; otherwise sealed trial token + install id. */
export function aiAuthHeaders(sessionToken?: string | null): Record<string, string> {
  if (sessionToken) return { authorization: `Bearer ${sessionToken}` };
  const trial = bakedTrialToken();
  if (!trial) return {};
  return {
    authorization: `Bearer ${trial}`,
    'x-unvibe-install-id': store().installId(),
  };
}

/** Network access stays in the main process. Bound requests so an unavailable backend never
 * leaves the widget or account controls waiting indefinitely. */
async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return await fetch(url, { ...init, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Sync cancelled.');
    }
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('Unvibe could not reach the service in time. Check your connection and try again.');
    }
    throw new Error('Unvibe could not reach the service. You can keep learning locally and sync later.');
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (res.status === 401) throw new Error('Your session has expired. Please sign in again.');
    if (res.status === 429) throw new Error(body.message ?? 'Your plan limit has been reached. Open Plan & usage to review options.');
    if (res.status === 501) throw new Error('Cloud sign-in is not configured for this build. You can keep learning locally.');
    if (res.status >= 500) throw new Error('The service is temporarily unavailable. Please try again shortly.');
    throw new Error(`The service could not complete that request (${res.status}).`);
  }
  return (await res.json()) as T;
}

export interface BillingUsageLine { kind: string; used: number; limit: number; remaining: number; resetsAt: string }
export interface BillingOverview {
  workspace: { id: string; name: string; type: 'personal' | 'team'; role: 'owner' | 'admin' | 'member' };
  subscription: { plan: 'free' | 'pro' | 'teams'; interval: 'monthly' | 'annual' | 'lifetime' | null; status: string; seats: number; currentPeriodEnd?: string; cancelAtPeriodEnd: boolean };
  usage: BillingUsageLine[];
  occupiedSeats: number;
  pendingInvitations: number;
  minimumBillableSeats: number;
  canManageBilling: boolean;
  hasBillingAccount: boolean;
}

export async function billingOverview(token: string): Promise<{ overview: BillingOverview; checkoutAvailable: boolean; lifetimeAvailable: boolean }> {
  return json(await request(`${BACKEND}/api/v1/billing/overview`, { headers: { authorization: `Bearer ${token}` } }));
}

export async function startBillingCheckout(token: string, input: { plan: 'pro' | 'teams'; interval: 'monthly' | 'annual' | 'lifetime'; seats: number; workspaceId?: string; workspaceName?: string }): Promise<string> {
  if (input.plan === 'teams') {
    throw new Error('Teams is not available right now. Choose Pro for a personal plan.');
  }
  const result = await json<{ url: string }>(await request(`${BACKEND}/api/v1/billing/checkout`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(input),
  }));
  return result.url;
}

export async function startBillingPortal(token: string, workspaceId: string): Promise<string> {
  const result = await json<{ url: string }>(await request(`${BACKEND}/api/v1/billing/portal`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ workspaceId }),
  }));
  return result.url;
}

export interface GiftMine {
  email: string;
  code: string;
  joined: number;
  remaining: number;
  max: number;
  shareUrl: string;
}

export async function giftCardForEmail(email: string): Promise<GiftMine> {
  const code = specialCharForEmail(email);
  const shareUrl = `https://unvibe.site/?ref=${encodeURIComponent(code)}&from=${encodeURIComponent(email)}`;
  try {
    const res = await request(`${BACKEND}/api/v1/gifts/progress/${encodeURIComponent(code)}`, {});
    if (!res.ok) return { email, code, joined: 0, remaining: 5, max: 5, shareUrl };
    const data = await res.json() as { joined?: number; used?: number; remaining?: number; max?: number; limit?: number; shareUrl?: string };
    const joined = Number(data.joined ?? data.used ?? 0);
    const max = Number(data.max ?? data.limit ?? 5);
    const remaining = Number(data.remaining ?? Math.max(0, max - joined));
    return { email, code, joined, remaining, max, shareUrl: typeof data.shareUrl === 'string' ? data.shareUrl : shareUrl };
  } catch {
    return { email, code, joined: 0, remaining: 5, max: 5, shareUrl };
  }
}

export async function giftMine(token: string): Promise<GiftMine> {
  return json<GiftMine>(await request(`${BACKEND}/api/v1/gifts/mine`, { headers: { authorization: `Bearer ${token}` } }));
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

export async function signOut(token: string): Promise<void> {
  const res = await request(`${BACKEND}/api/v1/auth/signout`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  });
  await json<{ ok: boolean }>(res);
}

/** Best-effort event sync. Returns the ids the backend accepted (for outbox clearing). */
export async function pushEvents(token: string, events: LocalEvent[], workspaceId?: string): Promise<string[]> {
  if (events.length === 0) return [];
  const res = await request(`${BACKEND}/api/v1/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ events: events.map(forSync), ...(workspaceId ? { workspaceId } : {}) }),
  });
  await json<{ ok: boolean }>(res);
  return events.map((e) => e.id);
}

export interface WorkspaceAccess {
  id: string;
  name: string;
  type: 'personal' | 'team';
  role: 'owner' | 'admin' | 'member';
  ownerUserId: string;
}

export interface WorkspaceMember {
  userId: string;
  email?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface TeamActivityEvent {
  id: string;
  ts: string;
  scope: string;
  level: string;
  outcome: 'reviewed' | 'understood' | 'needs_review';
  file?: string;
  project?: string;
  concept?: string;
  conceptLabel?: string;
  userId: string;
  authorUserId?: string;
  authorEmail?: string;
  workspaceId?: string;
}

export async function listWorkspaces(token: string): Promise<WorkspaceAccess[]> {
  const result = await json<{ workspaces: WorkspaceAccess[] }>(await request(`${BACKEND}/api/v1/workspaces`, {
    headers: { authorization: `Bearer ${token}` },
  }));
  return result.workspaces;
}

export async function createTeamWorkspace(token: string, name: string): Promise<WorkspaceAccess> {
  const result = await json<{ workspace: WorkspaceAccess }>(await request(`${BACKEND}/api/v1/workspaces`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ name }),
  }));
  return result.workspace;
}

export async function listWorkspaceMembers(token: string, workspaceId: string): Promise<WorkspaceMember[]> {
  const result = await json<{ members: WorkspaceMember[] }>(await request(`${BACKEND}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/members`, {
    headers: { authorization: `Bearer ${token}` },
  }));
  return result.members;
}

export async function inviteWorkspaceMember(token: string, workspaceId: string, email: string, role: 'admin' | 'member' = 'member'): Promise<{ invitation: { id: string; email: string }; inviteUrl: string }> {
  return json(await request(`${BACKEND}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, role }),
  }));
}

export async function acceptWorkspaceInvite(token: string, inviteToken: string): Promise<WorkspaceAccess> {
  const result = await json<{ workspace: WorkspaceAccess }>(await request(`${BACKEND}/api/v1/workspaces/invitations/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ token: inviteToken }),
  }));
  return result.workspace;
}

export async function pullTeamHistory(token: string, workspaceId: string, limit = 50): Promise<TeamActivityEvent[]> {
  const params = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), 200)) });
  const result = await json<{ events: TeamActivityEvent[] }>(await request(`${BACKEND}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/history?${params}`, {
    headers: { authorization: `Bearer ${token}` },
  }));
  return result.events;
}

export async function pullTeamProjects(token: string, workspaceId: string): Promise<Array<{ name: string; reviews: number; lastActive: string }>> {
  const result = await json<{ projects: Array<{ name: string; reviews: number; lastActive: string }> }>(await request(`${BACKEND}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/projects`, {
    headers: { authorization: `Bearer ${token}` },
  }));
  return result.projects;
}

interface HistoryPage {
  events: LocalEvent[];
  nextCursor?: string;
}

/** Pull every remote event using stable cursors. Pages are requested sequentially so retries
 * and reconnects cannot apply a later page before its predecessor. Duplicate ids are folded. */
export async function pullEvents(
  token: string,
  onProgress?: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<LocalEvent[]> {
  const byId = new Map<string, LocalEvent>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ limit: '200' });
    if (cursor) params.set('cursor', cursor);
    const res = await request(`${BACKEND}/api/v1/history?${params}`, {
      headers: { authorization: `Bearer ${token}` },
      signal,
    });
    const payload = await json<HistoryPage | LocalEvent[]>(res);
    const page = Array.isArray(payload) ? { events: payload } : payload;
    for (const event of page.events) byId.set(event.id, event);
    onProgress?.(byId.size);
    cursor = page.nextCursor;
    if (cursor && seenCursors.has(cursor)) throw new Error('The service returned a repeated history cursor.');
    if (cursor) seenCursors.add(cursor);
  } while (cursor);
  return [...byId.values()].sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id));
}

export async function fetchQuestion(payload: ReviewRequestPayload, token?: string | null): Promise<ComprehensionQuestion> {
  const res = await request(`${BACKEND}/api/v1/comprehension`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...aiAuthHeaders(token),
    },
    body: JSON.stringify(payload),
  });
  return json<ComprehensionQuestion>(res);
}

export async function trialUsageOverview(): Promise<{
  plan: 'trial';
  usage: Array<{ kind: string; used: number; limit: number; remaining: number; resetsAt: string }>;
} | null> {
  const headers = aiAuthHeaders(null);
  if (!headers.authorization) return null;
  const res = await request(`${BACKEND}/api/v1/trial/usage`, { headers });
  if (!res.ok) return null;
  return json(res);
}
