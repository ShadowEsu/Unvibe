import type { UsageSummary } from '@/billing/plans';

export interface IncomingEvent {
  id: string;
  ts: string;
  scope: string;
  level: string;
  /** Kept with the event so a second device can render the same learning history. */
  lines?: number;
  language?: string;
  sourceApp?: string;
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

export interface SessionTokens {
  token: string;
  refreshToken: string;
  expiresAt: string;
}

export interface Account extends SessionTokens {
  userId: string;
  email: string;
}

export type DeviceRedemption = SessionTokens | 'pending' | 'unknown';

export type { UsageSummary } from '@/billing/plans';

/** Backend persistence + auth. Two implementations: MemoryStore (dev) and SupabaseStore (prod). */
export interface Store {
  readonly kind: string;

  // Device auth
  createDeviceCode(baseUrl: string): Promise<DeviceCode>;
  approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null>;
  redeemDeviceCode(deviceCode: string): Promise<DeviceRedemption>;
  userForToken(token: string): Promise<string | null>;
  refreshSession(refreshToken: string): Promise<SessionTokens | null>;
  revokeToken(token: string): Promise<void>;

  // Cloud explanation allowance. Reservations are keyed by the caller-provided request UUID so
  // network retries cannot consume the allowance twice.
  usage(userId: string): Promise<UsageSummary>;
  reserveExplanation(userId: string, requestId: string): Promise<UsageSummary | null>;
  releaseExplanation(userId: string, requestId: string): Promise<void>;

  // Direct (in-app) auth. Passwordless in dev; production would add verification.
  signIn(email: string): Promise<Account>;
  signUp(email: string): Promise<Account | null>; // null = already exists
  accountInfo(userId: string): Promise<{ userId: string; email?: string }>;
  deleteAccount(userId: string): Promise<void>; // App Store requirement: full account+data removal

  // Data
  upsertEvents(userId: string, events: IncomingEvent[]): Promise<void>;
  profile(userId: string): Promise<ProfileSummary>;
  history(userId: string, limit: number): Promise<EventRecord[]>;
  projects(userId: string): Promise<ProjectSummary[]>;
}
