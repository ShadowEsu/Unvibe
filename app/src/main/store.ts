/**
 * Persistent local learning store (main process). The local copy is the source of truth;
 * the backend is a mirror we sync to when signed in. Written to userData as JSON. The bearer
 * token is encrypted at rest with Electron safeStorage when the OS keychain is available.
 */
import { app, safeStorage } from 'electron';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import type { LocalEvent, Outcome } from '../core/learning';
import { openToken, sealToken } from '../core/tokenVault';
import { mergeRemoteEvents } from '../core/syncModel';

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

interface Data {
  events: LocalEvent[];
  outbox: string[]; // event ids awaiting sync
  account?: AccountData;
  syncOwnerId?: string; // keeps a signed-out outbox bound to the account that created it
  /** Local-only code snapshots for Pro "since last understood" — never synced. */
  snapshots?: FileSnapshot[];
}

class Store {
  private data: Data = { events: [], outbox: [] };
  private file: string;

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
    if (this.data.account && !this.data.syncOwnerId) this.data.syncOwnerId = this.data.account.userId;
    // Versions before 0.1.0 could persist a reversible base64 token when the keychain was
    // unavailable. Fail closed and require sign-in again instead of retaining that token.
    if (this.data.account && !this.data.account.tokenEncrypted) {
      delete this.data.account;
      this.save();
    }
  }

  private save(): void {
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      const temporary = `${this.file}.tmp`;
      writeFileSync(temporary, JSON.stringify(this.data), { mode: 0o600 });
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
  }

  setOutcome(id: string, outcome: Outcome, concept?: string, conceptLabel?: string): void {
    const ev = this.data.events.find((e) => e.id === id);
    if (!ev) return;
    ev.outcome = outcome;
    if (concept) ev.concept = concept;
    if (conceptLabel) ev.conceptLabel = conceptLabel;
    this.queue(id);
    this.save();
  }

  private queue(id: string): void {
    if (!this.data.outbox.includes(id)) this.data.outbox.push(id);
  }

  events(): LocalEvent[] {
    return this.data.events;
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
    this.data.events = result.events;
    this.save();
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

  signOut(): void {
    // Keep local learning and its identity-bound outbox so the same account can resume later.
    delete this.data.account;
    this.save();
  }

  wipeEverything(): void {
    this.data = { events: [], outbox: [], snapshots: [] };
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
