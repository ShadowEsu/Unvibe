import type { BillingStore } from './types';
import { MemoryBillingStore, type MemoryUsageSeed } from './memoryBillingStore';
import { SupabaseBillingStore } from './supabaseBillingStore';

let cached: BillingStore | undefined;

/**
 * UNVIBE_TEST_USAGE_SEED=<plan>:<used> (QA only, for example `pro:199` or `enterprise:999`): every
 * personal workspace the memory store creates starts on that plan with that many explanations
 * already used this month. Refused on the production deployment and with any persistent store.
 */
function parseUsageSeed(value: string): MemoryUsageSeed {
  const match = /^(free|pro|enterprise|business):(\d{1,7})$/.exec(value);
  if (!match) throw new Error('UNVIBE_TEST_USAGE_SEED must be <plan>:<used>, with plan free, pro, enterprise or business.');
  return { plan: match[1] as MemoryUsageSeed['plan'], used: Number(match[2]) };
}

export function createBillingStoreFromEnv(env: NodeJS.ProcessEnv = process.env): BillingStore {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const seed = env.UNVIBE_TEST_USAGE_SEED;
  if (seed !== undefined && seed !== '') {
    if (env.VERCEL_ENV === 'production') throw new Error('UNVIBE_TEST_USAGE_SEED is refused on the production deployment.');
    if (url || key) throw new Error('UNVIBE_TEST_USAGE_SEED works only with the memory billing store, never with Supabase.');
  }
  if (Boolean(url) !== Boolean(key)) throw new Error('Billing persistence requires both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  if (url && key) return new SupabaseBillingStore(url, key);
  if (env.NODE_ENV === 'production' && env.UNCODE_ALLOW_MEMORY_STORE !== 'true') {
    throw new Error('Billing persistence is not configured. Memory storage is disabled in production.');
  }
  return new MemoryBillingStore(undefined, seed ? parseUsageSeed(seed) : undefined);
}

export function getBillingStore(): BillingStore {
  cached ??= createBillingStoreFromEnv();
  return cached;
}

export function resetBillingStoreCacheForTests(): void {
  cached = undefined;
}
