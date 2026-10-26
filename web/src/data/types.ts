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
  workspaceId?: string;
  authorUserId?: string;
  authorEmail?: string;
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

export type SkillEvidenceState = 'seen' | 'familiar' | 'strong' | 'needs_review';

export interface SkillRecord {
  id: string;
  userId: string;
  normalizedName: string;
  displayName: string;
  category?: string;
  language?: string;
  firstEncounteredAt: string;
  lastEncounteredAt: string;
  lastReviewedAt?: string;
  encounterCount: number;
  reviewCount: number;
  successfulChecks: number;
  unsuccessfulChecks: number;
  evidenceState: SkillEvidenceState;
  nextReviewDate?: string;
  relatedProjects: string[];
  relatedEventIds: string[];
}

export interface HistoryPage {
  events: EventRecord[];
  nextCursor?: string;
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

/** deleted: the Blob beta-download records for the email are gone (or there were none). */
export type BetaDownloadCleanup = 'deleted' | 'not_configured';

export interface AccountDeletion {
  userId: string;
  state: 'started' | 'done';
  step: 'started' | 'beta_downloads' | 'auth_identity' | 'app_data' | 'done';
  /** Captured when the deletion started; cleared once it is done. */
  email?: string;
}

/** Backend persistence + auth. Two implementations: MemoryStore (dev) and SupabaseStore (prod). */
export interface Store {
  readonly kind: string;

  // Device auth
  createDeviceCode(baseUrl: string): Promise<DeviceCode>;
  approveDeviceCode(userCode: string, userId: string, email?: string): Promise<string | null>;
  redeemDeviceCode(deviceCode: string): Promise<{ token: string } | 'pending' | 'unknown' | 'expired' | 'used'>;
  userForToken(token: string): Promise<string | null>;
  revokeToken(token: string): Promise<void>;

  // Direct (in-app) auth. Passwordless in dev; production would add verification.
  signIn(email: string): Promise<Account>;
  signUp(email: string): Promise<Account | null>; // null = already exists
  accountInfo(userId: string): Promise<{ userId: string; email?: string; name?: string }>;
  /** The profile name from the sign-in provider (Google), stored in users.settings. */
  rememberName(userId: string, name: string): Promise<void>;
  userIdForEmail(email: string): Promise<string | null>;

  // Account deletion (App Store requirement). State lives in account_deletions; DELETE
  // /api/v1/account runs the steps.
  accountDeletion(userId: string): Promise<AccountDeletion | null>;
  /** The deletion that the token with this sha256 hex asked for, whatever its state. */
  accountDeletionForToken(tokenHash: string): Promise<AccountDeletion | null>;
  /**
   * Records started with the email and the token hash, or adds the hash to a started deletion. A done
   * one comes back unchanged. Throws TeamHasMembersError, recording nothing, while the account owns a
   * team workspace with other members.
   */
  beginAccountDeletion(userId: string, email: string | undefined, tokenHash: string): Promise<AccountDeletion>;
  recordAccountDeletionStep(userId: string, step: 'beta_downloads' | 'auth_identity', betaDownloads?: BetaDownloadCleanup): Promise<void>;
  /**
   * The public side in one transaction: email-keyed rows, billing and workspaces, then the user row
   * (tokens go with it). Throws TeamHasMembersError, and deletes nothing, when the account owns a
   * team workspace with other members.
   */
  eraseAccount(userId: string): Promise<void>;
  /** Marks the deletion done and forgets the captured email. */
  finishAccountDeletion(userId: string): Promise<void>;

  // Data
  upsertEvents(userId: string, events: IncomingEvent[], workspaceId?: string): Promise<void>;
  profile(userId: string): Promise<ProfileSummary>;
  history(userId: string, limit: number): Promise<EventRecord[]>;
  historyPage(userId: string, limit: number, cursor?: string): Promise<HistoryPage>;
  projects(userId: string): Promise<ProjectSummary[]>;
  /** Team feed: all members' metadata events in a workspace, with authorship. Caller must verify membership. */
  workspaceHistoryPage(workspaceId: string, limit: number, cursor?: string): Promise<HistoryPage>;
  workspaceProjects(workspaceId: string): Promise<ProjectSummary[]>;
}
