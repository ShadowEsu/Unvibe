import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The site's Supabase sign-in (Google or an email link, PKCE), shared by /activate and /redeem.
 * Uses only the public URL and the publishable (or anon) key.
 */

export function publicSupabase(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && key ? { url, key } : null;
}

/**
 * `detectSessionInUrl: false` leaves `?code=` to the page: /redeem uses that parameter for promo
 * codes too, and exchanges only a value that is a sign-in code.
 */
export function siteAuthClient(config: { url: string; key: string }, detectSessionInUrl = true): SupabaseClient {
  return createClient(config.url, config.key, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
