import type { LearningEvent } from '../learning/types';

export interface DeviceStart {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
}

function base(backendUrl: string): string {
  return backendUrl.replace(/\/$/, '');
}

export async function startDeviceAuth(backendUrl: string): Promise<DeviceStart> {
  const res = await fetch(`${base(backendUrl)}/api/v1/auth/device`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`device auth failed (${res.status})`);
  }
  return (await res.json()) as DeviceStart;
}

/** One poll. Returns a token when approved, or undefined while still pending. */
export async function pollToken(backendUrl: string, deviceCode: string): Promise<string | undefined> {
  const res = await fetch(`${base(backendUrl)}/api/v1/auth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceCode }),
  });
  if (res.status === 202) {
    return undefined;
  }
  if (!res.ok) {
    throw new Error(`token poll failed (${res.status})`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

export async function postEvents(
  backendUrl: string,
  token: string,
  events: LearningEvent[],
): Promise<void> {
  const res = await fetch(`${base(backendUrl)}/api/v1/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) {
    throw new Error(`event sync failed (${res.status})`);
  }
}
