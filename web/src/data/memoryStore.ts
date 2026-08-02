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
  redeemedAt?: number;
}

interface UsageCounters {
  selections: number;
  asks: number;
}

interface TokenRecord {
  userId: string;
  createdAt: number;
}

interface MemoryData {
  events: EventRecord[];
  tokens: Map<string, TokenRecord | string>; // token -> record (string = pre-expiry legacy record)
  devices: Map<string, PendingDevice>; // deviceCode -> pending
  users: Map<string, { email?: string }>; // userId -> profile
  usage: Map<string, UsageCounters>; // userId -> beta usage counters
}

/** Opaque sessions expire server-side after 30 days (migration 0004_session_expiry). */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
/** Device codes are short-lived, one-time, and expire after 10 minutes (migration 0002). */
const DEVICE_CODE_TTL_MS = 10 * 60_000;

/**
 * DEV-ONLY in-memory store, kept on globalThis so it survives route-module reloads within a
 * single `next` process. NOT for production — swap in SupabaseStore by setting SUPABASE_* env.
 * Mirrors the Supabase auth contract (migration 0006_atomic_device_flow): device codes expire,
 * approve is idempotent, and redemption is one-time.
 */
export class MemoryStore implements Store {
  readonly kind = 'memory (dev)';
  private readonly data: MemoryData;
  private readonly now: () => number;

  constructor(now: () => number = () => Date.now()) {
    this.now = now;
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

  private tokenRecord(token: string): TokenRecord | undefined {
    const record = this.data.tokens.get(token);
    if (typeof record === 'string') {
      // Migrate a pre-expiry legacy record (token -> userId) on first read.
      const migrated: TokenRecord = { userId: record, createdAt: this.now() };
      this.data.tokens.set(token, migrated);
      return migrated;
    }
    return record;
  }

  private mintToken(userId: string): string {
    const token = randomUUID();
    this.data.tokens.set(token, { userId, createdAt: this.now() });
    return token;
  }

  async createDeviceCode(baseUrl: string): Promise<DeviceCode> {
    const deviceCode = randomUUID();
    const userCode = randomUUID().slice(0, 8).toUpperCase();
    this.data.devices.set(deviceCode, { userCode, createdAt: this.now() });
    return { deviceCode, userCode, verificationUri: `${baseUrl}/activate`, interval: 2 };
  }

  async approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null> {
    const entry = [...this.data.devices.values()].find((d) => d.userCode === userCode.toUpperCase());
    if (!entry) {
      return null;
    }
    if (this.now() - entry.createdAt > DEVICE_CODE_TTL_MS) return null;
    if (entry.userId && entry.userId !== userId) return null;
    if (entry.redeemedAt) return null;
    if (entry.token) return entry.token;
    const token = this.mintToken(userId);
    entry.userId = userId;
    entry.token = token;
    this.data.users.set(userId, { email });
    return token; // also usable as a browser session
  }

  async redeemDeviceCode(deviceCode: string): Promise<{ token: string } | 'pending' | 'unknown' | 'expired' | 'used'> {
    const entry = this.data.devices.get(deviceCode);
    if (!entry) {
      return 'unknown';
    }
    if (this.now() - entry.createdAt > DEVICE_CODE_TTL_MS) {
      return 'expired';
    }
    if (!entry.token) {
      return 'pending';
    }
    if (entry.redeemedAt) {
      return 'used';
    }
    entry.redeemedAt = this.now();
    return { token: entry.token };
  }

  async userForToken(token: string): Promise<string | null> {
    const record = this.tokenRecord(token);
    if (!record) return null;
    if (this.now() - record.createdAt > SESSION_TTL_MS) {
      this.data.tokens.delete(token);
      return null;
    }
    return record.userId;
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
    const token = this.mintToken(userId);
    return { token, userId, email: normalized };
  }

  async signUp(email: string): Promise<Account | null> {
    const normalized = email.trim().toLowerCase();
    const existing = [...this.data.users.entries()].find(([, u]) => u.email === normalized)?.[0];
    if (existing) return null;
    const userId = randomUUID();
    this.data.users.set(userId, { email: normalized });
    const token = this.mintToken(userId);
    return { token, userId, email: normalized };
  }

  async accountInfo(userId: string): Promise<{ userId: string; email?: string }> {
    return { userId, email: this.data.users.get(userId)?.email };
  }

  async deleteAccount(userId: string): Promise<void> {
    this.data.events = this.data.events.filter((e) => e.userId !== userId);
    for (const [token, record] of [...this.data.tokens.entries()]) {
      const owner = typeof record === 'string' ? record : record.userId;
      if (owner === userId) {
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

  async historyPage(userId: string, limit: number, cursor?: string): Promise<import('./types').HistoryPage> {
    const offset = cursor ? Number.parseInt(cursor, 10) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid history cursor.');
    const events = (await this.history(userId, Number.MAX_SAFE_INTEGER));
    const page = events.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return { events: page, ...(nextOffset < events.length ? { nextCursor: String(nextOffset) } : {}) };
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
