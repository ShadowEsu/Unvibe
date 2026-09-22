import { randomBytes, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

/**
 * Production store backed by Supabase (Postgres + RLS). Uses the service-role key on the
 * server. Schema + RLS live in supabase/migrations/0001_init.sql.
 *
 * NOTE: this path is code-complete but UNVERIFIED in this repo — it needs a real Supabase
 * project (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY). The dev MemoryStore is the verified path.
 */
export class SupabaseStore implements Store {
  readonly kind = 'supabase';
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string, fetcher?: typeof fetch) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
      ...(fetcher ? { global: { fetch: fetcher } } : {}),
    });
  }

  async createDeviceCode(baseUrl: string): Promise<DeviceCode> {
    const deviceCode = randomUUID();
    const userCode = randomBytes(8).toString('hex').toUpperCase();
    const { error } = await this.db.from('device_codes').insert({ device_code: deviceCode, user_code: userCode });
    if (error) throw new Error(`Could not create device authorization: ${error.message}`);
    return { deviceCode, userCode, verificationUri: `${baseUrl}/activate`, interval: 2 };
  }

  async approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null> {
    // The RPC locks the device row and creates the session in one transaction. A read followed
    // by separate writes can approve an already redeemed code or mint multiple sessions.
    const { data, error } = await this.db.rpc('approve_device_code', {
      p_user_code: userCode.toUpperCase(), p_user_id: userId, p_email: email ?? null,
    });
    if (error) throw new Error(`Could not approve device authorization: ${error.message}`);
    return typeof data === 'string' ? data : null;
  }

  async redeemDeviceCode(deviceCode: string): Promise<{ token: string } | 'pending' | 'unknown' | 'expired' | 'used'> {
    // One-time redemption is enforced by PostgreSQL, including concurrent pollers.
    const { data, error } = await this.db.rpc('redeem_device_code', { p_device_code: deviceCode }).single();
    if (error) throw new Error(`Could not redeem device authorization: ${error.message}`);
    const result = data as { redeemed_token: string | null; redemption_status: string };
    if (result.redemption_status === 'approved' && result.redeemed_token) return { token: result.redeemed_token };
    if (result.redemption_status === 'pending' || result.redemption_status === 'expired' || result.redemption_status === 'used') return result.redemption_status;
    return 'unknown';
  }

  async userForToken(token: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('tokens')
      .select('user_id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(`Could not validate session: ${error.message}`);
    return (data?.user_id as string | undefined) ?? null;
  }

  async revokeToken(token: string): Promise<void> {
    const { error } = await this.db.from('tokens').delete().eq('token', token);
    if (error) throw new Error(`Could not revoke session: ${error.message}`);
  }

  async signIn(email: string): Promise<Account> {
    const normalized = email.trim().toLowerCase();
    const { data: existing } = await this.db
      .from('users')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();
    let userId = existing?.id as string | undefined;
    if (!userId) {
      userId = randomUUID();
      await this.db.from('users').insert({ id: userId, email: normalized });
    }
    const token = randomUUID();
    await this.db.from('tokens').insert({ token, user_id: userId });
    return { token, userId, email: normalized };
  }

  async signUp(email: string): Promise<Account | null> {
    const normalized = email.trim().toLowerCase();
    const { data: existing } = await this.db
      .from('users')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();
    if (existing) return null;
    const userId = randomUUID();
    await this.db.from('users').insert({ id: userId, email: normalized });
    const token = randomUUID();
    await this.db.from('tokens').insert({ token, user_id: userId });
    return { token, userId, email: normalized };
  }

  async accountInfo(userId: string): Promise<{ userId: string; email?: string }> {
    const { data } = await this.db
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    return { userId, email: (data?.email as string | undefined) ?? undefined };
  }

  async userIdForEmail(email: string): Promise<string | null> {
    const normalized = email.trim().toLowerCase();
    const { data } = await this.db.from('users').select('id').eq('email', normalized).maybeSingle();
    return typeof data?.id === 'string' ? data.id : null;
  }

  async deleteAccount(userId: string): Promise<void> {
    // Order matters if FKs are enforced: children before the user row.
    await this.db.from('events').delete().eq('user_id', userId);
    await this.db.from('usage_counters').delete().eq('user_id', userId);
    await this.db.from('tokens').delete().eq('user_id', userId);
    await this.db.from('device_codes').delete().eq('user_id', userId);
    await this.db.from('consent_log').delete().eq('user_id', userId);
    await this.db.from('users').delete().eq('id', userId);
  }

  async upsertEvents(userId: string, events: IncomingEvent[], workspaceId?: string): Promise<void> {
    const rows = events.map((e) => ({
      id: e.id,
      user_id: userId,
      ts: e.ts,
      scope: e.scope,
      level: e.level,
      file: e.file ?? null,
      outcome: e.outcome,
      concept: e.concept ?? null,
      concept_label: e.conceptLabel ?? null,
      project: e.project ?? null,
      event_type: e.eventType ?? 'explanation_completed',
      local_date: e.localDate ?? null,
      timezone: e.timezone ?? null,
      lines: e.lines ?? null,
      language: e.language ?? null,
      source_app: e.sourceApp ?? null,
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    }));
    await this.db.from('events').upsert(rows, { onConflict: 'id' });
  }

  private mapEventRow(r: Record<string, unknown>): EventRecord {
    const userId = String(r.user_id);
    const authorEmail = typeof r.author_email === 'string'
      ? r.author_email
      : typeof r.email === 'string'
        ? r.email
        : undefined;
    return {
      id: String(r.id),
      userId,
      authorUserId: userId,
      authorEmail,
      workspaceId: typeof r.workspace_id === 'string' ? r.workspace_id : undefined,
      ts: String(r.ts),
      scope: String(r.scope),
      level: String(r.level),
      file: typeof r.file === 'string' ? r.file : undefined,
      outcome: r.outcome as EventRecord['outcome'],
      concept: typeof r.concept === 'string' ? r.concept : undefined,
      conceptLabel: typeof r.concept_label === 'string' ? r.concept_label : undefined,
      project: typeof r.project === 'string' ? r.project : undefined,
      localDate: typeof r.local_date === 'string' ? r.local_date : undefined,
      timezone: typeof r.timezone === 'string' ? r.timezone : undefined,
      lines: typeof r.lines === 'number' ? r.lines : undefined,
      language: typeof r.language === 'string' ? r.language : undefined,
      sourceApp: typeof r.source_app === 'string' ? r.source_app : undefined,
    };
  }

  private async eventsFor(userId: string): Promise<EventRecord[]> {
    const { data } = await this.db
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('ts', { ascending: true });
    return (data ?? []).map((r) => this.mapEventRow(r as Record<string, unknown>));
  }

  async profile(userId: string): Promise<ProfileSummary> {
    return computeProfile(await this.eventsFor(userId));
  }

  async history(userId: string, limit: number): Promise<EventRecord[]> {
    const events = await this.eventsFor(userId);
    return events.slice(-limit).reverse();
  }

  async historyPage(userId: string, limit: number, cursor?: string): Promise<import('./types').HistoryPage> {
    const offset = cursor ? Number.parseInt(cursor, 10) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid history cursor.');
    const events = await this.history(userId, Number.MAX_SAFE_INTEGER);
    const page = events.slice(offset, offset + limit);
    const nextOffset = offset + page.length;
    return { events: page, ...(nextOffset < events.length ? { nextCursor: String(nextOffset) } : {}) };
  }

  async projects(userId: string): Promise<ProjectSummary[]> {
    return computeProjects(await this.eventsFor(userId));
  }

  async workspaceHistoryPage(workspaceId: string, limit: number, cursor?: string): Promise<import('./types').HistoryPage> {
    const offset = cursor ? Number.parseInt(cursor, 10) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid history cursor.');
    const { data, error } = await this.db.rpc('workspace_history_page', {
      p_workspace_id: workspaceId,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw new Error(error.message || 'workspace history failed');
    const rows = Array.isArray(data) ? data : [];
    const events = rows.map((r) => this.mapEventRow(r as Record<string, unknown>));
    const nextOffset = offset + events.length;
    const hasMore = events.length === limit;
    return { events, ...(hasMore ? { nextCursor: String(nextOffset) } : {}) };
  }

  async workspaceProjects(workspaceId: string): Promise<ProjectSummary[]> {
    const { data, error } = await this.db
      .from('events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('ts', { ascending: true });
    if (error) throw new Error(error.message || 'workspace projects failed');
    return computeProjects((data ?? []).map((r) => this.mapEventRow(r as Record<string, unknown>)));
  }

  async usage(userId: string): Promise<UsageSummary> {
    const { data } = await this.db
      .from('usage_counters')
      .select('selections_used, asks_used')
      .eq('user_id', userId)
      .maybeSingle();
    return {
      selectionsUsed: (data?.selections_used as number | undefined) ?? 0,
      selectionsLimit: limitFor('selection'),
      asksUsed: (data?.asks_used as number | undefined) ?? 0,
      asksLimit: limitFor('ask'),
    };
  }

  async consumeUsage(userId: string, kind: 'selection' | 'ask'): Promise<UsageResult> {
    const limit = limitFor(kind);
    const { data, error } = await this.db
      .rpc('consume_usage', { p_user_id: userId, p_kind: kind, p_limit: limit })
      .maybeSingle();
    const row = data as { used: number; allowed: boolean } | null;
    if (error || !row) {
      // Fail open rather than blocking a review on a metering hiccup.
      console.warn('consume_usage rpc failed', error?.message);
      return { allowed: true, used: 0, limit };
    }
    return { allowed: Boolean(row.allowed), used: row.used ?? 0, limit };
  }
}
