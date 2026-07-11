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
  tokenEnc: string; // base64; encrypted if `tokenEncrypted`, else plain utf8 base64
  tokenEncrypted: boolean;
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

  // ---- account ----
  setAccount(userId: string, email: string, token: string): void {
    const canEncrypt = safeStorage.isEncryptionAvailable();
    const tokenEnc = canEncrypt
      ? safeStorage.encryptString(token).toString('base64')
      : Buffer.from(token, 'utf8').toString('base64');
    this.data.account = { userId, email, tokenEnc, tokenEncrypted: canEncrypt };
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
      const buf = Buffer.from(a.tokenEnc, 'base64');
      return a.tokenEncrypted ? safeStorage.decryptString(buf) : buf.toString('utf8');
    } catch {
      return null;
    }
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
