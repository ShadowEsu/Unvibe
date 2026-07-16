import type { Store } from './types';
import { MemoryStore } from './memoryStore';
import { SupabaseStore } from './supabaseStore';

let cached: Store | undefined;

/** Resolve persistence without ever silently selecting volatile storage in production. */
export function createStoreFromEnv(env: NodeJS.ProcessEnv = process.env): Store {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (Boolean(url) !== Boolean(key)) {
    throw new Error('Persistent storage is partially configured. Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (url && key) {
    return new SupabaseStore(url, key);
  }
  if (env.NODE_ENV === 'production' && env.UNCODE_ALLOW_MEMORY_STORE !== 'true') {
    throw new Error('Persistent storage is not configured. MemoryStore is disabled in production.');
  }
  return new MemoryStore();
}

export function getStore(): Store {
  cached ??= createStoreFromEnv();
  return cached;
}

export type { Store } from './types';
