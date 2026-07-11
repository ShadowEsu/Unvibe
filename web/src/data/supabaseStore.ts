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

  async createDeviceCode(baseUrl: string): Promise<DeviceCode> {
    const deviceCode = randomUUID();
    const userCode = randomUUID().slice(0, 8).toUpperCase();
    await this.db.from('device_codes').insert({ device_code: deviceCode, user_code: userCode });
    return { deviceCode, userCode, verificationUri: `${baseUrl}/activate`, interval: 2 };
  }

  async approveDeviceCode(userCode: string, email?: string): Promise<string | null> {
    const { data: device } = await this.db
      .from('device_codes')
      .select('device_code, user_id')
      .eq('user_code', userCode.toUpperCase())
      .maybeSingle();
    if (!device) {
      return null;
    }
    let userId = device.user_id as string | null;
    if (!userId) {
      userId = randomUUID();
      await this.db.from('users').insert({ id: userId, email: email ?? null });
    }
    const token = randomUUID();
    await this.db.from('tokens').insert({ token, user_id: userId });
    await this.db
      .from('device_codes')
      .update({ user_id: userId, token })
      .eq('device_code', device.device_code);
    return token;
  }

  async redeemDeviceCode(deviceCode: string): Promise<{ token: string } | 'pending' | 'unknown'> {
    const { data } = await this.db
      .from('device_codes')
      .select('token')
      .eq('device_code', deviceCode)
      .maybeSingle();
    if (!data) {
      return 'unknown';
    }
    return data.token ? { token: data.token as string } : 'pending';
  }

  async userForToken(token: string): Promise<string | null> {
    const { data } = await this.db
      .from('tokens')
      .select('user_id')
      .eq('token', token)
      .maybeSingle();
    return (data?.user_id as string | undefined) ?? null;
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

  async accountInfo(userId: string): Promise<{ userId: string; email?: string }> {
    const { data } = await this.db
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    return { userId, email: (data?.email as string | undefined) ?? undefined };
  }

  async deleteAccount(userId: string): Promise<void> {
    // Order matters if FKs are enforced: children before the user row.
    await this.db.from('events').delete().eq('user_id', userId);
    await this.db.from('tokens').delete().eq('user_id', userId);
    await this.db.from('device_codes').delete().eq('user_id', userId);
    await this.db.from('consent_log').delete().eq('user_id', userId);
    await this.db.from('users').delete().eq('id', userId);
  }

  async upsertEvents(userId: string, events: IncomingEvent[]): Promise<void> {
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
    }));
    await this.db.from('events').upsert(rows, { onConflict: 'id' });
  }

  private async eventsFor(userId: string): Promise<EventRecord[]> {
    const { data } = await this.db
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('ts', { ascending: true });
    return (data ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      ts: r.ts,
      scope: r.scope,
      level: r.level,
      file: r.file ?? undefined,
      outcome: r.outcome,
      concept: r.concept ?? undefined,
      conceptLabel: r.concept_label ?? undefined,
      project: r.project ?? undefined,
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
