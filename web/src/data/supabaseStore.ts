import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
import { planLimit, type PlanId, type UsageSummary } from '@/billing/plans';

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
    // 48 bits of entropy, formatted only for humans; the UUID device code remains private to the app.
    const userCode = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    const { error } = await this.db.from('device_codes').insert({ device_code: deviceCode, user_code: userCode });
    if (error) throw new Error('Could not create a secure device code. Please try again.');
    return { deviceCode, userCode, verificationUri: `${baseUrl}/activate`, interval: 2 };
  }

  async approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null> {
    await this.db.from('users').upsert({ id: userId, email: email ?? null }, { onConflict: 'id' });
    const token = randomUUID();
    const refreshToken = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const { error: tokenError } = await this.db.from('tokens').insert({
      token,
      refresh_token: refreshToken,
      user_id: userId,
      expires_at: expiresAt,
    });
    if (tokenError) throw new Error('Could not create a secure desktop session.');
    // Conditional update is the claim: only one authenticated user can approve this code.
    const { data: claimed, error: claimError } = await this.db
      .from('device_codes')
      .update({ user_id: userId, token, used_at: new Date().toISOString() })
      .eq('user_code', userCode.toUpperCase())
      .is('used_at', null)
      .is('redeemed_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('device_code');
    if (claimError || !claimed || claimed.length !== 1) {
      await this.db.from('tokens').delete().eq('token', token);
      return null;
    }
    return token;
  }

  async redeemDeviceCode(deviceCode: string): Promise<DeviceRedemption> {
    const { data: redeemed, error } = await this.db
      .from('device_codes')
      .update({ redeemed_at: new Date().toISOString() })
      .eq('device_code', deviceCode)
      .is('redeemed_at', null)
      .not('token', 'is', null)
      .gt('expires_at', new Date().toISOString())
      .select('token');
    if (error) throw new Error('Could not complete secure sign-in.');
    if (redeemed?.length === 1) {
      const token = redeemed[0].token as string;
      const { data: session, error: sessionError } = await this.db
        .from('tokens')
        .select('token, refresh_token, expires_at')
        .eq('token', token)
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (sessionError || !session) return 'unknown';
      return { token: session.token as string, refreshToken: session.refresh_token as string, expiresAt: session.expires_at as string };
    }
    const { data: pending } = await this.db
      .from('device_codes')
      .select('token, expires_at, redeemed_at')
      .eq('device_code', deviceCode)
      .maybeSingle();
    if (!pending || pending.redeemed_at || new Date(pending.expires_at as string).getTime() <= Date.now()) return 'unknown';
    return pending.token ? 'unknown' : 'pending';
  }

  async userForToken(token: string): Promise<string | null> {
    const { data } = await this.db
      .from('tokens')
      .select('user_id')
      .eq('token', token)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    return (data?.user_id as string | undefined) ?? null;
  }

  async refreshSession(refreshToken: string): Promise<{ token: string; refreshToken: string; expiresAt: string } | null> {
    const token = randomUUID();
    const nextRefresh = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    // Rotation is conditional on the exact old refresh token, so concurrent/replayed refreshes lose.
    const { data, error } = await this.db
      .from('tokens')
      .update({ token, refresh_token: nextRefresh, expires_at: expiresAt, refreshed_at: new Date().toISOString() })
      .eq('refresh_token', refreshToken)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('token');
    if (error || !data || data.length !== 1) return null;
    return { token, refreshToken: nextRefresh, expiresAt };
  }

  async revokeToken(token: string): Promise<void> {
    const { error } = await this.db
      .from('tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', token)
      .is('revoked_at', null);
    if (error) throw new Error('Could not end this session.');
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
    const refreshToken = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    await this.db.from('tokens').insert({ token, refresh_token: refreshToken, user_id: userId, expires_at: expiresAt });
    return { token, refreshToken, expiresAt, userId, email: normalized };
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
    const refreshToken = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    await this.db.from('tokens').insert({ token, refresh_token: refreshToken, expires_at: expiresAt, user_id: userId });
    return { token, refreshToken, expiresAt, userId, email: normalized };
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
    // The application profile is not the Supabase Auth identity. Remove both so an old browser
    // session cannot be used to approve another desktop device after deletion.
    const { error } = await this.db.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error('Cloud application data was removed, but identity removal did not complete. Contact support before recreating the account.');
    }
  }

  private periodStart(): string {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }

  private async activePlan(userId: string): Promise<PlanId> {
    const { data, error } = await this.db.from('subscriptions').select('plan_id').eq('user_id', userId).eq('status', 'active').maybeSingle();
    if (error) throw new Error('Could not load your plan.');
    return (data?.plan_id as PlanId | undefined) ?? 'private_beta';
  }

  async usage(userId: string): Promise<UsageSummary> {
    const periodStart = this.periodStart();
    const planId = await this.activePlan(userId);
    const { count, error } = await this.db.from('explanation_usage').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('period_start', periodStart);
    if (error) throw new Error('Could not load explanation usage.');
    const used = count ?? 0;
    const limit = planLimit(planId);
    return { planId, used, limit, remaining: limit === null ? null : Math.max(0, limit - used), periodStart };
  }

  async reserveExplanation(userId: string, requestId: string): Promise<UsageSummary | null> {
    const periodStart = this.periodStart();
    const planId = await this.activePlan(userId);
    const limit = planLimit(planId);
    const { data, error } = await this.db.rpc('reserve_explanation', {
      p_user_id: userId,
      p_request_id: requestId,
      p_period_start: periodStart,
      p_limit: limit,
    });
    if (error) throw new Error('Could not reserve an explanation. Please retry.');
    if (data !== true) return null;
    return this.usage(userId);
  }

  async releaseExplanation(userId: string, requestId: string): Promise<void> {
    const { error } = await this.db.from('explanation_usage').delete().eq('user_id', userId).eq('request_id', requestId);
    if (error) throw new Error('Could not release explanation usage.');
  }

  async upsertEvents(userId: string, events: IncomingEvent[]): Promise<void> {
    const rows = events.map((e) => ({
      id: e.id,
      user_id: userId,
      ts: e.ts,
      scope: e.scope,
      level: e.level,
      lines: e.lines ?? 0,
      language: e.language ?? null,
      source_app: e.sourceApp ?? null,
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
      lines: r.lines ?? 0,
      language: r.language ?? undefined,
      sourceApp: r.source_app ?? undefined,
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
