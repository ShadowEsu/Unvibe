import { createClient } from '@supabase/supabase-js';
import { selectProvider } from '@/ai';
import {
  TRY_ALLOWED_ORIGINS,
  TRY_GLOBAL_PER_DAY,
  TRY_PER_IP_PER_HOUR,
  hashVisitor,
  trySystemPrompt,
  validateTry,
} from '@/lib/tryDemo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    ...(TRY_ALLOWED_ORIGINS.has(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

const memory = new Map<string, number[]>();

async function overLimit(visitor: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const [mine, all] = await Promise.all([
      db.from('try_requests').select('id', { count: 'exact', head: true }).eq('ip_hash', visitor).gte('created_at', hourAgo),
      db.from('try_requests').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
    ]);
    if ((mine.count ?? 0) >= TRY_PER_IP_PER_HOUR) return 'You have used the demo a lot this hour. Download Unvibe to keep going, it is free.';
    if ((all.count ?? 0) >= TRY_GLOBAL_PER_DAY) return 'The demo is busy today. Download Unvibe to try it on your own code, it is free.';
    await db.from('try_requests').insert({ ip_hash: visitor });
    return null;
  }
  const now = Date.now();
  const times = (memory.get(visitor) ?? []).filter((t) => now - t < 3_600_000);
  if (times.length >= TRY_PER_IP_PER_HOUR) return 'You have used the demo a lot this hour. Download Unvibe to keep going, it is free.';
  times.push(now);
  memory.set(visitor, times);
  return null;
}

export async function OPTIONS(req: Request): Promise<Response> {
  return new Response(null, { status: 204, headers: cors(req) });
}

export async function POST(req: Request): Promise<Response> {
  const headers = cors(req);
  const origin = req.headers.get('origin') ?? '';
  if (origin && !TRY_ALLOWED_ORIGINS.has(origin)) return Response.json({ error: 'Not allowed.' }, { status: 403, headers });
  if (Number(req.headers.get('content-length') ?? '0') > 6_000) return Response.json({ error: 'Too long for the demo.' }, { status: 413, headers });

  const checked = validateTry(await req.json().catch(() => null));
  if (!checked.ok) return Response.json({ error: checked.error }, { status: 400, headers });

  const provider = selectProvider();
  // Never pass off mock output as a real explanation.
  if (provider.mock) return Response.json({ error: 'The live demo is resting right now. Download Unvibe to try it on your code.' }, { status: 503, headers });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'local';
  const limited = await overLimit(hashVisitor(ip)).catch(() => null);
  if (limited) return Response.json({ error: limited }, { status: 429, headers });

  try {
    const text = await provider.complete(
      trySystemPrompt(checked.level),
      `Snippet to explain:\n\`\`\`\n${checked.code}\n\`\`\``,
      AbortSignal.timeout(25_000),
    );
    return Response.json({ ok: true, text: text.trim().slice(0, 2_000), level: checked.level }, { headers });
  } catch {
    return Response.json({ error: 'Vibe could not answer just now. Try again in a moment.' }, { status: 502, headers });
  }
}
