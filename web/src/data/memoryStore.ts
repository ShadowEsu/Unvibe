import { randomBytes, randomUUID } from 'node:crypto';
import type {
  Account,
  AccountDeletion,
  BetaDownloadOutcome,
  DeviceCode,
  EventRecord,
  IncomingEvent,
  ProfileSummary,
  ProjectSummary,
  Store,
} from './types';
import { computeProfile, computeProjects } from './progress';
import { EventOwnershipError } from './eventOwnership';
import { MemoryBillingStore } from '@/billing/memoryBillingStore';

interface PendingDevice {
  userCode: string;
  userId?: string;
  token?: string;
  createdAt: number;
  used?: boolean;
}

interface TokenRecord {
  userId: string;
  createdAt: number;
}

interface MemoryDeletion extends AccountDeletion {
  tokenHashes: Set<string>;
}

interface MemoryData {
  events: EventRecord[];
  tokens: Map<string, TokenRecord>;
  devices: Map<string, PendingDevice>;
  users: Map<string, { email?: string; createdAt: number }>;
  deletions: Map<string, MemoryDeletion>;
}

function publicDeletion({ tokenHashes: _tokenHashes, ...deletion }: MemoryDeletion): AccountDeletion {
  return deletion;
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_TTL_MS = 10 * 60 * 1000;

/**
 * DEV-ONLY in-memory store, kept on globalThis so it survives route-module reloads within a
 * single `next` process. NOT for production — swap in SupabaseStore by setting SUPABASE_* env.
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
        deletions: new Map(),
      };
    }
    if (!g.__uncodeData.users) g.__uncodeData.users = new Map();
    g.__uncodeData.deletions ??= new Map();
    this.data = g.__uncodeData;
  }

  async createDeviceCode(baseUrl: string): Promise<DeviceCode> {
    const deviceCode = randomUUID();
    const userCode = randomBytes(8).toString('hex').toUpperCase();
    this.data.devices.set(deviceCode, { userCode, createdAt: this.now() });
    return { deviceCode, userCode, verificationUri: `${baseUrl}/activate`, interval: 2 };
  }

  async approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null> {
    // Mirrors users_refuse_deleted_account: no session (and no users row) for an account being deleted.
    if (this.data.deletions.has(userId)) throw new Error('account_deleted');
    const entry = [...this.data.devices.values()].find((d) => d.userCode === userCode.toUpperCase());
    if (!entry) return null;
    if (this.now() - entry.createdAt > DEVICE_TTL_MS) return null;
    if (entry.used) return null;
    if (entry.userId && entry.userId !== userId) return null;
    if (entry.token) return entry.token;
    const token = randomUUID();
    entry.userId = userId;
    entry.token = token;
    this.data.users.set(userId, { email, createdAt: this.data.users.get(userId)?.createdAt ?? this.now() });
    this.data.tokens.set(token, { userId, createdAt: this.now() });
    return token;
  }

  async redeemDeviceCode(deviceCode: string): Promise<{ token: string } | 'pending' | 'unknown' | 'expired' | 'used'> {
    const entry = this.data.devices.get(deviceCode);
    if (!entry) return 'unknown';
    if (this.now() - entry.createdAt > DEVICE_TTL_MS) return 'expired';
    if (entry.used) return 'used';
    if (!entry.token) return 'pending';
    entry.used = true;
    return { token: entry.token };
  }

  async userForToken(token: string): Promise<string | null> {
    const record = this.data.tokens.get(token);
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
    if (userId && this.data.deletions.has(userId)) throw new Error('account_deleted');
    if (!userId) {
      userId = randomUUID();
      this.data.users.set(userId, { email: normalized, createdAt: this.now() });
    }
    const token = randomUUID();
    this.data.tokens.set(token, { userId, createdAt: this.now() });
    return { token, userId, email: normalized };
  }

  async signUp(email: string): Promise<Account | null> {
    const normalized = email.trim().toLowerCase();
    const existing = [...this.data.users.entries()].find(([, u]) => u.email === normalized)?.[0];
    if (existing) return null;
    const userId = randomUUID();
    this.data.users.set(userId, { email: normalized, createdAt: this.now() });
    const token = randomUUID();
    this.data.tokens.set(token, { userId, createdAt: this.now() });
    return { token, userId, email: normalized };
  }

  async accountInfo(userId: string): Promise<{ userId: string; email?: string; name?: string }> {
    return { userId, email: this.data.users.get(userId)?.email, name: this.names.get(userId) };
  }

  private readonly names = new Map<string, string>();

  async rememberName(userId: string, name: string): Promise<void> {
    this.names.set(userId, name);
  }

  async accountDeletion(userId: string): Promise<AccountDeletion | null> {
    const found = this.data.deletions.get(userId);
    return found ? publicDeletion(found) : null;
  }

  async accountDeletionForToken(tokenHash: string): Promise<AccountDeletion | null> {
    const found = [...this.data.deletions.values()].find((deletion) => deletion.tokenHashes.has(tokenHash));
    return found ? publicDeletion(found) : null;
  }

  async beginAccountDeletion(userId: string, email: string | undefined, tokenHash: string): Promise<AccountDeletion> {
    // Mirrors begin_account_deletion: only a sha256 hex token hash is ever stored, never the token.
    if (!/^[0-9a-f]{64}$/.test(tokenHash)) throw new Error('token hash must be sha256 hex');
    // Mirrors begin_account_deletion: a Teams owner with members is refused before anything is recorded.
    new MemoryBillingStore().refuseTeamWithMembers(userId);
    let deletion = this.data.deletions.get(userId);
    if (!deletion) {
      deletion = { userId, state: 'started', step: 'started', startedAt: new Date(this.now()).toISOString(), tokenHashes: new Set() };
      this.data.deletions.set(userId, deletion);
    }
    if (deletion.state === 'started') {
      // Mirrors begin_account_deletion: without an email from the caller, the users row's is captured.
      const normalized = email?.trim().toLowerCase() || this.data.users.get(userId)?.email?.trim().toLowerCase();
      if (!deletion.email && normalized) deletion.email = normalized;
      deletion.tokenHashes.add(tokenHash);
    }
    return publicDeletion(deletion);
  }

  async recordAccountDeletionStep(userId: string, step: 'auth_identity' | 'app_data' | 'beta_downloads', betaDownloads?: BetaDownloadOutcome): Promise<void> {
    const deletion = this.data.deletions.get(userId);
    if (deletion?.state !== 'started') return;
    deletion.step = step;
    if (betaDownloads) deletion.betaDownloads = betaDownloads;
  }

  /** Mirrors erase_account_data: the Teams check comes before anything is deleted; tokens go with the user. */
  async eraseAccount(userId: string): Promise<void> {
    const deletion = this.data.deletions.get(userId);
    if (deletion?.state !== 'started') throw new Error('account deletion was not started');
    await new MemoryBillingStore().deleteUserBilling(userId);
    this.data.events = this.data.events.filter((e) => e.userId !== userId);
    for (const [dc, dev] of [...this.data.devices.entries()]) {
      if (dev.userId === userId) {
        this.data.devices.delete(dc);
      }
    }
    this.names.delete(userId);
    this.data.users.delete(userId);
    for (const [token, record] of [...this.data.tokens.entries()]) {
      if (record.userId === userId) {
        this.data.tokens.delete(token);
      }
    }
    deletion.step = 'app_data';
  }

  async finishAccountDeletion(userId: string): Promise<void> {
    const deletion = this.data.deletions.get(userId);
    if (deletion?.state !== 'started') return;
    deletion.state = 'done';
    deletion.step = 'done';
    delete deletion.email;
  }

  async userIdForEmail(email: string): Promise<string | null> {
    const normalized = email.trim().toLowerCase();
    return [...this.data.users.entries()].find(([, u]) => u.email === normalized)?.[0] ?? null;
  }

  /** Mirrors account_deletion_address_reused: only a users row created after the deletion started counts. */
  async addressReusedSinceDeletion(userId: string, email: string): Promise<boolean> {
    const startedAt = this.data.deletions.get(userId)?.startedAt;
    if (!startedAt) return false;
    const normalized = email.trim().toLowerCase();
    return [...this.data.users.entries()].some(([id, u]) => id !== userId && u.email?.trim().toLowerCase() === normalized && u.createdAt > Date.parse(startedAt));
  }

  async upsertEvents(userId: string, events: IncomingEvent[], workspaceId?: string): Promise<void> {
    const ids = new Set(events.map((e) => e.id));
    const foreign = this.data.events.filter((x) => ids.has(x.id) && x.userId !== userId).map((x) => x.id);
    if (foreign.length > 0) throw new EventOwnershipError(foreign);
    for (const e of events) {
      const idx = this.data.events.findIndex((x) => x.userId === userId && x.id === e.id);
      const record: EventRecord = {
        ...e,
        userId,
        ...(workspaceId ? { workspaceId } : {}),
        authorUserId: userId,
        authorEmail: this.data.users.get(userId)?.email,
      };
      if (idx >= 0) {
        const previous = this.data.events[idx];
        this.data.events[idx] = {
          ...record,
          workspaceId: workspaceId ?? previous.workspaceId,
        };
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

  private withAuthor(event: EventRecord): EventRecord {
    return {
      ...event,
      authorUserId: event.userId,
      authorEmail: event.authorEmail ?? this.data.users.get(event.userId)?.email,
    };
  }

  private eventsForWorkspace(workspaceId: string): EventRecord[] {
    return this.data.events
      .filter((e) => e.workspaceId === workspaceId)
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .map((e) => this.withAuthor(e));
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

  async workspaceHistoryPage(workspaceId: string, limit: number, cursor?: string): Promise<import('./types').HistoryPage> {
    const offset = cursor ? Number.parseInt(cursor, 10) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid history cursor.');
    const events = this.eventsForWorkspace(workspaceId).slice().reverse();
    const page = events.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return { events: page, ...(nextOffset < events.length ? { nextCursor: String(nextOffset) } : {}) };
  }

  async workspaceProjects(workspaceId: string): Promise<ProjectSummary[]> {
    return computeProjects(this.eventsForWorkspace(workspaceId));
  }
}
