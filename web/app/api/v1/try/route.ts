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

  const resting = () => Response.json({ error: 'The live demo is resting right now. Download Unvibe to try it on your code.' }, { status: 503, headers });
  const provider = tryProvider();
  // Never pass off mock output as a real explanation.
  if (!provider || provider.mock) return resting();

  // No server secret to key the IP hash with (production): don't store an address hash anyone can reverse.
  const visitor = hashVisitor(clientIp(req));
  if (!visitor) return resting();

  const limited = await overLimit(visitor).catch(() => null);
  if (limited) return Response.json({ error: limited }, { status: 429, headers });

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
