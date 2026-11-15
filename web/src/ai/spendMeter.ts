import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { noStoreFetch } from '@/lib/serviceSupabase';
import { ProviderRejectedError, type Completion, type Provider, type TokenUsage } from './provider';

/**
 * Hard spend stops for the hosted AI (owner 2026-11-02, via BOSS; raised 2026-11-06 for the launch): the Anthropic
 * key may spend $50 per calendar month, and Unvibe's share is $35 per UTC calendar month (the rest stays with the
 * key's other users), with a $10 per UTC day guard so one bad day can't burn the month, and a $1 per UTC day share
 * per account so one account can't use up the day for everyone. Preston 2026-11-06: up to $40/week OK; Gemini key
 * comes when real usage grows. Counted on the database so every serverless instance shares one count.
 *
 * Each call reserves its worst case before the request leaves and settles afterwards from the usage
 * Anthropic measured. A call that failed or was cut off without measured usage keeps its whole
 * reservation, so nothing billed can go uncounted. Amounts are integer nano-dollars (1e-9 USD): the
 * per-token prices are whole numbers in that unit, so there are no float sums. The caps live here,
 * never in a request.
 */
export const SPEND_METER = 'anthropic';
/**
 * List prices per model in nano-dollars per token, from platform.claude.com/docs/en/about-claude/pricing
 * (read 2026-11-02): "Claude Opus 5.5 | $4 / MTok | $5 / MTok | $8 / MTok | $0.20 / MTok | $20 / MTok"
 * (base input, 5m cache writes, 1h cache writes, cache hits, output). Opus 5.5 has one price for its
 * whole context window, so there is no long-context tier. Cache writes are counted at the 1h price,
 * the dearest kind; cache hits are counted as plain input, which is above their real price. The app
 * sends no cache_control, so neither is expected. A model without a row here is never called: the
 * meter refuses it before anything is reserved or sent.
 */
export type ModelPrices = { input: number; output: number; cacheWrite: number };
export const MODEL_PRICES: Readonly<Record<string, ModelPrices>> = {
  'claude-opus-5-5': { input: 4_000, output: 20_000, cacheWrite: 8_000 },
};
/** Room for the Messages API's own framing tokens around the system prompt and the user turn. */
const FRAMING_TOKENS = 64;
export const DAY_CAP_NANO_USD = 10_000_000_000; // $10 per UTC day
export const MONTH_CAP_NANO_USD = 35_000_000_000; // $35 per UTC calendar month
export const ACCOUNT_DAY_CAP_NANO_USD = 1_000_000_000; // $1 per account per UTC day
/**
 * Quick look (the D5 previews; Security 2026-11-11, "PR 1: preview allowance"): a preview reserves and
 * settles inside the caps above like any call, and must also pass these two, counted apart
 * (`SpendStore.reserveKind`). Explanations never touch them, so they never draw on the preview budget.
 */
export const PREVIEW_DAY_CAP_NANO_USD = 2_000_000_000; // $2 of previews per UTC day, everyone together
export const PREVIEW_ACCOUNT_DAY_LIMIT = 20; // previews per account per UTC day

export const AI_LIMIT_TODAY = "AI limit reached for today. Explanations come back after midnight UTC.";
export const AI_LIMIT_MONTH = "AI limit reached for this month. Explanations come back on the 1st (UTC).";
export const AI_LIMIT_ACCOUNT = "Daily AI limit reached for your account. Explanations come back after midnight UTC.";
export const AI_PAUSED = 'AI is paused for now. Explanations will be back soon.';
export const AI_MAINTENANCE = 'AI features are paused for maintenance. Back soon.';
export const PREVIEW_LIMIT_TODAY = 'Quick looks are busy or used up for now. Open the full explanation instead, or try a quick look again later.';
export const PREVIEW_LIMIT_ACCOUNT = `You've used today's ${PREVIEW_ACCOUNT_DAY_LIMIT} quick looks. Open the full explanation instead; quick looks come back after midnight UTC.`;

/**
 * The outage switch (BOSS 31 Oct): AI_MAINTENANCE=1 on the API pauses every hosted AI call before
 * anything is reserved or sent, e.g. while a provider key is being replaced. Read per call, so an
 * env change plus a redeploy turns it on and off.
 */
export function aiMaintenance(): boolean {
  return process.env.AI_MAINTENANCE?.trim() === '1';
}

/** Thrown before any request leaves: a spend stop was reached, the meter could not count (fail closed), or maintenance. */
export class AiPausedError extends Error {
  constructor(readonly reason: SpendStop | 'unavailable' | 'maintenance') {
    super(
      reason === 'day_cap' ? AI_LIMIT_TODAY
        : reason === 'month_cap' ? AI_LIMIT_MONTH
          : reason === 'account_day_cap' ? AI_LIMIT_ACCOUNT
            : reason === 'maintenance' ? AI_MAINTENANCE
              : AI_PAUSED,
    );
    this.name = 'AiPausedError';
  }
}

/** A kind of call with its own allowance inside the caps. Explanations have none. */
export type SpendKind = 'ai_preview';
/** A kind's own stops: its day budget for everyone, or the account's daily count. */
export type KindStop = 'kind_day_cap' | 'kind_account_calls';

const KIND_LIMITS: Readonly<Record<SpendKind, { dayCapNanoUsd: number; accountDayCalls: number }>> = {
  ai_preview: { dayCapNanoUsd: PREVIEW_DAY_CAP_NANO_USD, accountDayCalls: PREVIEW_ACCOUNT_DAY_LIMIT },
};

/**
 * Thrown before any request leaves, and before the caps above are reserved: a preview's own allowance
 * is spent. Nothing is counted anywhere, so it never refuses or uses up an explanation.
 */
export class PreviewLimitError extends Error {
  constructor(readonly reason: KindStop) {
    super(reason === 'kind_day_cap' ? PREVIEW_LIMIT_TODAY : PREVIEW_LIMIT_ACCOUNT);
    this.name = 'PreviewLimitError';
  }
}

/** Thrown when the caller left while the meter was counting: nothing was sent, and both holds were given back. */
export class AbortedBeforeSendError extends Error {
  constructor() {
    super('The request was cancelled before it was sent.');
    this.name = 'AbortedBeforeSendError';
  }
}

/**
 * The meter's key for one account: a SHA-256 of a signed-in user id or a trial install key, so the
 * spend table never holds the id itself.
 */
export function spendAccount(kind: 'user' | 'install', id: string): string {
  return createHash('sha256').update(`unvibe-ai-spend:${kind}:${id}`).digest('hex');
}

/** The model's price row, or undefined for a model the meter has no prices for. */
export function pricesFor(model: string): ModelPrices | undefined {
  return Object.hasOwn(MODEL_PRICES, model) ? MODEL_PRICES[model] : undefined;
}

/** The most input tokens a prompt can be: Claude's tokenizer never makes more tokens than UTF-8 bytes. */
export function maxInputTokens(system: string, user: string): number {
  return Buffer.byteLength(system, 'utf8') + Buffer.byteLength(user, 'utf8') + FRAMING_TOKENS;
}

/** Worst-case cost of one call: the byte bound as input plus the full output budget. */
export function worstCaseNanoUsd(prices: ModelPrices, system: string, user: string, maxOutputTokens: number): number {
  return maxInputTokens(system, user) * prices.input + maxOutputTokens * prices.output;
}

/** Measured cost: the cache-write share of the input at the cache-write price, the rest at the input price. */
export function costNanoUsd(prices: ModelPrices, usage: TokenUsage): number {
  const writes = Math.min(usage.cacheWriteTokens ?? 0, usage.inputTokens);
  return (usage.inputTokens - writes) * prices.input + writes * prices.cacheWrite + usage.outputTokens * prices.output;
}

/** `account` is set when the call was counted against an account's daily share too. */
export type Reservation = { day: string; nanoUsd: number; account?: string };
/** A call counted against its kind's own allowance (`reserveKind`), always for an account. */
export type KindReservation = { kind: SpendKind; day: string; nanoUsd: number; account: string };

export type SpendStop = 'day_cap' | 'month_cap' | 'account_day_cap';

export interface SpendStore {
  /**
   * Counts `nanoUsd` against this UTC month, today and (with `account`) the account's today, or
   * refuses when any stop would be passed.
   */
  reserve(nanoUsd: number, account?: string): Promise<Reservation | SpendStop>;
  /** Adds `deltaNanoUsd` (negative when the measured cost came in under the reservation) to the reservation's day and account. */
  settle(reservation: Reservation, deltaNanoUsd: number): Promise<void>;
  /**
   * Counts one call and `nanoUsd` against `kind`'s own day budget and the account's daily count of
   * that kind, or refuses when either would be passed. Checks none of the caps above: the same call
   * reserves through `reserve` right after.
   */
  reserveKind(kind: SpendKind, nanoUsd: number, account: string): Promise<KindReservation | KindStop>;
  /** Adds `deltaNanoUsd` to the kind's day; with `release` (nothing was billed) also gives the call back to both counts. */
  settleKind(reservation: KindReservation, deltaNanoUsd: number, release: boolean): Promise<void>;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT = /^[0-9a-f]{64}$/;

/**
 * One RPC per reservation, which checks every stop and counts under one advisory lock:
 * `reserve_ai_spend_account` for an account (migration 20261102120000), `reserve_ai_spend_month`
 * for the website's Try box, which has no account (migration 20261102090000). A kind's own allowance
 * (previews) is one more RPC before that, `reserve_ai_spend_kind` (migration 20261111210000).
 */
export class SupabaseSpendStore implements SpendStore {
  private client: SupabaseClient | undefined;

  constructor(private readonly url: string, private readonly key: string) {}

  /** Built on first use: createClient throws on a malformed URL, and that must pause AI, not crash the route. */
  private get db() {
    this.client ??= createClient(this.url, this.key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: noStoreFetch } });
    return this.client;
  }

  async reserve(nanoUsd: number, account?: string): Promise<Reservation | SpendStop> {
    if (account !== undefined && !ACCOUNT.test(account)) throw new Error('invalid spend account');
    const fn = account === undefined ? 'reserve_ai_spend_month' : 'reserve_ai_spend_account';
    const caps = { p_nano_usd: nanoUsd, p_day_cap: DAY_CAP_NANO_USD, p_month_cap: MONTH_CAP_NANO_USD };
    const { data, error } = await this.db.rpc(fn, account === undefined
      ? { p_meter: SPEND_METER, ...caps }
      : { p_meter: SPEND_METER, p_account_hash: account, ...caps, p_account_day_cap: ACCOUNT_DAY_CAP_NANO_USD });
    if (error) throw new Error(`${fn} failed: ${error.code ?? 'unknown'}`);
    const row = (Array.isArray(data) ? data[0] : data) as { status?: unknown; day?: unknown } | null;
    if (row?.status === 'day_cap' || row?.status === 'month_cap') return row.status;
    if (account !== undefined && row?.status === 'account_day_cap') return row.status;
    if (row?.status === 'ok' && typeof row.day === 'string' && DAY.test(row.day)) {
      return account === undefined ? { day: row.day, nanoUsd } : { day: row.day, nanoUsd, account };
    }
    throw new Error(`${fn} returned an unexpected answer`);
  }

  async settle(reservation: Reservation, deltaNanoUsd: number): Promise<void> {
    const { day, account } = reservation;
    const fn = account === undefined ? 'settle_ai_spend' : 'settle_ai_spend_account';
    const { error } = await this.db.rpc(fn, account === undefined
      ? { p_meter: SPEND_METER, p_day: day, p_delta_nano_usd: deltaNanoUsd }
      : { p_meter: SPEND_METER, p_day: day, p_account_hash: account, p_delta_nano_usd: deltaNanoUsd });
    if (error) throw new Error(`${fn} failed: ${error.code ?? 'unknown'}`);
  }

  async reserveKind(kind: SpendKind, nanoUsd: number, account: string): Promise<KindReservation | KindStop> {
    if (!ACCOUNT.test(account)) throw new Error('invalid spend account');
    const limits = KIND_LIMITS[kind];
    const { data, error } = await this.db.rpc('reserve_ai_spend_kind', {
      p_meter: SPEND_METER,
      p_kind: kind,
      p_account_hash: account,
      p_nano_usd: nanoUsd,
      p_kind_day_cap: limits.dayCapNanoUsd,
      p_account_day_calls: limits.accountDayCalls,
    });
    if (error) throw new Error(`reserve_ai_spend_kind failed: ${error.code ?? 'unknown'}`);
    const row = (Array.isArray(data) ? data[0] : data) as { status?: unknown; day?: unknown } | null;
    if (row?.status === 'kind_day_cap' || row?.status === 'kind_account_calls') return row.status;
    if (row?.status === 'ok' && typeof row.day === 'string' && DAY.test(row.day)) return { kind, day: row.day, nanoUsd, account };
    throw new Error('reserve_ai_spend_kind returned an unexpected answer');
  }

  async settleKind(reservation: KindReservation, deltaNanoUsd: number, release: boolean): Promise<void> {
    const { kind, day, account } = reservation;
    const { error } = await this.db.rpc('settle_ai_spend_kind', {
      p_meter: SPEND_METER,
      p_kind: kind,
      p_day: day,
      p_account_hash: account,
      p_delta_nano_usd: deltaNanoUsd,
      p_release: release,
    });
    if (error) throw new Error(`settle_ai_spend_kind failed: ${error.code ?? 'unknown'}`);
  }
}

/** Development and tests only: the same stops in process memory. Production never uses it. */
export class MemorySpendStore implements SpendStore {
  readonly days = new Map<string, number>();
  /** Per account per day, keyed `${day} ${account}`. */
  readonly accounts = new Map<string, number>();
  /** A kind's spend per day, keyed `${kind} ${day}`. */
  readonly kindDays = new Map<string, number>();
  /** A kind's calls per account per day, keyed `${kind} ${day} ${account}`. */
  readonly kindAccounts = new Map<string, number>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async reserve(nanoUsd: number, account?: string): Promise<Reservation | SpendStop> {
    const day = this.now().toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const today = this.days.get(day) ?? 0;
    const thisMonth = [...this.days].reduce((sum, [d, v]) => (d.startsWith(month) ? sum + v : sum), 0);
    if (thisMonth + nanoUsd > MONTH_CAP_NANO_USD) return 'month_cap';
    if (today + nanoUsd > DAY_CAP_NANO_USD) return 'day_cap';
    const key = `${day} ${account}`;
    const accountToday = account === undefined ? 0 : this.accounts.get(key) ?? 0;
    if (account !== undefined && accountToday + nanoUsd > ACCOUNT_DAY_CAP_NANO_USD) return 'account_day_cap';
    this.days.set(day, today + nanoUsd);
    if (account === undefined) return { day, nanoUsd };
    this.accounts.set(key, accountToday + nanoUsd);
    return { day, nanoUsd, account };
  }

  async settle(reservation: Reservation, deltaNanoUsd: number): Promise<void> {
    const { day, account } = reservation;
    this.days.set(day, Math.max(0, (this.days.get(day) ?? 0) + deltaNanoUsd));
    if (account === undefined) return;
    const key = `${day} ${account}`;
    this.accounts.set(key, Math.max(0, (this.accounts.get(key) ?? 0) + deltaNanoUsd));
  }

  async reserveKind(kind: SpendKind, nanoUsd: number, account: string): Promise<KindReservation | KindStop> {
    const day = this.now().toISOString().slice(0, 10);
    const limits = KIND_LIMITS[kind];
    const dayKey = `${kind} ${day}`;
    const accountKey = `${kind} ${day} ${account}`;
    const today = this.kindDays.get(dayKey) ?? 0;
    const calls = this.kindAccounts.get(accountKey) ?? 0;
    if (today + nanoUsd > limits.dayCapNanoUsd) return 'kind_day_cap';
    if (calls + 1 > limits.accountDayCalls) return 'kind_account_calls';
    this.kindDays.set(dayKey, today + nanoUsd);
    this.kindAccounts.set(accountKey, calls + 1);
    return { kind, day, nanoUsd, account };
  }

  async settleKind(reservation: KindReservation, deltaNanoUsd: number, release: boolean): Promise<void> {
    const { kind, day, account } = reservation;
    const dayKey = `${kind} ${day}`;
    this.kindDays.set(dayKey, Math.max(0, (this.kindDays.get(dayKey) ?? 0) + deltaNanoUsd));
    if (!release) return;
    const accountKey = `${kind} ${day} ${account}`;
    this.kindAccounts.set(accountKey, Math.max(0, (this.kindAccounts.get(accountKey) ?? 0) - 1));
  }
}

/** The store for this environment, or null in production without one (every call is then refused). */
export function spendStore(): SpendStore | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) return new SupabaseSpendStore(url, key);
  if (process.env.NODE_ENV === 'production') return null;
  const g = globalThis as unknown as { __unvibeSpendMemory?: MemorySpendStore };
  g.__unvibeSpendMemory ??= new MemorySpendStore();
  return g.__unvibeSpendMemory;
}

/** A provider whose calls carry a measured or an explicitly estimated cost, for one priced model. */
export interface MeterableProvider extends Provider {
  /** Keys MODEL_PRICES; the same value the provider sends as the request's model. */
  readonly model: string;
  readonly maxOutputTokens: number;
}

/**
 * Wraps the real provider so no call starts without a reservation. Past a stop, when the store
 * can't answer, or for a model without prices, it throws `AiPausedError` and the provider is never
 * called (no fallback provider). With `account` (from `spendAccount`), each call also counts
 * against that account's daily share. With `kind` (previews), each call must first pass that kind's
 * own allowance (`PreviewLimitError` when it is spent, before the caps are touched), then reserves
 * through the caps exactly like any other call; both settle together.
 */
export class MeteredProvider implements Provider {
  readonly name: string;
  readonly mock = false;

  constructor(
    private readonly inner: MeterableProvider,
    private readonly store: SpendStore | null,
    private readonly account?: string,
    private readonly kind?: SpendKind,
  ) {
    this.name = inner.name;
  }

  stream(system: string, user: string, onToken: (text: string) => void, signal?: AbortSignal): Promise<TokenUsage | undefined> {
    return this.metered(system, user, signal, async () => {
      let produced = false;
      const usage = await this.inner.stream(system, user, (text) => {
        if (text.trim()) produced = true;
        onToken(text);
      }, signal);
      return { result: usage, usage, produced };
    });
  }

  complete(system: string, user: string, signal?: AbortSignal): Promise<Completion> {
    return this.metered(system, user, signal, async () => {
      const completion = await this.inner.complete(system, user, signal);
      return { result: completion, usage: completion.usage, produced: completion.text.trim() !== '' };
    });
  }

  private async metered<T>(
    system: string,
    user: string,
    signal: AbortSignal | undefined,
    call: () => Promise<{ result: T; usage: TokenUsage | undefined; produced: boolean }>,
  ): Promise<T> {
    if (aiMaintenance()) throw new AiPausedError('maintenance');
    const prices = pricesFor(this.inner.model);
    if (!prices) {
      console.error('ai spend: no prices for the model, refusing');
      throw new AiPausedError('unavailable');
    }
    if (!this.store) throw new AiPausedError('unavailable');
    const worst = worstCaseNanoUsd(prices, system, user, this.inner.maxOutputTokens);
    const hold = this.kind === undefined ? undefined : await this.reserveKind(this.kind, worst);
    let reservation: Reservation | SpendStop;
    try {
      reservation = await this.store.reserve(worst, this.account);
    } catch (error) {
      console.error('ai spend reserve failed', error instanceof Error ? error.message : 'unknown');
      if (hold) await this.adjustKind(hold, -hold.nanoUsd, true);
      throw new AiPausedError('unavailable');
    }
    if (typeof reservation === 'string') {
      // Nothing is sent, so the kind's allowance gets the call back.
      if (hold) await this.adjustKind(hold, -hold.nanoUsd, true);
      throw new AiPausedError(reservation);
    }
    if (signal?.aborted) {
      // The caller left while the meter was counting: nothing is sent, so nothing stays counted.
      await this.adjust(reservation, -reservation.nanoUsd);
      if (hold) await this.adjustKind(hold, -hold.nanoUsd, true);
      throw new AbortedBeforeSendError();
    }

    // From here the request may be billed. Only usage Anthropic measured replaces the worst case,
    // and only an error status it answered with (not billed) releases it. A dropped connection or a
    // cut stream keeps the whole worst case. A kind's hold moves with it, and an answer with no text
    // gives the kind's call back (its measured cost stays counted), as an empty explanation gives back
    // its plan unit.
    let outcome: { result: T; usage: TokenUsage | undefined; produced: boolean };
    try {
      outcome = await call();
    } catch (error) {
      if (error instanceof ProviderRejectedError) {
        await this.adjust(reservation, -reservation.nanoUsd);
        if (hold) await this.adjustKind(hold, -hold.nanoUsd, true);
      }
      throw error;
    }
    const { result, usage, produced } = outcome;
    const delta = usage && !usage.estimated ? costNanoUsd(prices, usage) - reservation.nanoUsd : undefined;
    if (delta !== undefined) await this.adjust(reservation, delta);
    if (hold && (delta !== undefined || !produced)) await this.adjustKind(hold, delta ?? 0, !produced);
    return result;
  }

  /** The kind's own allowance, before the caps: refused means nothing is counted anywhere and nothing is sent. */
  private async reserveKind(kind: SpendKind, worst: number): Promise<KindReservation> {
    // A kind's allowance is per account; a call without one has nothing to count against.
    if (this.account === undefined || !this.store) throw new AiPausedError('unavailable');
    let hold: KindReservation | KindStop;
    try {
      hold = await this.store.reserveKind(kind, worst, this.account);
    } catch (error) {
      console.error('ai spend kind reserve failed', error instanceof Error ? error.message : 'unknown');
      throw new AiPausedError('unavailable');
    }
    if (typeof hold === 'string') throw new PreviewLimitError(hold);
    return hold;
  }

  private async adjust(reservation: Reservation, deltaNanoUsd: number): Promise<void> {
    if (!this.store) return;
    await this.store.settle(reservation, deltaNanoUsd).catch((error: unknown) => {
      // The worst case stays counted, which is the safe side.
      console.error('ai spend settle failed', error instanceof Error ? error.message : 'unknown');
    });
  }

  private async adjustKind(reservation: KindReservation, deltaNanoUsd: number, release: boolean): Promise<void> {
    if (!this.store) return;
    await this.store.settleKind(reservation, deltaNanoUsd, release).catch((error: unknown) => {
      // The hold (and the call) stays counted, which is the safe side.
      console.error('ai spend kind settle failed', error instanceof Error ? error.message : 'unknown');
    });
  }
}
