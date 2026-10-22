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
} from './types';
import { computeProfile, computeProjects } from './progress';
import { EventOwnershipError } from './eventOwnership';

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
    // PostgreSQL functions declared as `returns table` are encoded by PostgREST as an
    // array, even when the function always returns exactly one row. Avoid `.single()`
    // here: it asks PostgREST to coerce the response to an object and turns a normal
    // pending authorization into a server error.
    const { data, error } = await this.db.rpc('redeem_device_code', { p_device_code: deviceCode });
    if (error) throw new Error(`Could not redeem device authorization: ${error.message}`);
    const result = (Array.isArray(data) ? data[0] : data) as
      | { redeemed_token: string | null; redemption_status: string }
      | null;
    if (!result) return 'unknown';
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

  async accountInfo(userId: string): Promise<{ userId: string; email?: string; name?: string }> {
    const { data } = await this.db
      .from('users')
      .select('email, settings')
      .eq('id', userId)
      .maybeSingle();
    const settings = (data?.settings ?? {}) as { providerName?: unknown };
    return {
      userId,
      email: (data?.email as string | undefined) ?? undefined,
      name: typeof settings.providerName === 'string' ? settings.providerName : undefined,
    };
  }

  async rememberName(userId: string, name: string): Promise<void> {
    const { data } = await this.db.from('users').select('settings').eq('id', userId).maybeSingle();
    const settings = { ...((data?.settings ?? {}) as Record<string, unknown>), providerName: name };
    const { error } = await this.db.from('users').update({ settings }).eq('id', userId);
    if (error) throw new Error(`Could not save profile name: ${error.message}`);
  }

  async userIdForEmail(email: string): Promise<string | null> {
    const normalized = email.trim().toLowerCase();
    const { data } = await this.db.from('users').select('id').eq('email', normalized).maybeSingle();
    return typeof data?.id === 'string' ? data.id : null;
  }

  async deleteAccount(userId: string): Promise<void> {
    // Order matters if FKs are enforced: children before the user row. Stop at the first failure
    // so the caller never reports a deletion that did not happen.
    const steps: Array<[table: string, column: string]> = [
      ['events', 'user_id'], ['usage_counters', 'user_id'], ['tokens', 'user_id'],
      ['device_codes', 'user_id'], ['consent_log', 'user_id'], ['users', 'id'],
    ];
    for (const [table, column] of steps) {
      const { error } = await this.db.from(table).delete().eq(column, userId);
      if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
    }
  }

  async upsertEvents(userId: string, events: IncomingEvent[], workspaceId?: string): Promise<void> {
    // events.id is a global primary key chosen by the client. Find which ids already exist so an id
    // owned by another account is refused (never re-assigned), and new ids are plain inserts: a
    // concurrent insert of the same id then fails on the key instead of overwriting.
    const owned = new Set<string>();
    const foreign: string[] = [];
    const ids = [...new Set(events.map((e) => e.id))];
    for (let start = 0; start < ids.length; start += 100) {
      const { data, error } = await this.db.from('events').select('id, user_id').in('id', ids.slice(start, start + 100));
      if (error) throw new Error(`Could not check event ownership: ${error.message}`);
      for (const row of data ?? []) {
        if (row.user_id === userId) owned.add(String(row.id));
        else foreign.push(String(row.id));
      }
    }
    if (foreign.length > 0) throw new EventOwnershipError(foreign);

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
    const updates = rows.filter((row) => owned.has(row.id));
    const inserts = rows.filter((row) => !owned.has(row.id));
    if (updates.length > 0) {
      const { error } = await this.db.from('events').upsert(updates, { onConflict: 'id' });
      if (error) throw new Error(`Could not save learning events: ${error.message}`);
    }
    if (inserts.length > 0) {
      const { error } = await this.db.from('events').insert(inserts);
      if (error) throw new Error(`Could not save learning events: ${error.message}`);
    }
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

  /**
   * Every matching event, oldest first. Supabase caps a response at 1,000 rows, so read in pages
   * ordered by (ts, id); a single unpaged select silently drops everything past the cap.
   */
  private async allEvents(column: 'user_id' | 'workspace_id', value: string): Promise<EventRecord[]> {
    const PAGE = 1000;
    const events: EventRecord[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.db
        .from('events')
        .select('*')
        .eq(column, value)
        .order('ts', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(`Could not load learning history: ${error.message}`);
      const rows = data ?? [];
      for (const row of rows) events.push(this.mapEventRow(row as Record<string, unknown>));
      if (rows.length < PAGE) return events;
    }
  }

  private eventsFor(userId: string): Promise<EventRecord[]> {
    return this.allEvents('user_id', userId);
  }

  async profile(userId: string): Promise<ProfileSummary> {
    return computeProfile(await this.eventsFor(userId));
  }

  async history(userId: string, limit: number): Promise<EventRecord[]> {
    return (await this.historyPage(userId, limit)).events;
  }

  /** One page, newest first, read straight from the database (one row past the page to know if more exist). */
  async historyPage(userId: string, limit: number, cursor?: string): Promise<import('./types').HistoryPage> {
    const offset = cursor ? Number.parseInt(cursor, 10) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw new Error('Invalid history cursor.');
    const { data, error } = await this.db
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('ts', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit);
    if (error) throw new Error(`Could not load learning history: ${error.message}`);
    const rows = data ?? [];
    const events = rows.slice(0, limit).map((row) => this.mapEventRow(row as Record<string, unknown>));
    return { events, ...(rows.length > limit ? { nextCursor: String(offset + limit) } : {}) };
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
    return computeProjects(await this.allEvents('workspace_id', workspaceId));
  }
}
