export interface IncomingEvent {
  id: string;
  ts: string;
  scope: string;
  level: string;
  file?: string;
  outcome: 'reviewed' | 'understood' | 'needs_review';
  concept?: string;
  conceptLabel?: string;
  project?: string;
}

export interface EventRecord extends IncomingEvent {
  userId: string;
}

export interface ProfileSummary {
  totalReviews: number;
  understood: number;
  needsReview: number;
  conceptsSeen: number;
  conceptsUnderstood: number;
  conceptsNeedReview: number;
  currentStreakDays: number;
  lastActive?: string;
}

export interface ProjectSummary {
  name: string;
  reviews: number;
  lastActive: string;
}

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
}

export interface Account {
  token: string;
  userId: string;
  email: string;
}

export type { UsageSummary } from '@/billing/plans';

/** Backend persistence + auth. Two implementations: MemoryStore (dev) and SupabaseStore (prod). */
export interface Store {
  readonly kind: string;

  // Device auth
  createDeviceCode(baseUrl: string): Promise<DeviceCode>;
  approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null>;
  redeemDeviceCode(deviceCode: string): Promise<{ token: string } | 'pending' | 'unknown'>;
  userForToken(token: string): Promise<string | null>;

  // Direct (in-app) auth. Passwordless in dev; production would add verification.
  signIn(email: string): Promise<Account>;
  accountInfo(userId: string): Promise<{ userId: string; email?: string }>;
  deleteAccount(userId: string): Promise<void>; // App Store requirement: full account+data removal

  // Billing/usage. Only cloud-generated explanations count; learning stays available.
  usage(userId: string): Promise<import('@/billing/plans').UsageSummary>;
  reserveExplanation(userId: string, requestId: string): Promise<import('@/billing/plans').UsageSummary | null>;
  completeExplanation(userId: string, requestId: string): Promise<void>;
  releaseExplanation(userId: string, requestId: string): Promise<void>;

  // Data
  upsertEvents(userId: string, events: IncomingEvent[]): Promise<void>;
  profile(userId: string): Promise<ProfileSummary>;
  history(userId: string, limit: number): Promise<EventRecord[]>;
  projects(userId: string): Promise<ProjectSummary[]>;
}
