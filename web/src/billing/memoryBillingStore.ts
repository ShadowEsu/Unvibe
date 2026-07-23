import { randomUUID } from 'node:crypto';
import { canManageBilling, canManageMembers, effectivePlan, minimumSeatsForUsage, monthWindow, planLimit } from './plans';
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

interface MemoryBillingData {
  workspaces: Map<string, Omit<WorkspaceAccess, 'role'>>;
  memberships: Map<string, WorkspaceRole>;
  subscriptions: Map<string, SubscriptionRecord>;
  usage: Map<string, number>;
  invitations: Map<string, WorkspaceInvitation & { tokenHash: string }>;
  checkoutIntents: Map<string, CheckoutIntentRecord>;
  webhooks: Map<string, 'processing' | 'completed' | 'failed'>;
  audits: Array<{ userId: string | null; workspaceId: string | null; action: string; metadata: Record<string, unknown>; at: string }>;
}

function membershipKey(workspaceId: string, userId: string): string {
  return `${workspaceId}:${userId}`;
}

function usageKey(workspaceId: string, kind: UsageKind, startsAt: string): string {
  return `${workspaceId}:${kind}:${startsAt}`;
}

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
    const plan = effectivePlan(subscription.plan, subscription.status, subscription.gracePeriodEndsAt, this.now());
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
    return { allowed: true, line: { ...line, used: line.used + 1, remaining: line.remaining - 1 } };
  }

  async createTeamWorkspace(userId: string, name: string): Promise<WorkspaceAccess> {
    const id = randomUUID();
    const workspace = { id, name: name.trim(), type: 'team' as const, ownerUserId: userId };
    this.data.workspaces.set(id, workspace);
    this.data.memberships.set(membershipKey(id, userId), 'owner');
    this.data.subscriptions.set(id, { ...defaultSubscription(id), seats: 2 });
    return { ...workspace, role: 'owner' };
  }

  async listMembers(userId: string, workspaceId: string): Promise<WorkspaceMember[]> {
    const access = await this.requireAccess(userId, workspaceId);
    if (!canManageMembers(access.role)) throw new Error('Only owners and admins can view members.');
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
    if (overview.occupiedSeats + overview.pendingInvitations >= overview.subscription.seats && overview.subscription.plan === 'teams') {
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
    const intent: CheckoutIntentRecord = { ...input, id: randomUUID(), status: 'pending', createdAt: this.now().toISOString() };
    this.data.checkoutIntents.set(intent.id, intent);
    return intent;
  }

  async pendingCheckout(userId: string, workspaceId: string): Promise<CheckoutIntentRecord | null> {
    const cutoff = this.now().getTime() - 30 * 60_000;
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

  async changeSeatQuantity(userId: string, workspaceId: string, seats: number): Promise<BillingOverview> {
    const overview = await this.overview(userId, workspaceId);
    if (!overview.canManageBilling) throw new Error('Only the workspace owner can change seats.');
    if (seats < overview.minimumBillableSeats) throw new Error(`This workspace needs at least ${overview.minimumBillableSeats} seats.`);
    this.data.subscriptions.set(workspaceId, { ...overview.subscription, seats });
    return this.overview(userId, workspaceId);
  }

  async claimWebhook(eventId: string, _eventType: string): Promise<boolean> {
    const status = this.data.webhooks.get(eventId);
    if (status === 'processing' || status === 'completed') return false;
    this.data.webhooks.set(eventId, 'processing');
    return true;
  }

  async completeWebhook(eventId: string): Promise<void> { this.data.webhooks.set(eventId, 'completed'); }

  async failWebhook(eventId: string, _message: string): Promise<void> { this.data.webhooks.set(eventId, 'failed'); }

  async recordAudit(userId: string | null, workspaceId: string | null, action: string, metadata: Record<string, unknown> = {}): Promise<void> {
    this.data.audits.push({ userId, workspaceId, action, metadata, at: this.now().toISOString() });
  }

  async deleteUserBilling(userId: string): Promise<void> {
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
}
