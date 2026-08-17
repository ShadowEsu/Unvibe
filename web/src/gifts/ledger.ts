import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GIFT_LIMIT, GIFT_MONTHS, normalizeEmail, normalizeGiftCode } from './codes';

export interface GiftRedemption {
  giverEmail: string;
  giverCode: string;
  recipientEmail: string;
  months: number;
  createdAt: string;
}

export interface GiftLedger {
  countForCode(code: string): Promise<number>;
  alreadyRedeemed(code: string, recipientEmail: string): Promise<boolean>;
  addRedemption(row: Omit<GiftRedemption, 'createdAt'>): Promise<void>;
  pendingMonths(email: string): Promise<number>;
  addPendingMonths(email: string, months: number): Promise<void>;
  takePendingMonths(email: string): Promise<number>;
}

interface MemoryGiftData {
  redemptions: GiftRedemption[];
  pending: Map<string, number>;
}

const GIFT_BUCKET = 'gift-ledger';

function memoryData(): MemoryGiftData {
  const global = globalThis as unknown as { __unvibeGifts?: MemoryGiftData };
  global.__unvibeGifts ??= { redemptions: [], pending: new Map() };
  return global.__unvibeGifts;
}

export function resetGiftMemory(): void {
  cached = undefined;
  const global = globalThis as unknown as { __unvibeGifts?: MemoryGiftData };
  global.__unvibeGifts = { redemptions: [], pending: new Map() };
}

function missingRelation(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? '';
  return error?.code === 'PGRST205' || error?.code === '42P01' || /schema cache|does not exist|could not find the table/i.test(message);
}

function safeSegment(value: string): string {
  return encodeURIComponent(value).replace(/%/g, '_');
}

class MemoryGiftLedger implements GiftLedger {
  async countForCode(code: string): Promise<number> {
    const normalized = normalizeGiftCode(code);
    return memoryData().redemptions.filter((row) => row.giverCode === normalized).length;
  }

  async alreadyRedeemed(code: string, recipientEmail: string): Promise<boolean> {
    const normalized = normalizeGiftCode(code);
    const email = normalizeEmail(recipientEmail);
    return memoryData().redemptions.some((row) => row.giverCode === normalized && row.recipientEmail === email);
  }

  async addRedemption(row: Omit<GiftRedemption, 'createdAt'>): Promise<void> {
    memoryData().redemptions.push({
      giverEmail: normalizeEmail(row.giverEmail),
      giverCode: normalizeGiftCode(row.giverCode),
      recipientEmail: normalizeEmail(row.recipientEmail),
      months: row.months,
      createdAt: new Date().toISOString(),
    });
  }

  async pendingMonths(email: string): Promise<number> {
    return memoryData().pending.get(normalizeEmail(email)) ?? 0;
  }

  async addPendingMonths(email: string, months: number): Promise<void> {
    const key = normalizeEmail(email);
    const data = memoryData();
    data.pending.set(key, (data.pending.get(key) ?? 0) + months);
  }

  async takePendingMonths(email: string): Promise<number> {
    const key = normalizeEmail(email);
    const data = memoryData();
    const months = data.pending.get(key) ?? 0;
    data.pending.delete(key);
    return months;
  }
}

class StorageGiftLedger implements GiftLedger {
  private ready: Promise<void> | undefined;

  constructor(private readonly db: SupabaseClient) {}

  private ensureBucket(): Promise<void> {
    this.ready ??= (async () => {
      const { data } = await this.db.storage.getBucket(GIFT_BUCKET);
      if (data) return;
      const { error } = await this.db.storage.createBucket(GIFT_BUCKET, { public: false, fileSizeLimit: 100_000 });
      if (error && !/already exists|duplicate/i.test(error.message)) {
        throw new Error(`Gift storage setup failed: ${error.message}`);
      }
    })();
    return this.ready;
  }

  private redemptionPath(code: string, recipientEmail: string): string {
    return `redemptions/${normalizeGiftCode(code)}/${safeSegment(normalizeEmail(recipientEmail))}.json`;
  }

  private pendingPath(email: string): string {
    return `pending/${safeSegment(normalizeEmail(email))}.json`;
  }

  private async readJson<T>(path: string): Promise<T | null> {
    const { data, error } = await this.db.storage.from(GIFT_BUCKET).download(path);
    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text) as T;
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    const body = JSON.stringify(value);
    const { error } = await this.db.storage.from(GIFT_BUCKET).upload(path, body, {
      contentType: 'application/json',
      upsert: true,
    });
    if (error) throw new Error(`Gift storage write failed: ${error.message}`);
  }

  async countForCode(code: string): Promise<number> {
    await this.ensureBucket();
    const { data, error } = await this.db.storage.from(GIFT_BUCKET).list(`redemptions/${normalizeGiftCode(code)}`, { limit: 100 });
    if (error) throw new Error(`Gift count failed: ${error.message}`);
    return (data ?? []).filter((file) => file.name.endsWith('.json')).length;
  }

  async alreadyRedeemed(code: string, recipientEmail: string): Promise<boolean> {
    await this.ensureBucket();
    return Boolean(await this.readJson(this.redemptionPath(code, recipientEmail)));
  }

  async addRedemption(row: Omit<GiftRedemption, 'createdAt'>): Promise<void> {
    await this.ensureBucket();
    await this.writeJson(this.redemptionPath(row.giverCode, row.recipientEmail), {
      giverEmail: normalizeEmail(row.giverEmail),
      giverCode: normalizeGiftCode(row.giverCode),
      recipientEmail: normalizeEmail(row.recipientEmail),
      months: row.months,
      createdAt: new Date().toISOString(),
    });
  }

  async pendingMonths(email: string): Promise<number> {
    await this.ensureBucket();
    const row = await this.readJson<{ months?: number }>(this.pendingPath(email));
    return Number(row?.months ?? 0);
  }

  async addPendingMonths(email: string, months: number): Promise<void> {
    await this.ensureBucket();
    const current = await this.pendingMonths(email);
    await this.writeJson(this.pendingPath(email), {
      email: normalizeEmail(email),
      months: current + months,
      updatedAt: new Date().toISOString(),
    });
  }

  async takePendingMonths(email: string): Promise<number> {
    await this.ensureBucket();
    const months = await this.pendingMonths(email);
    if (months <= 0) return 0;
    const { error } = await this.db.storage.from(GIFT_BUCKET).remove([this.pendingPath(email)]);
    if (error) throw new Error(`Pending gift clear failed: ${error.message}`);
    return months;
  }
}

class SupabaseGiftLedger implements GiftLedger {
  private storage: StorageGiftLedger;
  private useStorage = false;

  constructor(db: SupabaseClient) {
    this.storage = new StorageGiftLedger(db);
    this.db = db;
  }

  private readonly db: SupabaseClient;

  private async withFallback<T>(tableOp: () => Promise<T>, storageOp: () => Promise<T>): Promise<T> {
    if (this.useStorage) return storageOp();
    try {
      return await tableOp();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!missingRelation({ message })) throw error;
      this.useStorage = true;
      return storageOp();
    }
  }

  async countForCode(code: string): Promise<number> {
    return this.withFallback(async () => {
      const { count, error } = await this.db
        .from('gift_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('giver_code', normalizeGiftCode(code));
      if (error) throw new Error(`Gift count failed: ${error.message}`);
      return count ?? 0;
    }, () => this.storage.countForCode(code));
  }

  async alreadyRedeemed(code: string, recipientEmail: string): Promise<boolean> {
    return this.withFallback(async () => {
      const { data, error } = await this.db
        .from('gift_redemptions')
        .select('id')
        .eq('giver_code', normalizeGiftCode(code))
        .eq('recipient_email', normalizeEmail(recipientEmail))
        .maybeSingle();
      if (error) throw new Error(`Gift lookup failed: ${error.message}`);
      return Boolean(data);
    }, () => this.storage.alreadyRedeemed(code, recipientEmail));
  }

  async addRedemption(row: Omit<GiftRedemption, 'createdAt'>): Promise<void> {
    return this.withFallback(async () => {
      const { error } = await this.db.from('gift_redemptions').insert({
        giver_email: normalizeEmail(row.giverEmail),
        giver_code: normalizeGiftCode(row.giverCode),
        recipient_email: normalizeEmail(row.recipientEmail),
        months: row.months,
      });
      if (error) throw new Error(`Gift save failed: ${error.message}`);
    }, () => this.storage.addRedemption(row));
  }

  async pendingMonths(email: string): Promise<number> {
    return this.withFallback(async () => {
      const { data, error } = await this.db
        .from('pending_gift_months')
        .select('months')
        .eq('email', normalizeEmail(email))
        .maybeSingle();
      if (error) throw new Error(`Pending gift read failed: ${error.message}`);
      return Number(data?.months ?? 0);
    }, () => this.storage.pendingMonths(email));
  }

  async addPendingMonths(email: string, months: number): Promise<void> {
    return this.withFallback(async () => {
      const key = normalizeEmail(email);
      const current = await this.pendingMonths(key);
      const { error } = await this.db.from('pending_gift_months').upsert({
        email: key,
        months: current + months,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      if (error) throw new Error(`Pending gift save failed: ${error.message}`);
    }, () => this.storage.addPendingMonths(email, months));
  }

  async takePendingMonths(email: string): Promise<number> {
    return this.withFallback(async () => {
      const key = normalizeEmail(email);
      const months = await this.pendingMonths(key);
      if (months <= 0) return 0;
      const { error } = await this.db.from('pending_gift_months').delete().eq('email', key);
      if (error) throw new Error(`Pending gift clear failed: ${error.message}`);
      return months;
    }, () => this.storage.takePendingMonths(email));
  }
}

let cached: GiftLedger | undefined;

export function getGiftLedger(): GiftLedger {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) cached = new SupabaseGiftLedger(createClient(url, key, { auth: { persistSession: false } }));
  else cached = new MemoryGiftLedger();
  return cached;
}

export { GIFT_LIMIT, GIFT_MONTHS };
