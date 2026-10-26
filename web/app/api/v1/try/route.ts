import { createClient } from '@supabase/supabase-js';
import type { Provider } from '@/ai';
import { GeminiProvider } from '@/ai/gemini';
import { MockProvider } from '@/ai/mock';
import {
  TRY_ALLOWED_ORIGINS,
  TRY_GLOBAL_PER_DAY,
  TRY_PER_IP_PER_HOUR,
  clientIp,
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

/**
 * The site says pasted code goes to Unvibe and Google Gemini, so Try it never uses the env-order
 * fallback in `selectProvider`: Gemini only, or the labelled mock outside production when
 * ENABLE_MOCK_AI is on. No Gemini key means no provider (503), never another one.
 */
function tryProvider(): Provider | null {
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_AI === 'true') return new MockProvider();
  const gemini = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  return gemini ? new GeminiProvider(gemini) : null;
}

type Refusal = { status: 429 | 503; error: string };

const UNAVAILABLE: Refusal = { status: 503, error: 'The live demo is resting right now. Download Unvibe to try it on your code.' };
const HOUR_CAP: Refusal = { status: 429, error: 'You have used the demo a lot this hour. Download Unvibe to keep going, it is free.' };
const DAY_CAP: Refusal = { status: 429, error: 'The demo is busy today. Download Unvibe to try it on your own code, it is free.' };

/** Dev and test only: request times per visitor, and for everyone, kept in process memory. */
function memory(): { visitors: Map<string, number[]>; all: number[] } {
  const g = globalThis as unknown as { __unvibeTryMemory?: { visitors: Map<string, number[]>; all: number[] } };
  g.__unvibeTryMemory ??= { visitors: new Map(), all: [] };
  return g.__unvibeTryMemory;
}

/**
 * Counts this visitor's requests in the last hour and everyone's in the last day, then records this one.
 * Returns null only when the request is under both caps and was recorded. Any store error, a count the
 * store didn't return (a missing table answers a head count with no count), or a failed insert is a 503,
 * so a broken store never means no limit. Production never falls back to process memory.
 */
async function reserveTry(visitor: string): Promise<Refusal | null> {
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
    if (mine.error || all.error || typeof mine.count !== 'number' || typeof all.count !== 'number') return UNAVAILABLE;
    if (mine.count >= TRY_PER_IP_PER_HOUR) return HOUR_CAP;
    if (all.count >= TRY_GLOBAL_PER_DAY) return DAY_CAP;
    const { error } = await db.from('try_requests').insert({ ip_hash: visitor });
    return error ? UNAVAILABLE : null;
  }
  if (process.env.NODE_ENV === 'production') return UNAVAILABLE;
  const now = Date.now();
  const store = memory();
  const times = (store.visitors.get(visitor) ?? []).filter((t) => now - t < 3_600_000);
  store.all = store.all.filter((t) => now - t < 86_400_000);
  if (times.length >= TRY_PER_IP_PER_HOUR) return HOUR_CAP;
  if (store.all.length >= TRY_GLOBAL_PER_DAY) return DAY_CAP;
  times.push(now);
  store.visitors.set(visitor, times);
  store.all.push(now);
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

  const refuse = ({ status, error }: Refusal) => Response.json({ error }, { status, headers });
  const provider = tryProvider();
  // Never pass off mock output as a real explanation.
  if (!provider || provider.mock) return refuse(UNAVAILABLE);

  // No server secret to key the IP hash with (production): don't store an address hash anyone can reverse.
  const visitor = hashVisitor(clientIp(req));
  if (!visitor) return refuse(UNAVAILABLE);

  // A limiter that throws is a limiter that didn't count: refuse before any model call.
  const refusal = await reserveTry(visitor).catch(() => UNAVAILABLE);
  if (refusal) return refuse(refusal);

  try {
    // The website demo has its own caps and no account or install to attach counts to.
    const { text } = await provider.complete(
      trySystemPrompt(checked.level),
      `Snippet to explain:\n\`\`\`\n${checked.code}\n\`\`\``,
      AbortSignal.timeout(25_000),
    );
    return Response.json({ ok: true, text: text.trim().slice(0, 2_000), level: checked.level }, { headers });
  } catch {
    return Response.json({ error: 'Vibe could not answer just now. Try again in a moment.' }, { status: 502, headers });
  }
}
