import { randomUUID } from 'node:crypto';
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
    const { data: device, error: lookupError } = await this.db
      .from('device_codes')
      .select('device_code, user_id')
      .eq('user_code', userCode.toUpperCase())
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    this.requireSuccess(lookupError, 'look up device code');
    if (!device) {
      return null;
    }
    const boundUserId = device.user_id as string | null;
    if (boundUserId && boundUserId !== userId) return null;
    const { error: userError } = await this.db
      .from('users')
      .upsert({ id: userId, email: email ?? null }, { onConflict: 'id' });
    this.requireSuccess(userError, 'upsert user');
    const token = randomUUID();
    const { error: tokenError } = await this.db.from('tokens').insert({ token, user_id: userId });
    this.requireSuccess(tokenError, 'create device session');
    const { error: deviceError } = await this.db
      .from('device_codes')
      .update({ user_id: userId, token, used_at: new Date().toISOString() })
      .eq('device_code', device.device_code);
    this.requireSuccess(deviceError, 'approve device code');
    return token;
  }

  async redeemDeviceCode(deviceCode: string): Promise<{ token: string } | 'pending' | 'unknown'> {
    const { data, error } = await this.db
      .from('device_codes')
      .select('token, expires_at')
      .eq('device_code', deviceCode)
      .maybeSingle();
    this.requireSuccess(error, 'redeem device code');
    if (!data) {
      return 'unknown';
    }
    if (new Date(data.expires_at as string).getTime() < Date.now()) return 'unknown';
    return data.token ? { token: data.token as string } : 'pending';
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
  }

  private async eventsFor(userId: string): Promise<EventRecord[]> {
    const { data, error } = await this.db
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('ts', { ascending: true });
    this.requireSuccess(error, 'load events');
    return (data ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      ts: r.ts,
      eventType: r.event_type ?? 'explanation_completed',
      localDate: r.local_date ?? undefined,
      timezone: r.timezone ?? undefined,
      scope: r.scope,
      level: r.level,
      file: r.file ?? undefined,
      outcome: r.outcome,
      concept: r.concept ?? undefined,
      conceptLabel: r.concept_label ?? undefined,
      project: r.project ?? undefined,
      lines: r.lines ?? 0,
      language: r.language ?? undefined,
      sourceApp: r.source_app ?? undefined,
    }));
  }

  async profile(userId: string): Promise<ProfileSummary> {
    return computeProfile(await this.eventsFor(userId));
  }

  async history(userId: string, limit: number): Promise<EventRecord[]> {
    const events = await this.eventsFor(userId);
    return events.slice(-limit).reverse();
  }

  async projects(userId: string): Promise<ProjectSummary[]> {
    return computeProjects(await this.eventsFor(userId));
  }
}
