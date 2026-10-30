import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ProviderRejectedError, type Completion, type Provider, type TokenUsage } from './provider';

/**
 * Hard spend stops for the hosted AI (BOSS ledger 339, caps confirmed by Money 2026-10-29):
 * $1 per UTC day and $20 in total, on the database so every serverless instance shares one count.
 *
 * Each call reserves its worst case before the request leaves and settles afterwards from the usage
 * Anthropic measured. A call that failed or was cut off without measured usage keeps its whole
 * reservation, so nothing billed can go uncounted. Amounts are integer nano-dollars (1e-9 USD): the
 * per-token prices are whole numbers in that unit, so there are no float sums. The caps live here,
 * never in a request.
 */
export const SPEND_METER = 'anthropic';
/**
 * Claude Haiku 5.5 list prices (platform.claude.com pricing, Money 2026-10-29): $0.10 / $0.50 per
 * 1M input / output tokens, and $0.50 / $2.50 for the whole request once its input passes 100,000
 * tokens. Cache reads and writes are counted as input at the same tier price, which is never less
 * than their real price; the app sends no cache_control.
 */
export const NANO_USD_PER_INPUT_TOKEN = 100;
export const NANO_USD_PER_OUTPUT_TOKEN = 500;
export const LONG_CONTEXT_INPUT_TOKENS = 100_000;
export const LONG_NANO_USD_PER_INPUT_TOKEN = 500;
export const LONG_NANO_USD_PER_OUTPUT_TOKEN = 2_500;
/** Room for the Messages API's own framing tokens around the system prompt and the user turn. */
const FRAMING_TOKENS = 64;
export const DAY_CAP_NANO_USD = 1_000_000_000; // $1 per UTC day
export const TOTAL_CAP_NANO_USD = 20_000_000_000; // $20, never resets

export const AI_PAUSED_TODAY = 'AI is paused for today. Explanations come back after midnight UTC.';
export const AI_PAUSED = 'AI is paused for now. Explanations will be back soon.';

/** Thrown before any request leaves: the meter refused, or could not count (fail closed). */
export class AiPausedError extends Error {
  constructor(readonly reason: 'day_cap' | 'total_cap' | 'unavailable') {
    super(reason === 'day_cap' ? AI_PAUSED_TODAY : AI_PAUSED);
    this.name = 'AiPausedError';
  }
}

/** The price of `inputTokens` in and `outputTokens` out, at the tier the input puts the whole request in. */
function priceNanoUsd(inputTokens: number, outputTokens: number): number {
  const long = inputTokens > LONG_CONTEXT_INPUT_TOKENS;
  return inputTokens * (long ? LONG_NANO_USD_PER_INPUT_TOKEN : NANO_USD_PER_INPUT_TOKEN)
    + outputTokens * (long ? LONG_NANO_USD_PER_OUTPUT_TOKEN : NANO_USD_PER_OUTPUT_TOKEN);
}

/** The most input tokens a prompt can be: Claude's tokenizer never makes more tokens than UTF-8 bytes. */
export function maxInputTokens(system: string, user: string): number {
  return Buffer.byteLength(system, 'utf8') + Buffer.byteLength(user, 'utf8') + FRAMING_TOKENS;
}

/** Worst-case cost of one call: the byte bound as input plus the full output budget, at its tier. */
export function worstCaseNanoUsd(system: string, user: string, maxOutputTokens: number): number {
  return priceNanoUsd(maxInputTokens(system, user), maxOutputTokens);
}

export function costNanoUsd(usage: TokenUsage): number {
  return priceNanoUsd(usage.inputTokens, usage.outputTokens);
}

export type Reservation = { day: string; nanoUsd: number };

export interface SpendStore {
  /** Counts `nanoUsd` against today and the total, or refuses when either stop would be passed. */
  reserve(nanoUsd: number): Promise<Reservation | 'day_cap' | 'total_cap'>;
  /** Adds `deltaNanoUsd` (negative when the measured cost came in under the reservation) to `day`. */
  settle(day: string, deltaNanoUsd: number): Promise<void>;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One call to `reserve_ai_spend`, which checks both stops and counts under one advisory lock (migration 20261029100000). */
export class SupabaseSpendStore implements SpendStore {
  private client: SupabaseClient | undefined;

  constructor(private readonly url: string, private readonly key: string) {}

  /** Built on first use: createClient throws on a malformed URL, and that must pause AI, not crash the route. */
  private get db() {
    this.client ??= createClient(this.url, this.key, { auth: { persistSession: false, autoRefreshToken: false } });
    return this.client;
  }

  async reserve(nanoUsd: number): Promise<Reservation | 'day_cap' | 'total_cap'> {
    const { data, error } = await this.db.rpc('reserve_ai_spend', {
      p_meter: SPEND_METER,
      p_nano_usd: nanoUsd,
      p_day_cap: DAY_CAP_NANO_USD,
      p_total_cap: TOTAL_CAP_NANO_USD,
    });
    if (error) throw new Error(`reserve_ai_spend failed: ${error.code ?? 'unknown'}`);
    const row = (Array.isArray(data) ? data[0] : data) as { status?: unknown; day?: unknown } | null;
    if (row?.status === 'day_cap' || row?.status === 'total_cap') return row.status;
    if (row?.status === 'ok' && typeof row.day === 'string' && DAY.test(row.day)) return { day: row.day, nanoUsd };
    throw new Error('reserve_ai_spend returned an unexpected answer');
  }

  async settle(day: string, deltaNanoUsd: number): Promise<void> {
    const { error } = await this.db.rpc('settle_ai_spend', { p_meter: SPEND_METER, p_day: day, p_delta_nano_usd: deltaNanoUsd });
    if (error) throw new Error(`settle_ai_spend failed: ${error.code ?? 'unknown'}`);
  }
}

/** Development and tests only: the same stops in process memory. Production never uses it. */
export class MemorySpendStore implements SpendStore {
  readonly days = new Map<string, number>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async reserve(nanoUsd: number): Promise<Reservation | 'day_cap' | 'total_cap'> {
    const day = this.now().toISOString().slice(0, 10);
    const today = this.days.get(day) ?? 0;
    const total = [...this.days.values()].reduce((sum, v) => sum + v, 0);
    if (total + nanoUsd > TOTAL_CAP_NANO_USD) return 'total_cap';
    if (today + nanoUsd > DAY_CAP_NANO_USD) return 'day_cap';
    this.days.set(day, today + nanoUsd);
    return { day, nanoUsd };
  }

  async settle(day: string, deltaNanoUsd: number): Promise<void> {
    this.days.set(day, Math.max(0, (this.days.get(day) ?? 0) + deltaNanoUsd));
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

/** A provider whose calls carry a measured or an explicitly estimated cost. */
export interface MeterableProvider extends Provider {
  readonly maxOutputTokens: number;
}

/**
 * Wraps the real provider so no call starts without a reservation. Past a stop, or when the store
 * can't answer, it throws `AiPausedError` and the provider is never called (no fallback provider).
 */
export class MeteredProvider implements Provider {
  readonly name: string;
  readonly mock = false;

  constructor(private readonly inner: MeterableProvider, private readonly store: SpendStore | null) {
    this.name = inner.name;
  }

  stream(system: string, user: string, onToken: (text: string) => void, signal?: AbortSignal): Promise<TokenUsage | undefined> {
    return this.metered(system, user, async () => {
      const usage = await this.inner.stream(system, user, onToken, signal);
      return { result: usage, usage };
    });
  }

  complete(system: string, user: string, signal?: AbortSignal): Promise<Completion> {
    return this.metered(system, user, async () => {
      const completion = await this.inner.complete(system, user, signal);
      return { result: completion, usage: completion.usage };
    });
  }

  private async metered<T>(system: string, user: string, call: () => Promise<{ result: T; usage: TokenUsage | undefined }>): Promise<T> {
    if (!this.store) throw new AiPausedError('unavailable');
    const worst = worstCaseNanoUsd(system, user, this.inner.maxOutputTokens);
    let reservation: Reservation | 'day_cap' | 'total_cap';
    try {
      reservation = await this.store.reserve(worst);
    } catch (error) {
      console.error('ai spend reserve failed', error instanceof Error ? error.message : 'unknown');
      throw new AiPausedError('unavailable');
    }
    if (reservation === 'day_cap' || reservation === 'total_cap') throw new AiPausedError(reservation);

    // From here the request may be billed. Only usage Anthropic measured replaces the worst case,
    // and only an error status it answered with (not billed) releases it. A dropped connection or a
    // cut stream keeps the whole worst case.
    let outcome: { result: T; usage: TokenUsage | undefined };
    try {
      outcome = await call();
    } catch (error) {
      if (error instanceof ProviderRejectedError) await this.adjust(reservation, -reservation.nanoUsd);
      throw error;
    }
    const { result, usage } = outcome;
    if (usage && !usage.estimated) await this.adjust(reservation, costNanoUsd(usage) - reservation.nanoUsd);
    return result;
  }

  private async adjust(reservation: Reservation, deltaNanoUsd: number): Promise<void> {
    if (!this.store) return;
    await this.store.settle(reservation.day, deltaNanoUsd).catch((error: unknown) => {
      // The worst case stays counted, which is the safe side.
      console.error('ai spend settle failed', error instanceof Error ? error.message : 'unknown');
    });
  }
}
