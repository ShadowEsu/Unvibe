import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Account,
  DeviceCode,
  EventRecord,
  HistoryPage,
  IncomingEvent,
  ProfileSummary,
  ProjectSummary,
  SkillRecord,
  Store,
} from './types';
import { computeProfile, computeProjects } from './progress';
import { decodeHistoryCursor, nextHistoryCursor } from './pagination';

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

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  private requireSuccess(error: { message: string } | null, operation: string): void {
    if (error) {
      throw new Error(`Persistent storage ${operation} failed: ${error.message}`);
    }
  }

  async createDeviceCode(baseUrl: string): Promise<DeviceCode> {
    const deviceCode = randomUUID();
    const userCode = randomUUID().slice(0, 8).toUpperCase();
    const { error } = await this.db.from('device_codes').insert({ device_code: deviceCode, user_code: userCode });
    this.requireSuccess(error, 'create device code');
    return { deviceCode, userCode, verificationUri: `${baseUrl}/activate`, interval: 2 };
  }

  async approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null> {
    const { data, error } = await this.db.rpc('approve_device_code', {
      p_user_code: userCode.toUpperCase(),
      p_user_id: userId,
      p_email: email ?? null,
    });
    this.requireSuccess(error, 'approve device code');
    return typeof data === 'string' ? data : null;
  }

  async redeemDeviceCode(deviceCode: string): Promise<{ token: string } | 'pending' | 'unknown' | 'expired' | 'used'> {
    const { data, error } = await this.db.rpc('redeem_device_code', { p_device_code: deviceCode });
    this.requireSuccess(error, 'redeem device code');
    const row = Array.isArray(data) ? data[0] as { redeemed_token?: unknown; redemption_status?: unknown } | undefined : undefined;
    const status = row?.redemption_status;
    if (status === 'approved' && typeof row?.redeemed_token === 'string') return { token: row.redeemed_token };
    return status === 'pending' || status === 'expired' || status === 'used' ? status : 'unknown';
  }

  async userForToken(token: string): Promise<string | null> {
    const { data, error } = await this.db
      .from('tokens')
      .select('user_id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    this.requireSuccess(error, 'resolve session');
    return (data?.user_id as string | undefined) ?? null;
  }

  async revokeToken(token: string): Promise<void> {
    const { error } = await this.db.from('tokens').delete().eq('token', token);
    this.requireSuccess(error, 'revoke session');
  }

  async signIn(email: string): Promise<Account> {
    const normalized = email.trim().toLowerCase();
    const { data: existing, error: lookupError } = await this.db
      .from('users')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();
    this.requireSuccess(lookupError, 'look up account');
    let userId = existing?.id as string | undefined;
    if (!userId) {
      userId = randomUUID();
      const { error } = await this.db.from('users').insert({ id: userId, email: normalized });
      this.requireSuccess(error, 'create account');
    }
    const token = randomUUID();
    const { error: tokenError } = await this.db.from('tokens').insert({ token, user_id: userId });
    this.requireSuccess(tokenError, 'create session');
    return { token, userId, email: normalized };
  }

  async signUp(email: string): Promise<Account | null> {
    const normalized = email.trim().toLowerCase();
    const { data: existing, error: lookupError } = await this.db
      .from('users')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();
    this.requireSuccess(lookupError, 'look up account');
    if (existing) return null;
    const userId = randomUUID();
    const { error: userError } = await this.db.from('users').insert({ id: userId, email: normalized });
    this.requireSuccess(userError, 'create account');
    const token = randomUUID();
    const { error: tokenError } = await this.db.from('tokens').insert({ token, user_id: userId });
    this.requireSuccess(tokenError, 'create session');
    return { token, userId, email: normalized };
  }

  async accountInfo(userId: string): Promise<{ userId: string; email?: string }> {
    const { data, error } = await this.db
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    this.requireSuccess(error, 'load account');
    return { userId, email: (data?.email as string | undefined) ?? undefined };
  }

  async deleteAccount(userId: string): Promise<void> {
    // Order matters if FKs are enforced: children before the user row.
    const deletions = [
      ['delete events', await this.db.from('events').delete().eq('user_id', userId)],
      ['delete sessions', await this.db.from('tokens').delete().eq('user_id', userId)],
      ['delete device codes', await this.db.from('device_codes').delete().eq('user_id', userId)],
      ['delete consent log', await this.db.from('consent_log').delete().eq('user_id', userId)],
      ['delete user', await this.db.from('users').delete().eq('id', userId)],
    ] as const;
    for (const [operation, result] of deletions) {
      this.requireSuccess(result.error, operation);
    }
  }

  async upsertEvents(userId: string, events: IncomingEvent[]): Promise<void> {
    const rows = events.map((e) => ({
      id: e.id,
      user_id: userId,
      ts: e.ts,
      event_type: e.eventType ?? 'explanation_completed',
      local_date: e.localDate ?? e.ts.slice(0, 10),
      timezone: e.timezone ?? 'UTC',
      scope: e.scope,
      level: e.level,
      file: e.file ?? null,
      outcome: e.outcome,
      concept: e.concept ?? null,
      concept_label: e.conceptLabel ?? null,
      project: e.project ?? null,
      lines: e.lines ?? 0,
      language: e.language ?? null,
      source_app: e.sourceApp ?? null,
    }));
    const { error } = await this.db.from('events').upsert(rows, { onConflict: 'id' });
    this.requireSuccess(error, 'upsert events');
    const { error: skillsError } = await this.db.rpc('rebuild_user_skills', { p_user_id: userId });
    this.requireSuccess(skillsError, 'rebuild skills');
  }

  private mapEvent(r: Record<string, unknown>): EventRecord {
    return {
      id: String(r.id),
      userId: String(r.user_id),
      ts: String(r.ts),
      eventType: 'explanation_completed',
      localDate: typeof r.local_date === 'string' ? r.local_date : undefined,
      timezone: typeof r.timezone === 'string' ? r.timezone : undefined,
      scope: String(r.scope),
      level: String(r.level),
      file: typeof r.file === 'string' ? r.file : undefined,
      outcome: r.outcome as EventRecord['outcome'],
      concept: typeof r.concept === 'string' ? r.concept : undefined,
      conceptLabel: typeof r.concept_label === 'string' ? r.concept_label : undefined,
      project: typeof r.project === 'string' ? r.project : undefined,
      lines: typeof r.lines === 'number' ? r.lines : 0,
      language: typeof r.language === 'string' ? r.language : undefined,
      sourceApp: typeof r.source_app === 'string' ? r.source_app : undefined,
    };
  }

  private async eventsFor(userId: string): Promise<EventRecord[]> {
    const { data, error } = await this.db
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('ts', { ascending: true });
    this.requireSuccess(error, 'load events');
    return (data ?? []).map((r) => this.mapEvent(r as Record<string, unknown>));
  }

  async profile(userId: string): Promise<ProfileSummary> {
    return computeProfile(await this.eventsFor(userId));
  }

  async history(userId: string, limit: number): Promise<EventRecord[]> {
    return (await this.historyPage(userId, limit)).events;
  }

  async historyPage(userId: string, limit: number, cursor?: string): Promise<HistoryPage> {
    const decoded = decodeHistoryCursor(cursor);
    if (cursor && !decoded) throw new Error('Invalid history cursor.');
    const { data, error } = await this.db.rpc('history_page', {
      p_user_id: userId,
      p_limit: limit,
      p_cursor_ts: decoded?.ts ?? null,
      p_cursor_id: decoded?.id ?? null,
    });
    this.requireSuccess(error, 'load history page');
    const events = (Array.isArray(data) ? data : []).map((row) => this.mapEvent(row as Record<string, unknown>));
    return { events, nextCursor: nextHistoryCursor(events, limit) };
  }

  async projects(userId: string): Promise<ProjectSummary[]> {
    return computeProjects(await this.eventsFor(userId));
  }

  async skills(userId: string): Promise<SkillRecord[]> {
    const { data, error } = await this.db.from('skills').select('*').eq('user_id', userId).order('last_encountered_at', { ascending: false });
    this.requireSuccess(error, 'load skills');
    return (data ?? []).map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      normalizedName: String(row.normalized_name),
      displayName: String(row.display_name),
      category: row.category ?? undefined,
      language: row.language ?? undefined,
      framework: row.framework ?? undefined,
      firstEncounteredAt: String(row.first_encountered_at),
      lastEncounteredAt: String(row.last_encountered_at),
      lastReviewedAt: String(row.last_reviewed_at),
      encounterCount: Number(row.encounter_count),
      reviewCount: Number(row.review_count),
      successfulChecks: Number(row.successful_checks),
      unsuccessfulChecks: Number(row.unsuccessful_checks),
      evidenceState: row.evidence_state as SkillRecord['evidenceState'],
      nextReviewDate: row.next_review_date ?? undefined,
      relatedProjects: Array.isArray(row.related_projects) ? row.related_projects : [],
      relatedEventIds: Array.isArray(row.related_event_ids) ? row.related_event_ids : [],
    }));
  }
}
