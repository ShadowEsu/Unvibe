import type { Store } from './types';
import { MemoryStore } from './memoryStore';
import { SupabaseStore } from './supabaseStore';

let cached: Store | undefined;

/** Supabase in production (when configured), else the labelled dev MemoryStore. */
export function getStore(): Store {
  if (cached) {
    return cached;
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  cached = url && key ? new SupabaseStore(url, key) : new MemoryStore();
  return cached;
}

export type { Store } from './types';
