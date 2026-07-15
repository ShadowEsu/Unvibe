import { randomUUID } from 'node:crypto';
import type {
  Account,
  DeviceRedemption,
  DeviceCode,
  EventRecord,
  IncomingEvent,
  ProfileSummary,
  ProjectSummary,
  Store,
} from './types';
import { computeProfile, computeProjects } from './progress';

interface PendingDevice {
  userCode: string;
  userId?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: string;
  redeemedAt?: number;
  createdAt: number;
}

interface MemoryData {
  events: EventRecord[];
  tokens: Map<string, { userId: string; refreshToken: string; expiresAt: number }>; // access token -> session
  devices: Map<string, PendingDevice>; // deviceCode -> pending
  users: Map<string, { email?: string }>; // userId -> profile
  explanationRequests: Map<string, { userId: string; periodStart: string }>;
}

/**
 * DEV-ONLY in-memory store, kept on globalThis so it survives route-module reloads within a
 * single `next` process. NOT for production — swap in SupabaseStore by setting SUPABASE_* env.
 */
export class MemoryStore implements Store {
  readonly kind = 'memory (dev)';
  private readonly data: MemoryData;

  constructor() {
    const g = globalThis as unknown as { __uncodeData?: MemoryData };
    if (!g.__uncodeData) {
      g.__uncodeData = { events: [], tokens: new Map(), devices: new Map(), users: new Map(), explanationRequests: new Map() };
    }
    // Additive migration for a store created before `users` existed.
    if (!g.__uncodeData.users) {
      g.__uncodeData.users = new Map();
    }
    if (!g.__uncodeData.explanationRequests) g.__uncodeData.explanationRequests = new Map();
    this.data = g.__uncodeData;
  }

  async createDeviceCode(baseUrl: string): Promise<DeviceCode> {
    const deviceCode = randomUUID();
    const userCode = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    this.data.devices.set(deviceCode, { userCode, createdAt: Date.now() });
    return { deviceCode, userCode, verificationUri: `${baseUrl}/activate`, interval: 2 };
  }

  async approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null> {
    const entry = [...this.data.devices.values()].find((d) => d.userCode === userCode.toUpperCase());
    if (!entry || entry.redeemedAt || Date.now() > entry.createdAt + 10 * 60_000) {
      return null;
    }
    if (entry.userId && entry.userId !== userId) return null;
    const token = randomUUID();
    const refreshToken = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    entry.userId = userId;
    entry.token = token;
    entry.refreshToken = refreshToken;
    entry.expiresAt = expiresAt;
    this.data.users.set(userId, { email });
    this.data.tokens.set(token, { userId, refreshToken, expiresAt: Date.parse(expiresAt) });
    return token; // also usable as a browser session
  }

  async redeemDeviceCode(deviceCode: string): Promise<DeviceRedemption> {
    const entry = this.data.devices.get(deviceCode);
    if (!entry || Date.now() > entry.createdAt + 10 * 60_000 || entry.redeemedAt) {
      return 'unknown';
    }
    if (!entry.token || !entry.refreshToken || !entry.expiresAt) {
      return 'pending';
    }
    entry.redeemedAt = Date.now();
    return { token: entry.token, refreshToken: entry.refreshToken, expiresAt: entry.expiresAt };
  }

  async userForToken(token: string): Promise<string | null> {
    const session = this.data.tokens.get(token);
    if (!session || session.expiresAt <= Date.now()) return null;
    return session.userId;
  }

  async refreshSession(refreshToken: string): Promise<{ token: string; refreshToken: string; expiresAt: string } | null> {
    const current = [...this.data.tokens.entries()].find(([, session]) => session.refreshToken === refreshToken);
    if (!current || current[1].expiresAt <= Date.now()) return null;
    const [oldToken, session] = current;
    const token = randomUUID();
    const nextRefresh = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    this.data.tokens.delete(oldToken);
    this.data.tokens.set(token, { userId: session.userId, refreshToken: nextRefresh, expiresAt: Date.parse(expiresAt) });
    return { token, refreshToken: nextRefresh, expiresAt };
  }

  async revokeToken(token: string): Promise<void> {
    this.data.tokens.delete(token);
  }

  async signIn(email: string): Promise<Account> {
    const normalized = email.trim().toLowerCase();
    let userId = [...this.data.users.entries()].find(([, u]) => u.email === normalized)?.[0];
    if (!userId) {
      userId = randomUUID();
      this.data.users.set(userId, { email: normalized });
    }
    const token = randomUUID();
    const refreshToken = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    this.data.tokens.set(token, { userId, refreshToken, expiresAt: Date.parse(expiresAt) });
    return { token, refreshToken, expiresAt, userId, email: normalized };
  }

  async signUp(email: string): Promise<Account | null> {
    const normalized = email.trim().toLowerCase();
    const existing = [...this.data.users.entries()].find(([, u]) => u.email === normalized)?.[0];
    if (existing) return null;
    const userId = randomUUID();
    this.data.users.set(userId, { email: normalized });
    const token = randomUUID();
    const refreshToken = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    this.data.tokens.set(token, { userId, refreshToken, expiresAt: Date.parse(expiresAt) });
    return { token, refreshToken, expiresAt, userId, email: normalized };
  }

  async accountInfo(userId: string): Promise<{ userId: string; email?: string }> {
    return { userId, email: this.data.users.get(userId)?.email };
  }

  async deleteAccount(userId: string): Promise<void> {
    this.data.events = this.data.events.filter((e) => e.userId !== userId);
    for (const [token, session] of [...this.data.tokens.entries()]) {
      if (session.userId === userId) {
        this.data.tokens.delete(token);
      }
    }
    for (const [dc, dev] of [...this.data.devices.entries()]) {
      if (dev.userId === userId) {
        this.data.devices.delete(dc);
      }
    }
    this.data.users.delete(userId);
    for (const [requestId, request] of this.data.explanationRequests) {
      if (request.userId === userId) this.data.explanationRequests.delete(requestId);
    }
  }

  private periodStart(): string {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }

  async usage(userId: string) {
    const { planLimit } = await import('@/billing/plans');
    const periodStart = this.periodStart();
    const used = [...this.data.explanationRequests.values()].filter((request) => request.userId === userId && request.periodStart === periodStart).length;
    const limit = planLimit('private_beta');
    return { planId: 'private_beta' as const, used, limit, remaining: limit === null ? null : Math.max(0, limit - used), periodStart };
  }

  async reserveExplanation(userId: string, requestId: string) {
    const existing = this.data.explanationRequests.get(requestId);
    if (existing && existing.userId !== userId) return null;
    if (existing) return this.usage(userId);
    const summary = await this.usage(userId);
    if (summary.limit !== null && summary.used >= summary.limit) return null;
    this.data.explanationRequests.set(requestId, { userId, periodStart: summary.periodStart });
    return this.usage(userId);
  }

  async releaseExplanation(userId: string, requestId: string): Promise<void> {
    const entry = this.data.explanationRequests.get(requestId);
    if (entry?.userId === userId) this.data.explanationRequests.delete(requestId);
  }

  async upsertEvents(userId: string, events: IncomingEvent[]): Promise<void> {
    for (const e of events) {
      const idx = this.data.events.findIndex((x) => x.userId === userId && x.id === e.id);
      const record: EventRecord = { ...e, userId };
      if (idx >= 0) {
        this.data.events[idx] = record;
      } else {
        this.data.events.push(record);
      }
    }
  }

  private eventsFor(userId: string): EventRecord[] {
    return this.data.events
      .filter((e) => e.userId === userId)
      .sort((a, b) => a.ts.localeCompare(b.ts));
  }

  async profile(userId: string): Promise<ProfileSummary> {
    return computeProfile(this.eventsFor(userId));
  }

  async history(userId: string, limit: number): Promise<EventRecord[]> {
    return this.eventsFor(userId).slice(-limit).reverse();
  }

  async projects(userId: string): Promise<ProjectSummary[]> {
    return computeProjects(this.eventsFor(userId));
  }
}
