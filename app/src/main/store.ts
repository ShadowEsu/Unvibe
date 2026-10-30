/**
 * Persistent local learning store (main process). The local copy is the source of truth;
 * the backend is a mirror we sync to when signed in. Written to userData as JSON. The bearer
 * token is encrypted at rest with Electron safeStorage when the OS keychain is available.
 */
import { app, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import { withAnswerDay, type LocalEvent, type Outcome } from '../core/learning';
import type { ProgressStep } from './progress';
import { openToken, sealToken } from '../core/tokenVault';
import { mergeRemoteEvents } from '../core/syncModel';
import { cleanPmfDraft, earliestFirstRun, type PmfDraft, type PmfStatus } from '../core/pmf';

interface AccountData {
  userId: string;
  email: string;
  tokenEnc: string; // base64-encoded safeStorage ciphertext
  tokenEncrypted: boolean;
}

interface FileSnapshot {
  file: string;
  project?: string;
  text: string;
  savedAt: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

export interface ChatThread {
  id: string;
  title: string;
  startedAt: string;
  updatedAt: string;
  turns: ChatTurn[];
}

interface Data {
  events: LocalEvent[];
  outbox: string[]; // event ids awaiting sync
  account?: AccountData;
  syncOwnerId?: string; // keeps a signed-out outbox bound to the account that created it
  /** Stable id for sealed trial metering. Local only — never a secret. */
  installId?: string;
  /** Local-only code snapshots for Pro "since last understood" — never synced. */
  snapshots?: FileSnapshot[];
  /** Daily counters for companion Study assistant / Quiz cards (local only). */
  dailyUsage?: { day: string; studyAsks: number; quizzes: number };
  /** Selected-code prompt counter for a sealed public-beta trial. */
  betaPromptUsage?: { selectedCodePrompts: number };
  /** Starts the public-beta entitlement on this device. */
  trialStartedAt?: string;
  /** Event ids the user removed. Local only, so a later sync cannot restore them. */
  deletedIds?: string[];
  /** Saved Ask Unvibe conversations. Local only — never synced to the backend. */
  chatThreads?: ChatThread[];
  /** Setup-progress steps the server has acknowledged (progress.ts), so a step is sent once. */
  progressSent?: Partial<Record<ProgressStep, true>>;
  /** The launch-at-login question was shown (either answer), so it is never asked again. */
  loginPromptAsked?: true;
  /** This install's first run (ISO). Set once, never later than the store's own records show. */
  firstRunAt?: string;
  /** The PMF survey card (FE-09): sent or closed for good, and the unsent answers. Local only. */
  pmf?: { status?: PmfStatus; draft?: PmfDraft };
}

const CHAT_THREAD_CAP = 30;
const CHAT_TURN_CAP = 80;

export const STUDY_ASK_DAILY_LIMIT = 20;
export const QUIZ_DAILY_LIMIT = 30;
export const BETA_SELECTED_CODE_PROMPT_LIMIT = 50;
export const BETA_TRIAL_DURATION_DAYS = 30;

const learningListeners = new Set<() => void>();

/** Runs `listener` after every saved change to what the companion lists. Returns an unsubscribe. */
export function onLearningChanged(listener: () => void): () => void {
  learningListeners.add(listener);
  return () => learningListeners.delete(listener);
}

/** The change is already saved; a listener failure (e.g. a closed window) must not report it as unsaved. */
function learningChanged(): void {
  for (const listener of learningListeners) {
    try {
      listener();
    } catch {
      // Ignored on purpose: the next refresh (focus or change) shows the saved state anyway.
    }
  }
}

class Store {
  private data: Data = { events: [], outbox: [] };
  private file: string;
  /** Goes up on every wipe, so a request started before it can tell its result belongs to erased data. */
  private wipes = 0;

  constructor() {
    const dir = app.getPath('userData');
    this.file = path.join(dir, 'unvibe-store.json');
    let loaded: Data;
    try {
      loaded = JSON.parse(readFileSync(this.file, 'utf8')) as Data;
    } catch {
      return; // fresh install or unreadable legacy data
    }
    this.data = loaded;
    this.data.events ??= [];
    this.data.outbox ??= [];
    this.data.snapshots ??= [];
    this.data.deletedIds ??= [];
    if (this.data.account && !this.data.syncOwnerId) this.data.syncOwnerId = this.data.account.userId;
    // Versions before 0.1.0 could persist a reversible base64 token when the keychain was
    // unavailable. Fail closed and require sign-in again instead of retaining that token.
    if (this.data.account && !this.data.account.tokenEncrypted) {
      delete this.data.account;
      this.save();
    }
  }

  private save(data: Data = this.data): void {
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      const temporary = `${this.file}.tmp`;
      writeFileSync(temporary, JSON.stringify(data), { mode: 0o600 });
      renameSync(temporary, this.file);
    } catch (error) {
      throw new Error('Unvibe could not save learning data on this Mac. Check disk space and file permissions, then try again.', { cause: error });
    }
  }

  // ---- events ----
  recordReview(ev: LocalEvent): void {
    const idx = this.data.events.findIndex((e) => e.id === ev.id);
    if (idx >= 0) this.data.events[idx] = ev;
    else this.data.events.push(ev);
    this.queue(ev.id);
    this.save();
    learningChanged();
  }


  /** `answeredAt`: when a Test me or quiz answer set this outcome; its local day counts toward today's goal. */
  setOutcome(id: string, outcome: Outcome, concept?: string, conceptLabel?: string, answeredAt?: Date): void {
    const ev = this.data.events.find((e) => e.id === id);
    if (!ev) return;
    ev.outcome = outcome;
    if (concept) ev.concept = concept;
    if (conceptLabel) ev.conceptLabel = conceptLabel;
    if (answeredAt) ev.answeredOn = withAnswerDay(ev.answeredOn, answeredAt);
    this.queue(id);
    this.save();
    learningChanged();
  }

  /** Update on-device lesson body without forcing a cloud re-upload of code. */
  updateLesson(id: string, patch: { code?: string; explanation?: string; level?: string; note?: string }): boolean {
    const ev = this.data.events.find((e) => e.id === id);
    if (!ev) return false;
    if (patch.code !== undefined) ev.code = patch.code.slice(0, 40_000);
    if (patch.explanation !== undefined) ev.explanation = patch.explanation.slice(0, 60_000);
    if (patch.level) ev.level = patch.level;
    if (patch.note !== undefined) {
      const note = patch.note.trim().slice(0, 4_000);
      if (note) ev.note = note;
      else delete ev.note;
    }
    this.save();
    learningChanged();
    return true;
  }

  eventById(id: string): LocalEvent | undefined {
    if ((this.data.deletedIds ?? []).includes(id)) return undefined;
    return this.data.events.find((e) => e.id === id);
  }

  forgetEvent(id: string): boolean {
    if (!id || id.startsWith('active-')) return false;
    const existed = this.data.events.some((event) => event.id === id);
    this.data.events = this.data.events.filter((event) => event.id !== id);
    this.data.outbox = this.data.outbox.filter((queued) => queued !== id);
    const hidden = new Set(this.data.deletedIds ?? []);
    hidden.add(id);
    this.data.deletedIds = [...hidden].slice(-2000);
    this.save();
    learningChanged();
    return existed || hidden.has(id);
  }

  private todayUsage(): { day: string; studyAsks: number; quizzes: number } {
    const day = new Date().toLocaleDateString('en-CA');
    const current = this.data.dailyUsage;
    if (!current || current.day !== day) {
      this.data.dailyUsage = { day, studyAsks: 0, quizzes: 0 };
    }
    return this.data.dailyUsage!;
  }

  studyAskUsage(): { used: number; limit: number; remaining: number } {
    const u = this.todayUsage();
    return { used: u.studyAsks, limit: STUDY_ASK_DAILY_LIMIT, remaining: Math.max(0, STUDY_ASK_DAILY_LIMIT - u.studyAsks) };
  }

  quizUsage(): { used: number; limit: number; remaining: number } {
    const u = this.todayUsage();
    return { used: u.quizzes, limit: QUIZ_DAILY_LIMIT, remaining: Math.max(0, QUIZ_DAILY_LIMIT - u.quizzes) };
  }

  consumeStudyAsk(): { ok: true; remaining: number } | { ok: false; remaining: number; error: string } {
    const u = this.todayUsage();
    if (u.studyAsks >= STUDY_ASK_DAILY_LIMIT) {
      return { ok: false, remaining: 0, error: `Daily study assistant limit reached (${STUDY_ASK_DAILY_LIMIT}). Resets tomorrow.` };
    }
    u.studyAsks += 1;
    this.save();
    return { ok: true, remaining: STUDY_ASK_DAILY_LIMIT - u.studyAsks };
  }

  consumeQuiz(): { ok: true; remaining: number } | { ok: false; remaining: number; error: string } {
    const u = this.todayUsage();
    if (u.quizzes >= QUIZ_DAILY_LIMIT) {
      return { ok: false, remaining: 0, error: `Daily quiz limit reached (${QUIZ_DAILY_LIMIT}). Resets tomorrow.` };
    }
    u.quizzes += 1;
    this.save();
    return { ok: true, remaining: QUIZ_DAILY_LIMIT - u.quizzes };
  }

  /** The 30-day beta window begins when this device first opens a beta action. */
  betaTrialWindow(now = new Date()): { startedAt: string; expiresAt: string; expired: boolean } {
    const current = this.data.trialStartedAt;
    const started = current ? new Date(current) : now;
    const validStart = Number.isNaN(started.getTime()) ? now : started;
    if (!current || Number.isNaN(started.getTime())) {
      this.data.trialStartedAt = validStart.toISOString();
      this.save();
    }
    const expires = new Date(validStart.getTime() + BETA_TRIAL_DURATION_DAYS * 86_400_000);
    return { startedAt: validStart.toISOString(), expiresAt: expires.toISOString(), expired: now >= expires };
  }

  private betaPromptUsage(): { selectedCodePrompts: number } {
    const current = this.data.betaPromptUsage;
    if (!current) this.data.betaPromptUsage = { selectedCodePrompts: 0 };
    return this.data.betaPromptUsage!;
  }

  /** Public-beta selection credit. It is local-only and never contains selected code. */
  betaSelectedCodeUsage(now = new Date()): { used: number; limit: number; remaining: number; resetsAt: string } {
    const usage = this.betaPromptUsage();
    const trial = this.betaTrialWindow(now);
    return {
      used: usage.selectedCodePrompts,
      limit: BETA_SELECTED_CODE_PROMPT_LIMIT,
      remaining: trial.expired ? 0 : Math.max(0, BETA_SELECTED_CODE_PROMPT_LIMIT - usage.selectedCodePrompts),
      resetsAt: trial.expiresAt,
    };
  }

  /** Public-beta selection credit. It is local-only and never contains selected code. */
  consumeBetaSelectedCodePrompt(now = new Date()): { ok: true; remaining: number } | { ok: false; remaining: number } {
    const usage = this.betaPromptUsage();
    const trial = this.betaTrialWindow(now);
    if (trial.expired || usage.selectedCodePrompts >= BETA_SELECTED_CODE_PROMPT_LIMIT) return { ok: false, remaining: 0 };
    usage.selectedCodePrompts += 1;
    this.save();
    return { ok: true, remaining: BETA_SELECTED_CODE_PROMPT_LIMIT - usage.selectedCodePrompts };
  }

  private queue(id: string): void {
    if (!this.data.outbox.includes(id)) this.data.outbox.push(id);
  }

  events(): LocalEvent[] {
    const hidden = new Set(this.data.deletedIds ?? []);
    if (hidden.size === 0) return this.data.events;
    return this.data.events.filter((event) => !hidden.has(event.id));
  }

  pending(): LocalEvent[] {
    const ids = new Set(this.data.outbox);
    return this.data.events.filter((e) => ids.has(e.id));
  }

  pendingCount(): number {
    return this.data.outbox.length;
  }

  /** Merge the remote mirror without replacing a newer local event still waiting to upload. */
  mergeRemote(events: LocalEvent[]): number {
    const result = mergeRemoteEvents(this.data.events, this.data.outbox, events);
    const hidden = new Set(this.data.deletedIds ?? []);
    this.data.events = hidden.size === 0 ? result.events : result.events.filter((event) => !hidden.has(event.id));
    this.save();
    if (result.merged > 0) learningChanged();
    return result.merged;
  }

  markSynced(ids: string[]): void {
    const done = new Set(ids);
    this.data.outbox = this.data.outbox.filter((id) => !done.has(id));
    this.save();
  }

  // ---- account ----
  setAccount(userId: string, email: string, token: string): void {
    const tokenEnc = sealToken(token, safeStorage);
    if (this.data.syncOwnerId && this.data.syncOwnerId !== userId) {
      // Never upload one account's queued activity into a different account.
      this.data.outbox = [];
    }
    this.data.syncOwnerId = userId;
    this.data.account = { userId, email, tokenEnc, tokenEncrypted: true };
    this.save();
  }

  account(): { userId: string; email: string } | null {
    return this.data.account
      ? { userId: this.data.account.userId, email: this.data.account.email }
      : null;
  }

  token(): string | null {
    const a = this.data.account;
    if (!a) return null;
    try {
      if (!a.tokenEncrypted) return null;
      return openToken(a.tokenEnc, safeStorage);
    } catch {
      return null;
    }
  }

  /** Persistent anonymous install id used for sealed trial quota. */
  installId(): string {
    if (this.data.installId && /^[a-zA-Z0-9_-]{8,128}$/.test(this.data.installId)) {
      return this.data.installId;
    }
    this.data.installId = randomUUID().replace(/-/g, '');
    this.save();
    return this.data.installId;
  }

  progressSent(step: ProgressStep): boolean {
    return this.data.progressSent?.[step] === true;
  }

  markProgressSent(step: ProgressStep): void {
    this.data.progressSent = { ...this.data.progressSent, [step]: true };
    this.save();
  }

  loginPromptAsked(): boolean {
    return this.data.loginPromptAsked === true;
  }

  markLoginPromptAsked(): void {
    this.data.loginPromptAsked = true;
    this.save();
  }

  /**
   * When this install first ran. Stored on first call (main.ts asks at launch); an install that
   * updated into this version gets the earliest of its trial start and oldest saved explanation.
   */
  firstRunAt(now = new Date()): string {
    const stored = this.data.firstRunAt;
    if (stored && !Number.isNaN(Date.parse(stored))) return stored;
    const oldest = this.data.events.reduce<string | undefined>((min, e) => (!min || e.ts < min ? e.ts : min), undefined);
    this.data.firstRunAt = earliestFirstRun([this.data.trialStartedAt, oldest], now);
    this.save();
    return this.data.firstRunAt;
  }

  pmfStatus(): PmfStatus | undefined {
    return this.data.pmf?.status;
  }

  pmfDraft(): PmfDraft {
    return cleanPmfDraft(this.data.pmf?.draft);
  }

  /** Unsent answers stay in this file until Send succeeds; ignored once the survey is closed. */
  savePmfDraft(draft: PmfDraft): void {
    if (this.data.pmf?.status) return;
    this.data.pmf = { draft };
    this.save();
  }

  /** Sent or closed: the card never shows again and the draft is deleted. */
  setPmfStatus(status: PmfStatus): void {
    this.data.pmf = { status };
    this.save();
  }

  signOut(): void {
    // Keep local learning and its identity-bound outbox so the same account can resume later.
    delete this.data.account;
    this.save();
  }

  wipeEverything(): void {
    // Save first: when the file can't be written, memory keeps matching what is on disk.
    // The first-run time and a closed or sent survey survive, so Erase everything never brings the
    // survey card back early; survey answers not yet sent are erased with everything else.
    const empty: Data = { events: [], outbox: [], snapshots: [], deletedIds: [] };
    if (this.data.firstRunAt) empty.firstRunAt = this.data.firstRunAt;
    if (this.data.pmf?.status) empty.pmf = { status: this.data.pmf.status };
    this.save(empty);
    this.data = empty;
    this.wipes += 1;
    learningChanged();
  }

  /** Compare before and after a slow request: a change means the store was wiped meanwhile. */
  wipeGeneration(): number {
    return this.wipes;
  }

  // ---- saved Ask conversations ----
  chatThreads(): ChatThread[] {
    return [...(this.data.chatThreads ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  saveChatThread(thread: ChatThread): void {
    const turns = thread.turns.slice(-CHAT_TURN_CAP);
    if (turns.length === 0) return;
    const next: ChatThread = { ...thread, turns };
    const threads = [...(this.data.chatThreads ?? [])];
    const idx = threads.findIndex((item) => item.id === thread.id);
    if (idx >= 0) threads[idx] = next;
    else threads.push(next);
    threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    this.data.chatThreads = threads.slice(0, CHAT_THREAD_CAP);
    this.save();
  }

  deleteChatThread(id: string): void {
    this.data.chatThreads = (this.data.chatThreads ?? []).filter((item) => item.id !== id);
    this.save();
  }

  fileSnapshot(file: string, project?: string): FileSnapshot | undefined {
    return (this.data.snapshots ?? []).find((s) => s.file === file && s.project === project);
  }

  saveFileSnapshot(file: string, project: string | undefined, text: string): void {
    const snapshots = this.data.snapshots ?? [];
    const next: FileSnapshot = { file, project, text, savedAt: new Date().toISOString() };
    const idx = snapshots.findIndex((s) => s.file === file && s.project === project);
    if (idx >= 0) snapshots[idx] = next;
    else snapshots.push(next);
    // Cap local snapshot cache.
    this.data.snapshots = snapshots.slice(-40);
    this.save();
  }
}

let singleton: Store | null = null;
export function store(): Store {
  if (!singleton) singleton = new Store();
  return singleton;
}
