import type { TokenUsage } from '@/ai/provider';

/** `enterprise` is sold monthly only; `business` (Big Business) is one-time, stored as interval `lifetime`. */
export type PlanId = 'free' | 'pro' | 'teams' | 'enterprise' | 'business';
export type BillingInterval = 'monthly' | 'annual' | 'lifetime';
export type WorkspaceType = 'personal' | 'team';
export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type SubscriptionStatus =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'canceled'
  | 'unpaid';
export type UsageKind =
  | 'ai_explanation'
  | 'project_question'
  | 'indexed_project'
  | 'dictionary_item'
  | 'saved_item';

export interface PlanLimits {
  aiExplanations: number;
  activeProjects: number;
  dictionaryItems: number;
  savedItems: number;
  projectQuestions: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  monthlyUnitAmount: number;
  annualUnitAmount: number;
  minimumSeats: number;
  workspaceType: WorkspaceType;
  limits: PlanLimits;
  features: readonly string[];
}

export interface WorkspaceAccess {
  id: string;
  name: string;
  type: WorkspaceType;
  role: WorkspaceRole;
  ownerUserId: string;
}

export interface SubscriptionRecord {
  workspaceId: string;
  plan: PlanId;
  interval: BillingInterval | null;
  status: SubscriptionStatus;
  seats: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  gracePeriodEndsAt?: string;
  cancelAtPeriodEnd: boolean;
  /** Stripe `created` time of the last webhook event applied to this row; an older event is ignored. */
  stripeEventAt?: string;
}

export interface UsageLine {
  kind: UsageKind;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

export interface BillingOverview {
  workspace: WorkspaceAccess;
  subscription: SubscriptionRecord;
  usage: UsageLine[];
  occupiedSeats: number;
  pendingInvitations: number;
  minimumBillableSeats: number;
  canManageBilling: boolean;
  canManageMembers: boolean;
  hasBillingAccount?: boolean;
}

export interface UsageReservation {
  allowed: boolean;
  line: UsageLine;
  reason?: 'limit_reached' | 'subscription_inactive';
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface WorkspaceMember {
  userId: string;
  email?: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface CheckoutIntentRecord {
  id: string;
  userId: string;
  workspaceId: string;
  plan: Exclude<PlanId, 'free'>;
  interval: BillingInterval;
  seats: number;
  status: 'pending' | 'completed' | 'expired';
  stripeCheckoutSessionId?: string;
  createdAt: string;
}

export interface SubscriptionSyncInput {
  workspaceId: string;
  plan: Exclude<PlanId, 'free'>;
  interval: BillingInterval;
  status: SubscriptionStatus;
  seats: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  gracePeriodEndsAt?: string;
  /** Stripe `created` time of the event this write applies; stored as is (none clears it). */
  stripeEventAt?: string;
  cancelAtPeriodEnd: boolean;
}

export type WebhookClaim = 'claimed' | 'completed' | 'in_progress';

export interface BillingStore {
  readonly kind: string;
  ensurePersonalWorkspace(userId: string): Promise<WorkspaceAccess>;
  listWorkspaces(userId: string): Promise<WorkspaceAccess[]>;
  /** The workspaces this user is a member of, without creating the personal one (account deletion must not provision). */
  existingWorkspaces(userId: string): Promise<WorkspaceAccess[]>;
  getWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAccess | null>;
  overview(userId: string, workspaceId?: string): Promise<BillingOverview>;
  reserveUsage(userId: string, kind: UsageKind, workspaceId?: string): Promise<UsageReservation>;
  /** Give back one unit reserved earlier this month when the metered action produced nothing. Never below zero. */
  releaseUsage(userId: string, kind: UsageKind, workspaceId?: string): Promise<void>;
  /**
   * Write provider token counts onto the usage row `reserveUsage` wrote for this request: the user's
   * newest row of `kind` from the last 15 minutes that has no counts yet. Updates, never inserts.
   * Counts only, no text. `usage.estimated` sets `tokens_estimated`, so measured and chars/4
   * estimates stay separable. With two requests of the same kind in flight at once, the counts can
   * land on the sibling row; per-user and per-kind totals stay exact. No matching row: nothing happens.
   */
  recordUsageTokens(userId: string, kind: UsageKind, usage: TokenUsage): Promise<void>;
  createTeamWorkspace(userId: string, name: string): Promise<WorkspaceAccess>;
  listMembers(userId: string, workspaceId: string): Promise<WorkspaceMember[]>;
  changeMemberRole(userId: string, workspaceId: string, memberUserId: string, role: Exclude<WorkspaceRole, 'owner'>): Promise<void>;
  removeMember(userId: string, workspaceId: string, memberUserId: string): Promise<void>;
  listInvitations(userId: string, workspaceId: string): Promise<WorkspaceInvitation[]>;
  createInvitation(
    userId: string,
    workspaceId: string,
    email: string,
    role: Exclude<WorkspaceRole, 'owner'>,
    tokenHash: string,
    expiresAt: string,
  ): Promise<WorkspaceInvitation>;
  revokeInvitation(userId: string, workspaceId: string, invitationId: string): Promise<void>;
  acceptInvitation(userId: string, tokenHash: string, userEmail?: string): Promise<WorkspaceAccess>;
  createCheckoutIntent(input: Omit<CheckoutIntentRecord, 'id' | 'status' | 'createdAt'>): Promise<CheckoutIntentRecord>;
  pendingCheckout(userId: string, workspaceId: string): Promise<CheckoutIntentRecord | null>;
  attachCheckoutSession(intentId: string, stripeCheckoutSessionId: string): Promise<void>;
  expireCheckoutIntent(intentId: string): Promise<void>;
  completeCheckoutIntent(stripeCheckoutSessionId: string): Promise<CheckoutIntentRecord | null>;
  findCheckoutIntent(stripeCheckoutSessionId: string): Promise<CheckoutIntentRecord | null>;
  syncSubscription(input: SubscriptionSyncInput): Promise<void>;
  /** Ends access for the row stored under this Stripe id; `stripeEventAt` replaces the stored event time when given. */
  markSubscriptionCanceled(stripeSubscriptionId: string, stripeEventAt?: string): Promise<void>;
  /** True when a full refund of this PaymentIntent was recorded (`refund.full` audit row), matched to a row or not. */
  paymentRefunded(paymentIntentId: string): Promise<boolean>;
  subscriptionByProviderId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null>;
  /** The subscription row stored for a workspace (one row per workspace), whatever its status. */
  subscriptionByWorkspaceId(workspaceId: string): Promise<SubscriptionRecord | null>;
  /** The subscription row for a Stripe customer (stripe_customer_id is unique per row). */
  subscriptionByCustomerId(stripeCustomerId: string): Promise<SubscriptionRecord | null>;
  changeSeatQuantity(userId: string, workspaceId: string, seats: number): Promise<BillingOverview>;
  /**
   * `claimed`: process the event now. `completed`: already processed. `in_progress`: another
   * delivery holds an unexpired lease, so this one must be retried later.
   */
  claimWebhook(eventId: string, eventType: string): Promise<WebhookClaim>;
  completeWebhook(eventId: string): Promise<void>;
  failWebhook(eventId: string, message: string): Promise<void>;
  recordAudit(userId: string | null, workspaceId: string | null, action: string, metadata?: Record<string, unknown>): Promise<void>;
}
