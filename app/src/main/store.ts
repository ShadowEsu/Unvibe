/**
 * Persistent local learning store (main process). The local copy is the source of truth;
 * the backend is a mirror we sync to when signed in. Written to userData as JSON. The bearer
 * token is encrypted at rest with Electron safeStorage when the OS keychain is available.
 */
import { app, safeStorage } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { LocalEvent, Outcome } from '../core/learning';

interface AccountData {
  userId: string;
  email: string;
  tokenEnc: string; // base64-encrypted with Electron safeStorage
  refreshTokenEnc: string;
  expiresAt: string;
}

interface Data {
  events: LocalEvent[];
  outbox: string[]; // event ids awaiting sync
  account?: AccountData;
}

class Store {
  private data: Data = { events: [], outbox: [] };
  private file: string;

  constructor() {
    const dir = app.getPath('userData');
    this.file = path.join(dir, 'unvibe-store.json');
    try {
      this.data = JSON.parse(readFileSync(this.file, 'utf8')) as Data;
      this.data.events ??= [];
      this.data.outbox ??= [];
      // Never retain credentials written by pre-safeStorage builds. Learning history stays local.
      if ((this.data.account as (AccountData & { tokenEncrypted?: boolean }) | undefined)?.tokenEncrypted === false) {
        delete this.data.account;
        this.save();
      }
    } catch {
      // fresh install
    }
  }

  private save(): void {
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.data), { mode: 0o600 });
    } catch {
      // best-effort; a failed write must never break a review
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

  markSynced(ids: string[]): void {
    const done = new Set(ids);
    this.data.outbox = this.data.outbox.filter((id) => !done.has(id));
    this.save();
  }

  /**
   * A remote event never enters the outbox. If the same event is pending locally, preserve the
   * local version until it has been acknowledged; that prevents a stale pull from undoing an
   * offline comprehension result.
   */
  mergeRemote(events: LocalEvent[]): void {
    const pending = new Set(this.data.outbox);
    for (const remote of events) {
      const index = this.data.events.findIndex((event) => event.id === remote.id);
      if (index < 0) this.data.events.push(remote);
      else if (!pending.has(remote.id)) this.data.events[index] = remote;
    }
    this.data.events.sort((a, b) => a.ts.localeCompare(b.ts));
    this.save();
  }

  // ---- account ----
  setAccount(userId: string, email: string, token: string, refreshToken: string, expiresAt: string): boolean {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const protect = (value: string) => safeStorage.encryptString(value).toString('base64');
    this.data.account = {
      userId,
      email,
      tokenEnc: protect(token),
      refreshTokenEnc: protect(refreshToken),
      expiresAt,
    };
    this.save();
    return true;
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
      const buf = Buffer.from(a.tokenEnc, 'base64');
      return safeStorage.decryptString(buf);
    } catch {
      return null;
    }
  }

  refreshToken(): string | null {
    const a = this.data.account;
    if (!a?.refreshTokenEnc) return null;
    try {
      const buf = Buffer.from(a.refreshTokenEnc, 'base64');
      return safeStorage.decryptString(buf);
    } catch {
      return null;
    }
  }

  tokenExpiresAt(): string | null {
    return this.data.account?.expiresAt ?? null;
  }

  signOut(): void {
    // Keep local learning — it's the user's. Only drop identity + queued sync.
    delete this.data.account;
    this.data.outbox = [];
    this.save();
  }

  wipeEverything(): void {
    this.data = { events: [], outbox: [] };
    this.save();
  }
}

let singleton: Store | null = null;
export function store(): Store {
  if (!singleton) singleton = new Store();
  return singleton;
}
