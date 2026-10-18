/**
 * Server-only Supabase client using the service-role key (trial counters, activation markers,
 * admin stats). Returns null when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are unset (dev/tests),
 * so callers can fall back to process memory.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: { url: string; key: string; client: SupabaseClient } | null = null;

export function serviceSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (cached?.url !== url || cached.key !== key) {
    cached = { url, key, client: createClient(url, key, { auth: { persistSession: false } }) };
  }
  return cached.client;
}
