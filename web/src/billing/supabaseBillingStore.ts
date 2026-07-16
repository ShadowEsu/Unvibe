import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  BillingOverview,
  BillingStore,
  CheckoutIntentRecord,
  SubscriptionRecord,
  SubscriptionSyncInput,
  UsageKind,
  UsageReservation,
  WorkspaceAccess,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
} from './types';

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Persistent billing returned an invalid record.');
  return value as Record<string, unknown>;
}

export class SupabaseBillingStore implements BillingStore {
  readonly kind = 'supabase billing';
  private readonly db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  private require(error: { message: string } | null, operation: string): void {
    if (error) throw new Error(`Persistent billing ${operation} failed: ${error.message}`);
  }

  private mapAccess(row: Record<string, unknown>): WorkspaceAccess {
    return {
      id: String(row.id ?? row.workspace_id),
      name: String(row.name),
      type: row.type as WorkspaceAccess['type'],
      role: row.role as WorkspaceRole,
      ownerUserId: String(row.owner_user_id),
    };
  }

  private mapSubscription(row: Record<string, unknown>): SubscriptionRecord {
    return {
      workspaceId: String(row.workspace_id),
      plan: row.plan as SubscriptionRecord['plan'],
      interval: (row.interval as SubscriptionRecord['interval']) ?? null,
      status: row.status as SubscriptionRecord['status'],
      seats: Number(row.seats),
      stripeCustomerId: typeof row.stripe_customer_id === 'string' ? row.stripe_customer_id : undefined,
      stripeSubscriptionId: typeof row.stripe_subscription_id === 'string' ? row.stripe_subscription_id : undefined,
      stripePriceId: typeof row.stripe_price_id === 'string' ? row.stripe_price_id : undefined,
      currentPeriodStart: typeof row.current_period_start === 'string' ? row.current_period_start : undefined,
      currentPeriodEnd: typeof row.current_period_end === 'string' ? row.current_period_end : undefined,
      gracePeriodEndsAt: typeof row.grace_period_ends_at === 'string' ? row.grace_period_ends_at : undefined,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    };
  }

  private mapOverview(value: unknown): BillingOverview {
    const row = asObject(value);
    const workspace = asObject(row.workspace);
    const subscription = asObject(row.subscription);
    const usage = Array.isArray(row.usage) ? row.usage.map((item) => {
      const line = asObject(item);
      return {
        kind: line.kind as UsageKind,
        used: Number(line.used),
        limit: Number(line.limit),
        remaining: Number(line.remaining),
        resetsAt: String(line.resets_at),
      };
    }) : [];
    return {
      workspace: this.mapAccess(workspace),
      subscription: this.mapSubscription(subscription),
      usage,
      occupiedSeats: Number(row.occupied_seats),
      pendingInvitations: Number(row.pending_invitations),
      minimumBillableSeats: Number(row.minimum_billable_seats),
      canManageBilling: Boolean(row.can_manage_billing),
      canManageMembers: Boolean(row.can_manage_members),
    };
  }

  async ensurePersonalWorkspace(userId: string): Promise<WorkspaceAccess> {
    const { data, error } = await this.db.rpc('ensure_personal_workspace', { p_user_id: userId });
    this.require(error, 'ensure personal workspace');
    const access = await this.getWorkspaceAccess(userId, String(data));
    if (!access) throw new Error('Persistent billing did not return the personal workspace.');
    return access;
  }

  async listWorkspaces(userId: string): Promise<WorkspaceAccess[]> {
    await this.ensurePersonalWorkspace(userId);
    const { data, error } = await this.db.rpc('list_user_workspaces', { p_user_id: userId });
    this.require(error, 'list workspaces');
    return (Array.isArray(data) ? data : []).map((row) => this.mapAccess(asObject(row)));
  }

  async getWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAccess | null> {
    const { data, error } = await this.db.rpc('get_workspace_access', { p_user_id: userId, p_workspace_id: workspaceId });
    this.require(error, 'resolve workspace access');
    const row = Array.isArray(data) ? data[0] : null;
    return row ? this.mapAccess(asObject(row)) : null;
  }

  async overview(userId: string, workspaceId?: string): Promise<BillingOverview> {
    const { data, error } = await this.db.rpc('billing_overview', { p_user_id: userId, p_workspace_id: workspaceId ?? null });
    this.require(error, 'load overview');
    return this.mapOverview(data);
  }

  async reserveUsage(userId: string, kind: UsageKind, workspaceId?: string): Promise<UsageReservation> {
    const { data, error } = await this.db.rpc('reserve_billing_usage', { p_user_id: userId, p_kind: kind, p_workspace_id: workspaceId ?? null });
    this.require(error, 'reserve usage');
    const row = asObject(data);
    const line = asObject(row.line);
    return {
      allowed: Boolean(row.allowed),
      reason: row.reason === 'limit_reached' || row.reason === 'subscription_inactive' ? row.reason : undefined,
      line: {
        kind: line.kind as UsageKind,
        used: Number(line.used),
        limit: Number(line.limit),
        remaining: Number(line.remaining),
        resetsAt: String(line.resets_at),
      },
    };
  }

  async createTeamWorkspace(userId: string, name: string): Promise<WorkspaceAccess> {
    const { data, error } = await this.db.rpc('create_team_workspace', { p_user_id: userId, p_name: name.trim() });
    this.require(error, 'create team workspace');
    const access = await this.getWorkspaceAccess(userId, String(data));
    if (!access) throw new Error('Persistent billing did not return the team workspace.');
    return access;
  }

  async listMembers(userId: string, workspaceId: string): Promise<WorkspaceMember[]> {
    const { data, error } = await this.db.rpc('list_workspace_members', { p_user_id: userId, p_workspace_id: workspaceId });
    this.require(error, 'list members');
    return (Array.isArray(data) ? data : []).map((row) => {
      const value = asObject(row);
      return { userId: String(value.user_id), email: typeof value.email === 'string' ? value.email : undefined, role: value.role as WorkspaceRole, joinedAt: String(value.joined_at) };
    });
  }

  async changeMemberRole(userId: string, workspaceId: string, memberUserId: string, role: 'admin' | 'member'): Promise<void> {
    const { error } = await this.db.rpc('change_workspace_member_role', { p_user_id: userId, p_workspace_id: workspaceId, p_member_user_id: memberUserId, p_role: role });
    this.require(error, 'change member role');
  }

  async removeMember(userId: string, workspaceId: string, memberUserId: string): Promise<void> {
    const { error } = await this.db.rpc('remove_workspace_member', { p_user_id: userId, p_workspace_id: workspaceId, p_member_user_id: memberUserId });
    this.require(error, 'remove member');
  }

  async listInvitations(userId: string, workspaceId: string): Promise<WorkspaceInvitation[]> {
    const { data, error } = await this.db.rpc('list_workspace_invitations', { p_user_id: userId, p_workspace_id: workspaceId });
    this.require(error, 'list invitations');
    return (Array.isArray(data) ? data : []).map((row) => {
      const value = asObject(row);
      return {
        id: String(value.id), workspaceId: String(value.workspace_id), email: String(value.email),
        role: value.role as WorkspaceInvitation['role'], status: value.status as WorkspaceInvitation['status'],
        expiresAt: String(value.expires_at), createdAt: String(value.created_at),
      };
    });
  }

  async createInvitation(userId: string, workspaceId: string, email: string, role: Exclude<WorkspaceRole, 'owner'>, tokenHash: string, expiresAt: string): Promise<WorkspaceInvitation> {
    const { data, error } = await this.db.rpc('create_workspace_invitation', {
      p_user_id: userId, p_workspace_id: workspaceId, p_email: email, p_role: role, p_token_hash: tokenHash, p_expires_at: expiresAt,
    });
    this.require(error, 'create invitation');
    const row = asObject(data);
    return {
      id: String(row.id), workspaceId: String(row.workspace_id), email: String(row.email),
      role: row.role as WorkspaceInvitation['role'], status: row.status as WorkspaceInvitation['status'],
      expiresAt: String(row.expires_at), createdAt: String(row.created_at),
    };
  }

  async revokeInvitation(userId: string, workspaceId: string, invitationId: string): Promise<void> {
    const { error } = await this.db.rpc('revoke_workspace_invitation', { p_user_id: userId, p_workspace_id: workspaceId, p_invitation_id: invitationId });
    this.require(error, 'revoke invitation');
  }

  async acceptInvitation(userId: string, tokenHash: string, _userEmail?: string): Promise<WorkspaceAccess> {
    const { data, error } = await this.db.rpc('accept_workspace_invitation', { p_user_id: userId, p_token_hash: tokenHash });
    this.require(error, 'accept invitation');
    const access = await this.getWorkspaceAccess(userId, String(data));
    if (!access) throw new Error('Persistent billing did not return the accepted workspace.');
    return access;
  }

  async createCheckoutIntent(input: Omit<CheckoutIntentRecord, 'id' | 'status' | 'createdAt'>): Promise<CheckoutIntentRecord> {
    const { data, error } = await this.db.from('checkout_intents').insert({
      user_id: input.userId, workspace_id: input.workspaceId, plan: input.plan, interval: input.interval, seats: input.seats,
    }).select('*').single();
    this.require(error, 'create checkout intent');
    const row = asObject(data);
    return {
      id: String(row.id), userId: String(row.user_id), workspaceId: String(row.workspace_id), plan: row.plan as CheckoutIntentRecord['plan'],
      interval: row.interval as CheckoutIntentRecord['interval'], seats: Number(row.seats), status: row.status as CheckoutIntentRecord['status'],
      stripeCheckoutSessionId: typeof row.stripe_checkout_session_id === 'string' ? row.stripe_checkout_session_id : undefined,
      createdAt: String(row.created_at),
    };
  }

  async pendingCheckout(userId: string, workspaceId: string): Promise<CheckoutIntentRecord | null> {
    const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
    const { error: expiryError } = await this.db.from('checkout_intents').update({ status: 'expired' }).eq('user_id', userId).eq('workspace_id', workspaceId).eq('status', 'pending').lte('created_at', cutoff);
    this.require(expiryError, 'expire stale checkouts');
    const { data, error } = await this.db.from('checkout_intents').select('*').eq('user_id', userId).eq('workspace_id', workspaceId).eq('status', 'pending').gt('created_at', cutoff).order('created_at', { ascending: false }).limit(1).maybeSingle();
    this.require(error, 'find pending checkout');
    if (!data) return null;
    return {
      id: String(data.id), userId: String(data.user_id), workspaceId: String(data.workspace_id), plan: data.plan as CheckoutIntentRecord['plan'], interval: data.interval as CheckoutIntentRecord['interval'],
      seats: Number(data.seats), status: data.status as CheckoutIntentRecord['status'], stripeCheckoutSessionId: data.stripe_checkout_session_id ?? undefined, createdAt: String(data.created_at),
    };
  }

  async attachCheckoutSession(intentId: string, stripeCheckoutSessionId: string): Promise<void> {
    const { error } = await this.db.from('checkout_intents').update({ stripe_checkout_session_id: stripeCheckoutSessionId }).eq('id', intentId);
    this.require(error, 'attach checkout session');
  }

  async expireCheckoutIntent(intentId: string): Promise<void> {
    const { error } = await this.db.from('checkout_intents').update({ status: 'expired' }).eq('id', intentId).eq('status', 'pending');
    this.require(error, 'expire checkout intent');
  }

  async completeCheckoutIntent(stripeCheckoutSessionId: string): Promise<CheckoutIntentRecord | null> {
    const { error } = await this.db.from('checkout_intents').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('stripe_checkout_session_id', stripeCheckoutSessionId);
    this.require(error, 'complete checkout intent');
    return this.findCheckoutIntent(stripeCheckoutSessionId);
  }

  async findCheckoutIntent(stripeCheckoutSessionId: string): Promise<CheckoutIntentRecord | null> {
    const { data, error } = await this.db.from('checkout_intents').select('*').eq('stripe_checkout_session_id', stripeCheckoutSessionId).maybeSingle();
    this.require(error, 'find checkout intent');
    if (!data) return null;
    return {
      id: String(data.id), userId: String(data.user_id), workspaceId: String(data.workspace_id), plan: data.plan as CheckoutIntentRecord['plan'],
      interval: data.interval as CheckoutIntentRecord['interval'], seats: Number(data.seats), status: data.status as CheckoutIntentRecord['status'],
      stripeCheckoutSessionId: data.stripe_checkout_session_id ?? undefined, createdAt: String(data.created_at),
    };
  }

  async syncSubscription(input: SubscriptionSyncInput): Promise<void> {
    const { error } = await this.db.from('subscriptions').upsert({
      workspace_id: input.workspaceId, plan: input.plan, interval: input.interval, status: input.status, seats: input.seats,
      stripe_customer_id: input.stripeCustomerId, stripe_subscription_id: input.stripeSubscriptionId, stripe_price_id: input.stripePriceId,
      current_period_start: input.currentPeriodStart ?? null,
      current_period_end: input.currentPeriodEnd ?? null, grace_period_ends_at: input.gracePeriodEndsAt ?? null,
      cancel_at_period_end: input.cancelAtPeriodEnd, updated_at: new Date().toISOString(),
    }, { onConflict: 'workspace_id' });
    this.require(error, 'sync subscription');
  }

  async markSubscriptionCanceled(stripeSubscriptionId: string): Promise<void> {
    const { error } = await this.db.from('subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('stripe_subscription_id', stripeSubscriptionId);
    this.require(error, 'cancel subscription');
  }

  async subscriptionByProviderId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null> {
    const { data, error } = await this.db.from('subscriptions').select('*').eq('stripe_subscription_id', stripeSubscriptionId).maybeSingle();
    this.require(error, 'find subscription');
    return data ? this.mapSubscription(data as Record<string, unknown>) : null;
  }

  async changeSeatQuantity(userId: string, workspaceId: string, seats: number): Promise<BillingOverview> {
    const { error } = await this.db.rpc('change_workspace_seats', { p_user_id: userId, p_workspace_id: workspaceId, p_seats: seats });
    this.require(error, 'change seats');
    return this.overview(userId, workspaceId);
  }

  async claimWebhook(eventId: string, eventType: string): Promise<boolean> {
    const { data, error } = await this.db.rpc('claim_billing_webhook', { p_event_id: eventId, p_event_type: eventType });
    this.require(error, 'claim webhook');
    return Boolean(data);
  }

  async completeWebhook(eventId: string): Promise<void> {
    const { error } = await this.db.from('billing_webhook_events').update({ status: 'completed', processed_at: new Date().toISOString(), last_error: null }).eq('stripe_event_id', eventId);
    this.require(error, 'complete webhook');
  }

  async failWebhook(eventId: string, message: string): Promise<void> {
    const { error } = await this.db.from('billing_webhook_events').update({ status: 'failed', last_error: message.slice(0, 500) }).eq('stripe_event_id', eventId);
    this.require(error, 'fail webhook');
  }

  async recordAudit(userId: string | null, workspaceId: string | null, action: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const { error } = await this.db.from('billing_audit_log').insert({ user_id: userId, workspace_id: workspaceId, action, metadata });
    this.require(error, 'record audit');
  }

  async deleteUserBilling(userId: string): Promise<void> {
    const { error } = await this.db.rpc('delete_user_billing_data', { p_user_id: userId });
    this.require(error, 'delete user billing data');
  }
}
