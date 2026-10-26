import { randomUUID } from 'node:crypto';
import { canManageBilling, canManageMembers, CHECKOUT_INTENT_TTL_MS, effectivePlan, minimumSeatsForUsage, monthWindow, planLimit, USAGE_TOKEN_WINDOW_MS } from './plans';
import { CheckoutPendingError } from './checkoutPending';
import { MAX_TEAM_WORKSPACES_PER_OWNER, TeamWorkspaceLimitError } from './teamWorkspaceLimit';
import type { TokenUsage } from '@/ai/provider';
import type {
  BillingOverview,
  BillingStore,
  CheckoutIntentRecord,
  SubscriptionRecord,
  SubscriptionSyncInput,
  UsageKind,
  UsageReservation,
  WebhookClaim,
  WorkspaceAccess,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceRole,
} from './types';

/** Mirrors a usage_events row (SQL table of the same name). */
export interface MemoryUsageEvent {
  id: number;
  workspaceId: string;
  userId: string;
  kind: UsageKind;
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
  /** True when the counts are a chars/4 estimate rather than provider-reported (column tokens_estimated). */
  tokensEstimated: boolean;
  createdAt: number;
}

interface MemoryBillingData {
  workspaces: Map<string, Omit<WorkspaceAccess, 'role'>>;
  memberships: Map<string, WorkspaceRole>;
  subscriptions: Map<string, SubscriptionRecord>;
  usage: Map<string, number>;
  invitations: Map<string, WorkspaceInvitation & { tokenHash: string }>;
  checkoutIntents: Map<string, CheckoutIntentRecord>;
  webhooks: Map<string, { status: 'processing' | 'completed' | 'failed'; claimedAt: number }>;
  audits: Array<{ userId: string | null; workspaceId: string | null; action: string; metadata: Record<string, unknown>; at: string }>;
  usageEvents: MemoryUsageEvent[];
}

function membershipKey(workspaceId: string, userId: string): string {
  return `${workspaceId}:${userId}`;
}

function usageKey(workspaceId: string, kind: UsageKind, startsAt: string): string {
  return `${workspaceId}:${kind}:${startsAt}`;
}

/** A webhook claim is a lease; must match the 5 minutes in claim_billing_webhook (SQL). */
const WEBHOOK_LEASE_MS = 5 * 60_000;

function defaultSubscription(workspaceId: string): SubscriptionRecord {
  return {
    workspaceId,
    plan: 'free',
    interval: null,
    status: 'inactive',
    seats: 1,
    cancelAtPeriodEnd: false,
  };
}

export class MemoryBillingStore implements BillingStore {
  readonly kind = 'memory billing (dev)';
  private readonly data: MemoryBillingData;
  private readonly now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
    const global = globalThis as unknown as { __uncodeBillingData?: MemoryBillingData };
    global.__uncodeBillingData ??= {
      workspaces: new Map(),
      memberships: new Map(),
      subscriptions: new Map(),
      usage: new Map(),
      invitations: new Map(),
      checkoutIntents: new Map(),
      webhooks: new Map(),
      audits: [],
      usageEvents: [],
    };
    this.data = global.__uncodeBillingData;
  }

  async ensurePersonalWorkspace(userId: string): Promise<WorkspaceAccess> {
    const existing = [...this.data.workspaces.values()].find((workspace) => workspace.type === 'personal' && workspace.ownerUserId === userId);
    if (existing) return { ...existing, role: 'owner' };
    const id = randomUUID();
    const workspace = { id, name: 'Personal', type: 'personal' as const, ownerUserId: userId };
    this.data.workspaces.set(id, workspace);
    this.data.memberships.set(membershipKey(id, userId), 'owner');
    this.data.subscriptions.set(id, defaultSubscription(id));
    return { ...workspace, role: 'owner' };
  }

  async listWorkspaces(userId: string): Promise<WorkspaceAccess[]> {
    await this.ensurePersonalWorkspace(userId);
    return [...this.data.workspaces.values()].flatMap((workspace) => {
      const role = this.data.memberships.get(membershipKey(workspace.id, userId));
      return role ? [{ ...workspace, role }] : [];
    });
  }

  async getWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAccess | null> {
    const workspace = this.data.workspaces.get(workspaceId);
    const role = this.data.memberships.get(membershipKey(workspaceId, userId));
    return workspace && role ? { ...workspace, role } : null;
  }

  private async requireAccess(userId: string, workspaceId?: string): Promise<WorkspaceAccess> {
    if (!workspaceId) return this.ensurePersonalWorkspace(userId);
    const access = await this.getWorkspaceAccess(userId, workspaceId);
    if (!access) throw new Error('Workspace not found or access denied.');
    return access;
  }

  async overview(userId: string, workspaceId?: string): Promise<BillingOverview> {
    const workspace = await this.requireAccess(userId, workspaceId);
    const subscription = this.data.subscriptions.get(workspace.id) ?? defaultSubscription(workspace.id);
    const plan = effectivePlan(
      subscription.plan,
      subscription.status,
      subscription.gracePeriodEndsAt,
      this.now(),
      subscription.currentPeriodEnd,
    );
    const { startsAt, resetsAt } = monthWindow(this.now());
    const occupiedSeats = [...this.data.memberships.keys()].filter((key) => key.startsWith(`${workspace.id}:`)).length;
    const pendingInvitations = [...this.data.invitations.values()].filter((invite) => invite.workspaceId === workspace.id && invite.status === 'pending' && new Date(invite.expiresAt) > this.now()).length;
    const kinds: UsageKind[] = ['ai_explanation', 'project_question', 'indexed_project', 'dictionary_item', 'saved_item'];
    return {
      workspace,
      subscription: { ...subscription, plan },
      usage: kinds.map((kind) => {
        const used = this.data.usage.get(usageKey(workspace.id, kind, startsAt)) ?? 0;
        const limit = planLimit(plan, kind, subscription.seats);
        return { kind, used, limit, remaining: Math.max(0, limit - used), resetsAt };
      }),
      occupiedSeats,
      pendingInvitations,
      minimumBillableSeats: workspace.type === 'team' ? minimumSeatsForUsage(occupiedSeats, pendingInvitations) : 1,
      canManageBilling: canManageBilling(workspace.role),
      canManageMembers: canManageMembers(workspace.role),
    };
  }

  async reserveUsage(userId: string, kind: UsageKind, workspaceId?: string): Promise<UsageReservation> {
    const overview = await this.overview(userId, workspaceId);
    const line = overview.usage.find((entry) => entry.kind === kind);
    if (!line) throw new Error('Unknown usage kind.');
    if (line.used >= line.limit) return { allowed: false, line, reason: 'limit_reached' };
    const { startsAt } = monthWindow(this.now());
    const key = usageKey(overview.workspace.id, kind, startsAt);
    this.data.usage.set(key, line.used + 1);
    const lastId = this.data.usageEvents.at(-1)?.id ?? 0;
    this.data.usageEvents.push({
      id: lastId + 1, workspaceId: overview.workspace.id, userId, kind,
      estimatedInputTokens: null, estimatedOutputTokens: null, tokensEstimated: false, createdAt: this.now().getTime(),
    });
    return { allowed: true, line: { ...line, used: line.used + 1, remaining: line.remaining - 1 } };
  }

  async recordUsageTokens(userId: string, kind: UsageKind, usage: TokenUsage): Promise<void> {
    const since = this.now().getTime() - USAGE_TOKEN_WINDOW_MS;
    const row = [...this.data.usageEvents].reverse().find((event) => event.userId === userId && event.kind === kind
      && event.estimatedInputTokens === null && event.createdAt >= since);
    if (!row) return;
    row.estimatedInputTokens = usage.inputTokens;
    row.estimatedOutputTokens = usage.outputTokens;
    row.tokensEstimated = usage.estimated === true;
  }

  /** This user's usage rows, oldest first (dev and tests; production reads usage_events in SQL). */
  usageEvents(userId: string): MemoryUsageEvent[] {
    return this.data.usageEvents.filter((event) => event.userId === userId).map((event) => ({ ...event }));
  }

  async releaseUsage(userId: string, kind: UsageKind, workspaceId?: string): Promise<void> {
    const workspace = await this.requireAccess(userId, workspaceId);
    const key = usageKey(workspace.id, kind, monthWindow(this.now()).startsAt);
    const used = this.data.usage.get(key) ?? 0;
    if (used > 0) this.data.usage.set(key, used - 1);
  }

  async createTeamWorkspace(userId: string, name: string): Promise<WorkspaceAccess> {
    const owned = [...this.data.workspaces.values()].filter((workspace) => workspace.type === 'team' && workspace.ownerUserId === userId).length;
    if (owned >= MAX_TEAM_WORKSPACES_PER_OWNER) throw new TeamWorkspaceLimitError();
    const id = randomUUID();
    const workspace = { id, name: name.trim(), type: 'team' as const, ownerUserId: userId };
    this.data.workspaces.set(id, workspace);
    this.data.memberships.set(membershipKey(id, userId), 'owner');
    this.data.subscriptions.set(id, { ...defaultSubscription(id), seats: 2 });
    return { ...workspace, role: 'owner' };
  }

  async listMembers(userId: string, workspaceId: string): Promise<WorkspaceMember[]> {
    const access = await this.requireAccess(userId, workspaceId);
    if (!access) throw new Error('Workspace not found or access denied.');
    return [...this.data.memberships.entries()].flatMap(([key, role]) => {
      const [candidateWorkspaceId, memberUserId] = key.split(':');
      return candidateWorkspaceId === workspaceId ? [{ userId: memberUserId, role, joinedAt: this.now().toISOString() }] : [];
    });
  }

  async changeMemberRole(userId: string, workspaceId: string, memberUserId: string, role: 'admin' | 'member'): Promise<void> {
    const access = await this.requireAccess(userId, workspaceId);
    if (access.role !== 'owner') throw new Error('Only the owner can change member roles.');
    const key = membershipKey(workspaceId, memberUserId);
    const current = this.data.memberships.get(key);
    if (!current || current === 'owner') throw new Error('Member not found or cannot be changed.');
    this.data.memberships.set(key, role);
  }

  async removeMember(userId: string, workspaceId: string, memberUserId: string): Promise<void> {
    const access = await this.requireAccess(userId, workspaceId);
    if (access.role !== 'owner' && userId !== memberUserId) throw new Error('Only the owner can remove another member.');
    const key = membershipKey(workspaceId, memberUserId);
    const current = this.data.memberships.get(key);
    if (!current || current === 'owner') throw new Error('Member not found or cannot be removed.');
    this.data.memberships.delete(key);
  }

  async listInvitations(userId: string, workspaceId: string): Promise<WorkspaceInvitation[]> {
    const access = await this.requireAccess(userId, workspaceId);
    if (!canManageMembers(access.role)) throw new Error('Only owners and admins can view invitations.');
    return [...this.data.invitations.values()].filter((invite) => invite.workspaceId === workspaceId).map(({ tokenHash: _tokenHash, ...invite }) => invite);
  }

  async createInvitation(userId: string, workspaceId: string, email: string, role: Exclude<WorkspaceRole, 'owner'>, tokenHash: string, expiresAt: string): Promise<WorkspaceInvitation> {
    const access = await this.requireAccess(userId, workspaceId);
    if (!canManageMembers(access.role) || access.type !== 'team') throw new Error('Only team owners and admins can invite members.');
    const overview = await this.overview(userId, workspaceId);
    if (access.type === 'team' && overview.occupiedSeats + overview.pendingInvitations >= overview.subscription.seats) {
      throw new Error('Add a paid seat before sending another invitation.');
    }
    const invitation: WorkspaceInvitation & { tokenHash: string } = {
      id: randomUUID(), workspaceId, email: email.trim().toLowerCase(), role, tokenHash,
      status: 'pending', expiresAt, createdAt: this.now().toISOString(),
    };
    this.data.invitations.set(invitation.id, invitation);
    const { tokenHash: _tokenHash, ...publicInvitation } = invitation;
    return publicInvitation;
  }

  async revokeInvitation(userId: string, workspaceId: string, invitationId: string): Promise<void> {
    const access = await this.requireAccess(userId, workspaceId);
    if (!canManageMembers(access.role)) throw new Error('Only owners and admins can revoke invitations.');
    const invitation = this.data.invitations.get(invitationId);
    if (!invitation || invitation.workspaceId !== workspaceId) throw new Error('Invitation not found.');
    invitation.status = 'revoked';
  }

  async acceptInvitation(userId: string, tokenHash: string, userEmail?: string): Promise<WorkspaceAccess> {
    const invitation = [...this.data.invitations.values()].find((entry) => entry.tokenHash === tokenHash);
    if (!invitation || invitation.status !== 'pending' || new Date(invitation.expiresAt) <= this.now()) throw new Error('Invitation is invalid or expired.');
    if (!userEmail || userEmail.trim().toLowerCase() !== invitation.email) throw new Error('Sign in with the invited email address.');
    const workspace = this.data.workspaces.get(invitation.workspaceId);
    if (!workspace) throw new Error('Workspace not found.');
    this.data.memberships.set(membershipKey(workspace.id, userId), invitation.role);
    invitation.status = 'accepted';
    return { ...workspace, role: invitation.role };
  }

  async createCheckoutIntent(input: Omit<CheckoutIntentRecord, 'id' | 'status' | 'createdAt'>): Promise<CheckoutIntentRecord> {
    // Mirrors the unique indexes on checkout_intents: one pending intent per workspace, and one
    // pending Teams intent per owner. Stale intents are expired first, as in the Supabase store.
    const cutoff = this.now().getTime() - CHECKOUT_INTENT_TTL_MS;
    for (const other of this.data.checkoutIntents.values()) {
      if (other.userId === input.userId && other.status === 'pending' && new Date(other.createdAt).getTime() <= cutoff) other.status = 'expired';
    }
    const clash = [...this.data.checkoutIntents.values()].some((other) => other.status === 'pending'
      && (other.workspaceId === input.workspaceId || (input.plan === 'teams' && other.plan === 'teams' && other.userId === input.userId)));
    if (clash) throw new CheckoutPendingError();
    const intent: CheckoutIntentRecord = { ...input, id: randomUUID(), status: 'pending', createdAt: this.now().toISOString() };
    this.data.checkoutIntents.set(intent.id, intent);
    return intent;
  }

  async pendingCheckout(userId: string, workspaceId: string): Promise<CheckoutIntentRecord | null> {
    const cutoff = this.now().getTime() - CHECKOUT_INTENT_TTL_MS;
    for (const intent of this.data.checkoutIntents.values()) {
      if (intent.userId === userId && intent.workspaceId === workspaceId && intent.status === 'pending' && new Date(intent.createdAt).getTime() <= cutoff) intent.status = 'expired';
    }
    return [...this.data.checkoutIntents.values()].find((intent) => intent.userId === userId && intent.workspaceId === workspaceId && intent.status === 'pending' && new Date(intent.createdAt).getTime() > cutoff) ?? null;
  }

  async attachCheckoutSession(intentId: string, stripeCheckoutSessionId: string): Promise<void> {
    const intent = this.data.checkoutIntents.get(intentId);
    if (!intent) throw new Error('Checkout intent not found.');
    intent.stripeCheckoutSessionId = stripeCheckoutSessionId;
  }

  async expireCheckoutIntent(intentId: string): Promise<void> { const intent = this.data.checkoutIntents.get(intentId); if (intent) intent.status = 'expired'; }

  async completeCheckoutIntent(stripeCheckoutSessionId: string): Promise<CheckoutIntentRecord | null> {
    const intent = await this.findCheckoutIntent(stripeCheckoutSessionId);
    if (intent) intent.status = 'completed';
    return intent;
  }

  async findCheckoutIntent(stripeCheckoutSessionId: string): Promise<CheckoutIntentRecord | null> {
    return [...this.data.checkoutIntents.values()].find((intent) => intent.stripeCheckoutSessionId === stripeCheckoutSessionId) ?? null;
  }

  async syncSubscription(input: SubscriptionSyncInput): Promise<void> {
    this.data.subscriptions.set(input.workspaceId, { ...input });
  }

  async markSubscriptionCanceled(stripeSubscriptionId: string): Promise<void> {
    const subscription = await this.subscriptionByProviderId(stripeSubscriptionId);
    if (subscription) this.data.subscriptions.set(subscription.workspaceId, { ...subscription, status: 'canceled' });
  }

  async subscriptionByProviderId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null> {
    return [...this.data.subscriptions.values()].find((subscription) => subscription.stripeSubscriptionId === stripeSubscriptionId) ?? null;
  }

  async subscriptionByWorkspaceId(workspaceId: string): Promise<SubscriptionRecord | null> {
    return this.data.subscriptions.get(workspaceId) ?? null;
  }

  async subscriptionByCustomerId(stripeCustomerId: string): Promise<SubscriptionRecord | null> {
    return [...this.data.subscriptions.values()].find((subscription) => subscription.stripeCustomerId === stripeCustomerId) ?? null;
  }

  async changeSeatQuantity(userId: string, workspaceId: string, seats: number): Promise<BillingOverview> {
    const overview = await this.overview(userId, workspaceId);
    if (!overview.canManageBilling) throw new Error('Only the workspace owner can change seats.');
    if (seats < overview.minimumBillableSeats) throw new Error(`This workspace needs at least ${overview.minimumBillableSeats} seats.`);
    this.data.subscriptions.set(workspaceId, { ...overview.subscription, seats });
    return this.overview(userId, workspaceId);
  }

  async claimWebhook(eventId: string, _eventType: string): Promise<WebhookClaim> {
    const prior = this.data.webhooks.get(eventId);
    const now = this.now().getTime();
    if (prior?.status === 'completed') return 'completed';
    if (prior?.status === 'processing' && now - prior.claimedAt <= WEBHOOK_LEASE_MS) return 'in_progress';
    this.data.webhooks.set(eventId, { status: 'processing', claimedAt: now });
    return 'claimed';
  }

  async completeWebhook(eventId: string): Promise<void> {
    this.data.webhooks.set(eventId, { status: 'completed', claimedAt: this.data.webhooks.get(eventId)?.claimedAt ?? this.now().getTime() });
  }

  async failWebhook(eventId: string, _message: string): Promise<void> {
    this.data.webhooks.set(eventId, { status: 'failed', claimedAt: this.data.webhooks.get(eventId)?.claimedAt ?? this.now().getTime() });
  }

  async recordAudit(userId: string | null, workspaceId: string | null, action: string, metadata: Record<string, unknown> = {}): Promise<void> {
    this.data.audits.push({ userId, workspaceId, action, metadata, at: this.now().toISOString() });
  }

  async deleteUserBilling(userId: string): Promise<void> {
    // usage_events rows cascade with the user in SQL.
    this.data.usageEvents = this.data.usageEvents.filter((event) => event.userId !== userId);
    for (const [key] of [...this.data.memberships]) if (key.endsWith(`:${userId}`)) this.data.memberships.delete(key);
    for (const [id, workspace] of [...this.data.workspaces]) {
      if (workspace.ownerUserId === userId) {
        this.data.workspaces.delete(id);
        this.data.subscriptions.delete(id);
        for (const [key] of [...this.data.usage]) if (key.startsWith(`${id}:`)) this.data.usage.delete(key);
        for (const [inviteId, invite] of [...this.data.invitations]) if (invite.workspaceId === id) this.data.invitations.delete(inviteId);
      }
    }
  }

  /**
   * Dev mirror of the SQL `add_pro_months`: complimentary Pro months that stack on a running
   * gift month, end at most 12 months from now, and never touch a live Stripe subscription.
   */
  async addProMonths(userId: string, months: number): Promise<{ applied: boolean }> {
    if (!Number.isInteger(months) || months <= 0) return { applied: false };
    const workspace = await this.ensurePersonalWorkspace(userId);
    const current = this.data.subscriptions.get(workspace.id) ?? defaultSubscription(workspace.id);
    if (current.stripeSubscriptionId && current.status !== 'canceled' && current.status !== 'inactive') {
      return { applied: false };
    }
    const now = this.now();
    const runningEnd = current.currentPeriodEnd ? new Date(current.currentPeriodEnd) : null;
    const from = current.plan === 'pro' && current.status === 'trialing' && runningEnd && runningEnd > now ? runningEnd : now;
    const cap = new Date(now);
    cap.setUTCMonth(cap.getUTCMonth() + 12);
    const stacked = new Date(from.getTime() + months * 30 * 24 * 60 * 60 * 1000);
    this.data.subscriptions.set(workspace.id, {
      ...current,
      plan: 'pro',
      interval: 'monthly',
      status: 'trialing',
      seats: 1,
      currentPeriodStart: from > now ? current.currentPeriodStart ?? now.toISOString() : now.toISOString(),
      currentPeriodEnd: (stacked < cap ? stacked : cap).toISOString(),
    });
    return { applied: true };
  }

  /**
   * Dev mirror of the take-back in the SQL `revoke_promo_code`. A redemption occupies
   * [periodEndAfter - grantedMs, periodEndAfter] (grants stack); only the part still ahead of now
   * comes off running complimentary Pro (never before now). A live Stripe subscription is never
   * touched (`paidUntouched`). `moved` says whether the end date changed; `proUntil` is the end after.
   */
  async takeBackProTime(userId: string, grantedMs: number, periodEndAfter: string): Promise<{ paidUntouched: boolean; moved: boolean; proUntil: string | null }> {
    const workspace = [...this.data.workspaces.values()].find((item) => item.type === 'personal' && item.ownerUserId === userId);
    const current = workspace ? this.data.subscriptions.get(workspace.id) : undefined;
    if (!workspace || !current) return { paidUntouched: false, moved: false, proUntil: null };
    if (current.stripeSubscriptionId && current.status !== 'canceled' && current.status !== 'inactive') {
      return { paidUntouched: true, moved: false, proUntil: null };
    }
    const now = this.now();
    const remainingMs = Math.max(0, Math.min(grantedMs, new Date(periodEndAfter).getTime() - now.getTime()));
    const end = current.currentPeriodEnd ? new Date(current.currentPeriodEnd) : null;
    if (remainingMs === 0 || current.plan !== 'pro' || current.status !== 'trialing' || !end || end <= now) {
      return { paidUntouched: false, moved: false, proUntil: current.currentPeriodEnd ?? null };
    }
    const earlier = new Date(end.getTime() - remainingMs);
    const proUntil = (earlier > now ? earlier : now).toISOString();
    this.data.subscriptions.set(workspace.id, { ...current, currentPeriodEnd: proUntil });
    return { paidUntouched: false, moved: proUntil !== end.toISOString(), proUntil };
  }
}
