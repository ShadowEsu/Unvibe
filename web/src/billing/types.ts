export type PlanId = 'free' | 'pro' | 'teams';
export type BillingInterval = 'monthly' | 'annual';
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
  cancelAtPeriodEnd: boolean;
}

export interface BillingStore {
  readonly kind: string;
  ensurePersonalWorkspace(userId: string): Promise<WorkspaceAccess>;
  listWorkspaces(userId: string): Promise<WorkspaceAccess[]>;
  getWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAccess | null>;
  overview(userId: string, workspaceId?: string): Promise<BillingOverview>;
  reserveUsage(userId: string, kind: UsageKind, workspaceId?: string): Promise<UsageReservation>;
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
  markSubscriptionCanceled(stripeSubscriptionId: string): Promise<void>;
  subscriptionByProviderId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null>;
  changeSeatQuantity(userId: string, workspaceId: string, seats: number): Promise<BillingOverview>;
  claimWebhook(eventId: string, eventType: string): Promise<boolean>;
  completeWebhook(eventId: string): Promise<void>;
  failWebhook(eventId: string, message: string): Promise<void>;
  recordAudit(userId: string | null, workspaceId: string | null, action: string, metadata?: Record<string, unknown>): Promise<void>;
  deleteUserBilling(userId: string): Promise<void>;
}
