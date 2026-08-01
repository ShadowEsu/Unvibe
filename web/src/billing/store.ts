import type { BillingStore } from './types';
import { MemoryBillingStore } from './memoryBillingStore';
import { SupabaseBillingStore } from './supabaseBillingStore';

let cached: BillingStore | undefined;

export function createBillingStoreFromEnv(env: NodeJS.ProcessEnv = process.env): BillingStore {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (Boolean(url) !== Boolean(key)) throw new Error('Billing persistence requires both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  if (url && key) return new SupabaseBillingStore(url, key);
  if (env.NODE_ENV === 'production' && env.UNCODE_ALLOW_MEMORY_STORE !== 'true') {
    throw new Error('Billing persistence is not configured. Memory storage is disabled in production.');
  }
  return new MemoryBillingStore();
}

export function getBillingStore(): BillingStore {
  cached ??= createBillingStoreFromEnv();
  return cached;
}
