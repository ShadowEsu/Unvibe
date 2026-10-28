import { createHash, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { POST } from '../app/api/v1/try/route';
import { TRY_CONSENT_VERSION } from '../src/lib/tryDemo';
import { TRY_ROOMS, roomBucket, roomCodeMac, type TryRoom } from '../src/lib/tryRooms';

// The real /api/v1/try handler; only the AI providers and PostgREST HTTP boundaries are local.
const BASE_ENV = { ...process.env };
const STORE_HOST = 'try.supabase.test';

type Row = { ip_hash: string; created_at: string };
type RpcArgs = { p_ip_hash: string; p_ip_cap: number; p_day_cap: number };
const calls = { gemini: 0, openrouter: 0, anthropic: 0 };
let rows: Row[] = [];
/** Every `reserve_try_request` call's arguments, in order. */
let rpcCalls: RpcArgs[] = [];
/** Any other request to the store (a direct table read or write): the route must make none. */
let tableCalls: string[] = [];
/**
 * Overrides what the RPC answers. `null`: applies the caps to `rows` like the SQL function and answers
 * its text. A `Response` factory: answers that instead and records nothing.
 */
let rpcAnswer: (() => Response) | null = null;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === 'generativelanguage.googleapis.com') {
    calls.gemini += 1;
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Gemini says it adds one.' }] } }] });
  }
  if (url.hostname === 'openrouter.ai') {
    calls.openrouter += 1;
    return Response.json({ choices: [{ message: { content: 'OpenRouter answer.' } }] });
  }
  if (url.hostname === 'api.anthropic.com') {
    calls.anthropic += 1;
    return Response.json({ content: [{ type: 'text', text: 'Anthropic answer.' }] });
  }
  if (url.hostname === STORE_HOST && url.pathname === '/rest/v1/rpc/reserve_try_request' && init?.method === 'POST') {
    return reserve(JSON.parse(String(init.body)) as RpcArgs);
  }
  if (url.hostname === STORE_HOST) {
    tableCalls.push(`${init?.method ?? 'GET'} ${url.pathname}${url.search}`);
    return Response.json({ code: 'XX000', message: 'not part of the fake store' }, { status: 500 });
  }
  throw new Error(`Unexpected request: ${url}`);
}) as typeof fetch;

/** PostgREST's answer to `rpc('reserve_try_request')`: a text function's result is a JSON string. */
function reserve(args: RpcArgs): Response {
  rpcCalls.push(args);
  if (rpcAnswer) return rpcAnswer();
  const now = Date.now();
  const mine = rows.filter((row) => row.ip_hash === args.p_ip_hash && now - Date.parse(row.created_at) <= 3_600_000).length;
  if (mine >= args.p_ip_cap) return Response.json('hour_cap');
  const all = rows.filter((row) => now - Date.parse(row.created_at) <= 86_400_000).length;
  if (all >= args.p_day_cap) return Response.json('day_cap');
  rows.push({ ip_hash: args.p_ip_hash, created_at: new Date(now).toISOString() });
  return Response.json('ok');
}

function setEnv(vars: Record<string, string | undefined>): void {
  const env = process.env as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
}

/** Production with the store configured and only a Gemini key, like api.unvibe.site. */
function production(extra: Record<string, string | undefined> = {}): void {
  setEnv({
    NODE_ENV: 'production',
    GEMINI_API_KEY: 'local-gemini-key',
    SUPABASE_URL: `https://${STORE_HOST}`,
    SUPABASE_SERVICE_ROLE_KEY: 'local-service-role-key',
    ...extra,
  });
}

let ipSeq = 0;
function tryRequest(ip = `198.51.100.${++ipSeq % 250}`, extra: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/v1/try', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    // Both Try it boxes ticked, at the current version: these tests are about what happens after that.
    body: JSON.stringify({ code: 'const a = 1 + 1;', level: 'beginner', consent: { v: TRY_CONSENT_VERSION, aiSend: true, age18: true }, ...extra }),
  });
}

beforeEach(() => {
  process.env = { ...BASE_ENV };
  setEnv({
    NODE_ENV: undefined,
    ENABLE_MOCK_AI: undefined,
    OPENROUTER_API_KEY: undefined,
    ANTHROPIC_API_KEY: undefined,
    GEMINI_API_KEY: undefined,
    GOOGLE_API_KEY: undefined,
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    TRY_IP_SALT: undefined,
    TRY_ROOM_KEY: undefined,
  });
  calls.gemini = 0;
  calls.openrouter = 0;
  calls.anthropic = 0;
  rows = [];
  rpcCalls = [];
  tableCalls = [];
  rpcAnswer = null;
  delete (globalThis as { __unvibeTryMemory?: unknown }).__unvibeTryMemory;
});

afterEach(() => {
  // The limiter's only store access is the RPC: no direct count or insert on try_requests.
  assert.deepEqual(tableCalls, []);
});

test('Try uses Gemini even when OpenRouter and Anthropic keys are set too', async () => {
  production({ OPENROUTER_API_KEY: 'local-openrouter-key', ANTHROPIC_API_KEY: 'local-anthropic-key' });
  const res = await POST(tryRequest());
  assert.equal(res.status, 200);
  assert.match(await res.text(), /"text":"Gemini says it adds one\."/);
  assert.deepEqual(calls, { gemini: 1, openrouter: 0, anthropic: 0 });
});

test('Try in production with only an OpenRouter key answers 503 and calls no model', async () => {
  production({ GEMINI_API_KEY: undefined, OPENROUTER_API_KEY: 'local-openrouter-key' });
  const res = await POST(tryRequest());
  assert.equal(res.status, 503);
  assert.deepEqual(calls, { gemini: 0, openrouter: 0, anthropic: 0 });
});

test('Try in production ignores ENABLE_MOCK_AI: no Gemini key is 503, a Gemini key answers', async () => {
  production({ GEMINI_API_KEY: undefined, ANTHROPIC_API_KEY: 'local-anthropic-key', ENABLE_MOCK_AI: 'true' });
  assert.equal((await POST(tryRequest())).status, 503);
  setEnv({ GEMINI_API_KEY: 'local-gemini-key' });
  assert.equal((await POST(tryRequest())).status, 200);
  assert.deepEqual(calls, { gemini: 1, openrouter: 0, anthropic: 0 });
});

test('outside production ENABLE_MOCK_AI selects the labelled mock, which Try never shows as an answer', async () => {
  setEnv({ ENABLE_MOCK_AI: 'true', GEMINI_API_KEY: 'local-gemini-key' });
  assert.equal((await POST(tryRequest())).status, 503);
  assert.deepEqual(calls, { gemini: 0, openrouter: 0, anthropic: 0 });
});

function storedHash(): string {
  const last = rpcCalls.at(-1);
  assert.ok(last, 'Try reserved through the RPC');
  return last.p_ip_hash;
}

test('the stored IP hash is an HMAC keyed by the service-role key, not sha256 of a public constant', async () => {
  production();
  const ip = '203.0.113.7';
  assert.equal((await POST(tryRequest(ip))).status, 200);
  const stored = storedHash();
  assert.notEqual(stored, createHash('sha256').update(`unvibe-try:${ip}`).digest('hex').slice(0, 32));
  assert.equal(stored, createHmac('sha256', 'local-service-role-key').update(`unvibe-try:${ip}`).digest('hex').slice(0, 32));
});

test('the same IP hashes differently under different keys, and TRY_IP_SALT wins over the service-role key', async () => {
  const ip = '203.0.113.8';
  const hashes: string[] = [];
  for (const salt of ['local-try-salt-one', 'local-try-salt-two', undefined]) {
    production({ TRY_IP_SALT: salt });
    assert.equal((await POST(tryRequest(ip))).status, 200);
    hashes.push(storedHash());
  }
  assert.equal(new Set(hashes).size, 3);
  assert.equal(hashes[0], createHmac('sha256', 'local-try-salt-one').update(`unvibe-try:${ip}`).digest('hex').slice(0, 32));
});

test('production with neither TRY_IP_SALT nor the service-role key answers 503 and calls no model', async () => {
  production({ SUPABASE_SERVICE_ROLE_KEY: undefined, TRY_IP_SALT: undefined });
  const res = await POST(tryRequest());
  assert.equal(res.status, 503);
  assert.equal(calls.gemini, 0);
  assert.equal(rpcCalls.length, 0);
});

test('each POST makes exactly one reserve_try_request call with the hash and both caps', async () => {
  production();
  const ip = '203.0.113.11';
  for (let i = 1; i <= 3; i += 1) {
    assert.equal((await POST(tryRequest(ip))).status, 200);
    assert.equal(rpcCalls.length, i);
  }
  const hash = createHmac('sha256', 'local-service-role-key').update(`unvibe-try:${ip}`).digest('hex').slice(0, 32);
  assert.deepEqual(rpcCalls.at(-1), { p_ip_hash: hash, p_ip_cap: 6, p_day_cap: 500 });
  assert.equal(calls.gemini, 3);
});

test('the RPC answering ok calls the model once and answers 200', async () => {
  production();
  rpcAnswer = () => Response.json('ok');
  const res = await POST(tryRequest());
  assert.equal(res.status, 200);
  assert.match(await res.text(), /"text":"Gemini says it adds one\."/);
  assert.equal(rpcCalls.length, 1);
  assert.equal(calls.gemini, 1);
});

test('the RPC answering hour_cap or day_cap answers 429 with that message and calls no model', async () => {
  production();
  for (const [answer, message] of [['hour_cap', /a lot this hour/], ['day_cap', /busy today/]] as const) {
    rpcAnswer = () => Response.json(answer);
    const res = await POST(tryRequest());
    assert.equal(res.status, 429, answer);
    assert.match(await res.text(), message);
  }
  assert.equal(rpcCalls.length, 2);
  assert.equal(calls.gemini, 0);
});

test('an RPC error (500, missing function 404, permission 401) answers 503 with zero model calls', async () => {
  production();
  const errors = [
    () => Response.json({ code: 'XX000', message: 'reserve failed' }, { status: 500 }),
    () => Response.json({ code: 'PGRST202', message: 'Could not find the function public.reserve_try_request' }, { status: 404 }),
    () => Response.json({ code: '42501', message: 'permission denied for function reserve_try_request' }, { status: 401 }),
  ];
  for (const answer of errors) {
    rpcAnswer = answer;
    assert.equal((await POST(tryRequest())).status, 503);
  }
  assert.equal(rpcCalls.length, errors.length);
  assert.equal(calls.gemini, 0);
});

test('an RPC answering null or no body (200, bodyless 404) answers 503 with zero model calls', async () => {
  production();
  const answers = [() => Response.json(null), () => new Response(null, { status: 200 }), () => new Response(null, { status: 404 })];
  for (const answer of answers) {
    rpcAnswer = answer;
    assert.equal((await POST(tryRequest())).status, 503);
  }
  assert.equal(rpcCalls.length, answers.length);
  assert.equal(calls.gemini, 0);
});

test('an unexpected RPC value (other text, wrong case, array, object, number, true) answers 503 with zero model calls', async () => {
  production();
  const values = ['maybe', 'OK', ' ok', ['ok'], { reserve_try_request: 'ok' }, 1, true];
  for (const value of values) {
    rpcAnswer = () => Response.json(value);
    assert.equal((await POST(tryRequest())).status, 503, JSON.stringify(value));
  }
  // PostgREST answers an array of rows with 404 when no function matched: postgrest-js reads it as data [] and no error.
  rpcAnswer = () => Response.json([], { status: 404 });
  assert.equal((await POST(tryRequest())).status, 503);
  assert.equal(rpcCalls.length, values.length + 1);
  assert.equal(calls.gemini, 0);
});

test('a limiter that throws (malformed SUPABASE_URL) answers 503 with zero model calls', async () => {
  production({ SUPABASE_URL: 'not a url' });
  assert.equal((await POST(tryRequest())).status, 503);
  assert.equal(calls.gemini, 0);
});

test('the store caps one IP at 6 an hour and everyone at 500 a day', async () => {
  production();
  const ip = '203.0.113.9';
  for (let i = 0; i < 6; i += 1) assert.equal((await POST(tryRequest(ip))).status, 200);
  assert.equal((await POST(tryRequest(ip))).status, 429);
  const now = new Date().toISOString();
  while (rows.length < 500) rows.push({ ip_hash: `other-${rows.length}`, created_at: now });
  assert.equal((await POST(tryRequest())).status, 429);
  assert.equal(rows.length, 500);
  assert.equal(rpcCalls.length, 8);
  assert.equal(calls.gemini, 6);
});

test('production without a store answers 503 instead of using process memory', async () => {
  production({ SUPABASE_URL: undefined });
  assert.equal((await POST(tryRequest())).status, 503);
  assert.equal(calls.gemini, 0);
});

test('outside production the memory fallback stops one IP at 6 an hour and everyone at 500 a day', async () => {
  setEnv({ GEMINI_API_KEY: 'local-gemini-key' });
  const ip = '203.0.113.10';
  for (let i = 0; i < 6; i += 1) assert.equal((await POST(tryRequest(ip))).status, 200);
  assert.equal((await POST(tryRequest(ip))).status, 429);
  for (let i = 6; i < 500; i += 1) {
    assert.equal((await POST(tryRequest(`10.0.${i >> 8}.${i & 255}`))).status, 200);
  }
  const res = await POST(tryRequest('10.9.9.9'));
  assert.equal(res.status, 429);
  assert.match(await res.text(), /busy today/);
  assert.equal(calls.gemini, 500);
});

const ROOM_KEY = 'local-room-key-0123456789abcdef0123456789abcdef';

/** Runs `body` with TRY_ROOM_KEY set and one scheduled room (code "ROOM-TEST-1", 8 an hour) in `window`. */
async function withRoom(window: { start: number; end: number }, body: (room: TryRoom) => Promise<void>): Promise<void> {
  setEnv({ TRY_ROOM_KEY: ROOM_KEY });
  const now = Date.now();
  const room: TryRoom = {
    id: 'test-room',
    codeMac: roomCodeMac('ROOM-TEST-1', ROOM_KEY),
    start: new Date(now + window.start).toISOString(),
    end: new Date(now + window.end).toISOString(),
    perHour: 8,
  };
  const rooms = TRY_ROOMS as TryRoom[];
  rooms.push(room);
  try {
    await body(room);
  } finally {
    rooms.splice(rooms.indexOf(room), 1);
  }
}

test('an open room code counts against the room bucket and its cap, not the shared network\'s 6', async () => {
  production();
  await withRoom({ start: -3_600_000, end: 3_600_000 }, async (room) => {
    const ip = '203.0.113.50';
    for (let i = 0; i < 8; i += 1) {
      const res = await POST(tryRequest(ip, { room: ' room-test-1 ' }));
      assert.equal(res.status, 200);
      assert.equal((await res.json() as { room?: string }).room, 'open');
    }
    const ninth = await POST(tryRequest(ip, { room: 'ROOM-TEST-1' }));
    assert.equal(ninth.status, 429);
    assert.match(await ninth.text(), /This room has used the demo/);
    assert.ok(rpcCalls.every((args) => args.p_ip_hash === roomBucket(room) && args.p_ip_cap === 8));
    // The network's own 6 are untouched by the room's requests.
    assert.equal((await POST(tryRequest(ip))).status, 200);
    assert.equal(calls.gemini, 9);
  });
});

test('a room code that is wrong, early or late counts as an ordinary visit and says so', async () => {
  production();
  for (const [window, code] of [
    [{ start: -3_600_000, end: 3_600_000 }, 'ROOM-TEST-2'],
    [{ start: 60_000, end: 3_600_000 }, 'ROOM-TEST-1'],
    [{ start: -3_600_000, end: -1 }, 'ROOM-TEST-1'],
  ] as const) {
    await withRoom(window, async (room) => {
      rows = [];
      rpcCalls = [];
      const ip = '203.0.113.51';
      for (let i = 0; i < 6; i += 1) {
        const res = await POST(tryRequest(ip, { room: code }));
        assert.equal(res.status, 200);
        assert.equal((await res.json() as { room?: string }).room, 'not-open');
      }
      const seventh = await POST(tryRequest(ip, { room: code }));
      assert.equal(seventh.status, 429);
      assert.match(await seventh.text(), /You have used the demo/);
      assert.ok(rpcCalls.every((args) => args.p_ip_hash !== roomBucket(room) && args.p_ip_cap === 6));
    });
  }
});

test('a room still stops at the site-wide 500 a day', async () => {
  production();
  await withRoom({ start: -60_000, end: 3_600_000 }, async () => {
    const now = new Date().toISOString();
    while (rows.length < 500) rows.push({ ip_hash: `other-${rows.length}`, created_at: now });
    const res = await POST(tryRequest('203.0.113.52', { room: 'ROOM-TEST-1' }));
    assert.equal(res.status, 429);
    assert.match(await res.text(), /busy today/);
    assert.equal(calls.gemini, 0);
  });
});

test('without TRY_ROOM_KEY the right code opens nothing and counts as an ordinary visit', async () => {
  production();
  await withRoom({ start: -60_000, end: 3_600_000 }, async (room) => {
    setEnv({ TRY_ROOM_KEY: undefined });
    const res = await POST(tryRequest('203.0.113.53', { room: 'ROOM-TEST-1' }));
    assert.equal(res.status, 200);
    assert.equal((await res.json() as { room?: string }).room, 'not-open');
    assert.ok(rpcCalls.every((args) => args.p_ip_hash !== roomBucket(room) && args.p_ip_cap === 6));
  });
});

test('a TRY_ROOM_KEY under 32 characters opens nothing, even for a row made with that key', async () => {
  production();
  const shortKey = 'k'.repeat(31);
  await withRoom({ start: -60_000, end: 3_600_000 }, async (room) => {
    room.codeMac = roomCodeMac('ROOM-TEST-1', shortKey);
    setEnv({ TRY_ROOM_KEY: shortKey });
    const res = await POST(tryRequest('203.0.113.54', { room: 'ROOM-TEST-1' }));
    assert.equal(res.status, 200);
    assert.equal((await res.json() as { room?: string }).room, 'not-open');
    assert.ok(rpcCalls.every((args) => args.p_ip_hash !== roomBucket(room) && args.p_ip_cap === 6));
  });
});
