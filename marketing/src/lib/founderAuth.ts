import { createClient } from "@supabase/supabase-js";

function supabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && key ? { url, key } : null;
}

function allowedFounderEmails(): Set<string> {
  return new Set(
    (process.env.FOUNDER_EMAILS || process.env.FOUNDER_EMAIL || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function verifyFounderRequest(request: Request): Promise<boolean> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const config = supabaseConfig();
  const allowed = allowedFounderEmails();
  if (!token || !config || allowed.size === 0) return false;
  const client = createClient(config.url, config.key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  const email = data.user?.email?.trim().toLowerCase();
  return !error && Boolean(email && allowed.has(email));
}
