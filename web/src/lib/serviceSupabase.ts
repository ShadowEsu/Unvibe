/**
 * Server-only Supabase client using the service-role key (trial counters, activation markers,
 * admin stats). Returns null when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are unset (dev/tests),
 * so callers can fall back to process memory.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Next.js caches server fetch() calls across requests and deployments, POSTs included in GET route
 * handlers (supabase-js sends RPCs as POST). Every server-side Supabase client passes this, so reads
 * and RPCs always reach the database: on 2 Nov the GET billing overview route served a cached
 * billing_overview answer whose workspace had since been deleted (400 on the app's Plan tab).
 */
export const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

let cached: { url: string; key: string; client: SupabaseClient } | null = null;

export function serviceSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (cached?.url !== url || cached.key !== key) {
    cached = {
      url,
      key,
      client: createClient(url, key, {
        auth: { persistSession: false },
        // Counters and limits must always read live rows, or a stale cached count would let a user past the free limit.
        global: { fetch: noStoreFetch },
      }),
    };
  }
  return cached.client;
}
