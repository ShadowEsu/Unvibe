import { randomUUID } from 'node:crypto';
import type {
  Account,
  DeviceCode,
  EventRecord,
  IncomingEvent,
  ProfileSummary,
  ProjectSummary,
  Store,
  UsageResult,
  UsageSummary,
} from './types';
import { computeProfile, computeProjects } from './progress';
import { limitFor } from '../billing/plans';

interface PendingDevice {
  userCode: string;
  userId?: string;
  token?: string;
  createdAt: number;
}

interface UsageCounters {
  selections: number;
  asks: number;
}

interface MemoryData {
  events: EventRecord[];
  tokens: Map<string, string>; // token -> userId
  devices: Map<string, PendingDevice>; // deviceCode -> pending
  users: Map<string, { email?: string }>; // userId -> profile
  usage: Map<string, UsageCounters>; // userId -> beta usage counters
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
      g.__uncodeData = {
        events: [],
        tokens: new Map(),
        devices: new Map(),
        users: new Map(),
        usage: new Map(),
      };
    }
    // Additive migrations for a store created before these fields existed.
    if (!g.__uncodeData.users) {
      g.__uncodeData.users = new Map();
    }
    if (!g.__uncodeData.usage) {
      g.__uncodeData.usage = new Map();
    }
    this.data = g.__uncodeData;
  }

  async createDeviceCode(baseUrl: string): Promise<DeviceCode> {
    const deviceCode = randomUUID();
    const userCode = randomUUID().slice(0, 8).toUpperCase();
    this.data.devices.set(deviceCode, { userCode, createdAt: Date.now() });
    return { deviceCode, userCode, verificationUri: `${baseUrl}/activate`, interval: 2 };
  }

  async approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null> {
    const entry = [...this.data.devices.values()].find((d) => d.userCode === userCode.toUpperCase());
    if (!entry) {
      return null;
    }
    if (entry.userId && entry.userId !== userId) return null;
    const token = randomUUID();
    entry.userId = userId;
    entry.token = token;
    this.data.users.set(userId, { email });
    this.data.tokens.set(token, userId);
    return token; // also usable as a browser session
  }

  async redeemDeviceCode(deviceCode: string): Promise<{ token: string } | 'pending' | 'unknown'> {
    const entry = this.data.devices.get(deviceCode);
    if (!entry) {
      return 'unknown';
    }
    if (!entry.token) {
      return 'pending';
    }
    return { token: entry.token };
  }

  async userForToken(token: string): Promise<string | null> {
    return this.data.tokens.get(token) ?? null;
  }

  async signIn(email: string): Promise<Account> {
    const normalized = email.trim().toLowerCase();
    let userId = [...this.data.users.entries()].find(([, u]) => u.email === normalized)?.[0];
    if (!userId) {
      userId = randomUUID();
      this.data.users.set(userId, { email: normalized });
    }
    const token = randomUUID();
    this.data.tokens.set(token, userId);
    return { token, userId, email: normalized };
  }

  async signUp(email: string): Promise<Account | null> {
    const normalized = email.trim().toLowerCase();
    const existing = [...this.data.users.entries()].find(([, u]) => u.email === normalized)?.[0];
    if (existing) return null;
    const userId = randomUUID();
    this.data.users.set(userId, { email: normalized });
    const token = randomUUID();
    this.data.tokens.set(token, userId);
    return { token, userId, email: normalized };
  }

  async accountInfo(userId: string): Promise<{ userId: string; email?: string }> {
    return { userId, email: this.data.users.get(userId)?.email };
  }

  async deleteAccount(userId: string): Promise<void> {
    this.data.events = this.data.events.filter((e) => e.userId !== userId);
    for (const [token, uid] of [...this.data.tokens.entries()]) {
      if (uid === userId) {
        this.data.tokens.delete(token);
      }
    }
    for (const [dc, dev] of [...this.data.devices.entries()]) {
      if (dev.userId === userId) {
        this.data.devices.delete(dc);
      }
    }
    this.data.users.delete(userId);
    this.data.usage.delete(userId);
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

  async usage(userId: string): Promise<UsageSummary> {
    const rec = this.data.usage.get(userId) ?? { selections: 0, asks: 0 };
    return {
      selectionsUsed: rec.selections,
      selectionsLimit: limitFor('selection'),
      asksUsed: rec.asks,
      asksLimit: limitFor('ask'),
    };
  }

  async consumeUsage(userId: string, kind: 'selection' | 'ask'): Promise<UsageResult> {
    const limit = limitFor(kind);
    const rec = this.data.usage.get(userId) ?? { selections: 0, asks: 0 };
    const used = kind === 'selection' ? rec.selections : rec.asks;
    if (used >= limit) {
      return { allowed: false, used, limit };
    }
    if (kind === 'selection') rec.selections += 1;
    else rec.asks += 1;
    this.data.usage.set(userId, rec);
    return { allowed: true, used: used + 1, limit };
  }
}
