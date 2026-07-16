export interface IncomingEvent {
  id: string;
  ts: string;
  eventType?: 'explanation_completed';
  localDate?: string;
  timezone?: string;
  scope: string;
  level: string;
  file?: string;
  outcome: 'reviewed' | 'understood' | 'needs_review';
  concept?: string;
  conceptLabel?: string;
  project?: string;
  lines?: number;
  language?: string;
  sourceApp?: string;
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
  conceptsFamiliar: number;
  conceptsStrong: number;
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

export type DeviceRedemption = { token: string } | 'pending' | 'unknown' | 'expired' | 'used';

export interface HistoryPage {
  events: EventRecord[];
  nextCursor?: string;
}

export type SkillEvidenceState = 'seen' | 'familiar' | 'strong' | 'needs_review';

export interface SkillRecord {
  id: string;
  userId: string;
  normalizedName: string;
  displayName: string;
  category?: string;
  language?: string;
  framework?: string;
  firstEncounteredAt: string;
  lastEncounteredAt: string;
  lastReviewedAt: string;
  encounterCount: number;
  reviewCount: number;
  successfulChecks: number;
  unsuccessfulChecks: number;
  evidenceState: SkillEvidenceState;
  nextReviewDate?: string;
  relatedProjects: string[];
  relatedEventIds: string[];
}

/** Backend persistence + auth. Two implementations: MemoryStore (dev) and SupabaseStore (prod). */
export interface Store {
  readonly kind: string;

  // Device auth
  createDeviceCode(baseUrl: string): Promise<DeviceCode>;
  approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null>;
  redeemDeviceCode(deviceCode: string): Promise<DeviceRedemption>;
  userForToken(token: string): Promise<string | null>;
  revokeToken(token: string): Promise<void>;

  // Direct (in-app) auth. Passwordless in dev; production would add verification.
  signIn(email: string): Promise<Account>;
  signUp(email: string): Promise<Account | null>; // null = already exists
  accountInfo(userId: string): Promise<{ userId: string; email?: string }>;
  deleteAccount(userId: string): Promise<void>; // App Store requirement: full account+data removal

  // Data
  upsertEvents(userId: string, events: IncomingEvent[]): Promise<void>;
  profile(userId: string): Promise<ProfileSummary>;
  history(userId: string, limit: number): Promise<EventRecord[]>;
  historyPage(userId: string, limit: number, cursor?: string): Promise<HistoryPage>;
  projects(userId: string): Promise<ProjectSummary[]>;
  skills(userId: string): Promise<SkillRecord[]>;
}
