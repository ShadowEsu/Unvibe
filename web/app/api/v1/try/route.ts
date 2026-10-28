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
import { openRoom, roomBucket } from '@/lib/tryRooms';

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
const ROOM_HOUR_CAP: Refusal = { status: 429, error: 'This room has used the demo a lot this hour. Download Unvibe to keep going, it is free.' };

/** Dev and test only: request times per visitor, and for everyone, kept in process memory. */
function memory(): { visitors: Map<string, number[]>; all: number[] } {
  const g = globalThis as unknown as { __unvibeTryMemory?: { visitors: Map<string, number[]>; all: number[] } };
  g.__unvibeTryMemory ??= { visitors: new Map(), all: [] };
  return g.__unvibeTryMemory;
}

/**
 * Records this request if its bucket (a visitor, or an open room) is under `hourCap` and everyone is
 * under the daily cap. In the store this is one call to `reserve_try_request`, which counts and
 * inserts under one advisory lock, so a concurrent burst can't all read the same count (migration
 * 20261028090000). Returns null only when the function answered `ok`; `hour_cap` and `day_cap` are
 * 429s, and an error, a null or any other answer is a 503, so a broken store never means no limit.
 * Production never falls back to process memory.
 */
async function reserveTry(bucket: string, hourCap: number, hourRefusal: Refusal): Promise<Refusal | null> {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await db.rpc('reserve_try_request', {
      p_ip_hash: bucket,
      p_ip_cap: hourCap,
      p_day_cap: TRY_GLOBAL_PER_DAY,
    });
    if (error) return UNAVAILABLE;
    switch (data) {
      case 'ok':
        return null;
      case 'hour_cap':
        return hourRefusal;
      case 'day_cap':
        return DAY_CAP;
      default:
        return UNAVAILABLE;
    }
  }
  if (process.env.NODE_ENV === 'production') return UNAVAILABLE;
  const now = Date.now();
  const store = memory();
  const times = (store.visitors.get(bucket) ?? []).filter((t) => now - t < 3_600_000);
  store.all = store.all.filter((t) => now - t < 86_400_000);
  if (times.length >= hourCap) return hourRefusal;
  if (store.all.length >= TRY_GLOBAL_PER_DAY) return DAY_CAP;
  times.push(now);
  store.visitors.set(bucket, times);
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

  const body: unknown = await req.json().catch(() => null);
  const checked = validateTry(body);
  if (!checked.ok) return Response.json({ error: checked.error }, { status: 400, headers });

  const refuse = ({ status, error }: Refusal) => Response.json({ error }, { status, headers });
  const provider = tryProvider();
  // Never pass off mock output as a real explanation.
  if (!provider || provider.mock) return refuse(UNAVAILABLE);

  // No server secret to key the IP hash with (production): don't store an address hash anyone can reverse.
  const visitor = hashVisitor(clientIp(req));
  if (!visitor) return refuse(UNAVAILABLE);

  // A room code inside its window counts against the room's hourly bucket instead of this network's.
  // A code that isn't open counts as an ordinary visit, so guessing codes costs the guesser's own cap.
  const roomCode = body && typeof body === 'object' && 'room' in body ? body.room : undefined;
  const room = roomCode === undefined || roomCode === '' ? null : openRoom(roomCode, new Date());
  const bucket = room ? roomBucket(room) : visitor;
  const hourCap = room ? room.perHour : TRY_PER_IP_PER_HOUR;

  // A limiter that throws is a limiter that didn't count: refuse before any model call.
  const refusal = await reserveTry(bucket, hourCap, room ? ROOM_HOUR_CAP : HOUR_CAP).catch(() => UNAVAILABLE);
  if (refusal) return refuse(refusal);
  const roomAnswer = roomCode === undefined || roomCode === '' ? {} : { room: room ? 'open' : 'not-open' };

  try {
    // The website demo has its own caps and no account or install to attach counts to.
    const { text } = await provider.complete(
      trySystemPrompt(checked.level),
      `Snippet to explain:\n\`\`\`\n${checked.code}\n\`\`\``,
      AbortSignal.timeout(25_000),
    );
    return Response.json({ ok: true, text: text.trim().slice(0, 2_000), level: checked.level, ...roomAnswer }, { headers });
  } catch {
    return Response.json({ error: 'Vibe could not answer just now. Try again in a moment.' }, { status: 502, headers });
  }
}
