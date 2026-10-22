import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { POST as review } from '../app/api/v1/reviews/route';
import { POST as comprehension } from '../app/api/v1/comprehension/route';
import {
  reserveTrialAction,
  trialCounterUsed,
  trialGlobalDayKey,
  trialGlobalMonthKey,
  trialInstallKey,
  trialIpKey,
  trialUsageLine,
} from '../src/lib/trialAccess';
import { clientIp } from '../src/lib/tryDemo';

// Real route handlers and the in-memory trial counters; only the AI and PostgREST HTTP boundaries are local.
const BASE_ENV = { ...process.env };
const TOKEN = 'local-trial-token-abcdefghijklmnop';

let upstream: 'answer' | 'fail' | 'question' = 'answer';
let aiCalls = 0;
let supabase: ((url: URL, init?: RequestInit) => Promise<Response>) | null = null;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.hostname === 'generativelanguage.googleapis.com') {
    aiCalls += 1;
    if (upstream === 'fail') return new Response('upstream unavailable', { status: 503 });
    const text = upstream === 'question'
      ? JSON.stringify({ question: 'What does it return?', options: ['Its input', 'Nothing'], answerIndex: 0, rationale: 'identity', concept: 'functions', conceptLabel: 'Functions' })
      : 'This function returns its input.';
    const chunk = { candidates: [{ content: { parts: [{ text }] } }] };
    return url.pathname.endsWith(':streamGenerateContent')
      ? new Response(`data: ${JSON.stringify(chunk)}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
      : Response.json(chunk);
  }
  if (supabase && url.hostname === 'trial.supabase.test') return supabase(url, init);
  throw new Error(`Unexpected request: ${url}`);
}) as typeof fetch;

beforeEach(() => {
  process.env = { ...BASE_ENV };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ENABLE_MOCK_AI;
  delete process.env.UNVIBE_TRIAL_IP_DAILY_LIMIT;
  delete process.env.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT;
  delete process.env.UNVIBE_TRIAL_GLOBAL_DAILY_LIMIT;
  delete process.env.UNVIBE_TRIAL_EXPLANATION_LIMIT;
  delete process.env.UNVIBE_TRIAL_FOLLOW_UP_LIMIT;
  process.env.GEMINI_API_KEY = 'local-gemini-key';
  process.env.UNVIBE_TRIAL_TOKEN = TOKEN;
  upstream = 'answer';
  aiCalls = 0;
  supabase = null;
  const g = globalThis as unknown as { __unvibeTrialUsage?: Map<string, unknown>; __unvibeTrialInstalls?: Map<string, unknown> };
  g.__unvibeTrialUsage = new Map();
  g.__unvibeTrialInstalls = new Map();
});

const context = { language: 'typescript', projectStructure: [], imports: [], code: 'const identity = (x: number) => x;' };

function trialHeaders(installId: string, ip = '203.0.113.10'): Record<string, string> {
  return { authorization: `Bearer ${TOKEN}`, 'x-unvibe-install-id': installId, 'x-forwarded-for': `${ip}, 10.0.0.1` };
}

function explainRequest(headers: Record<string, string>, extra: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/v1/reviews', {
    method: 'POST',
    headers,
    body: JSON.stringify({ scope: 'selection', level: 'beginner', context, ...extra }),
  });
}

function questionRequest(headers: Record<string, string>, extra: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/v1/comprehension', {
    method: 'POST',
    headers,
    body: JSON.stringify({ scope: 'selection', level: 'beginner', context, ...extra }),
  });
}

async function errorBody(response: Response): Promise<{ error?: unknown; message?: unknown }> {
  const body: unknown = await response.json();
  assert.ok(body !== null && typeof body === 'object', 'expected a JSON object');
  return body as { error?: unknown; message?: unknown };
}

test('clientIp uses the same first x-forwarded-for hop, then x-real-ip, as /try', () => {
  const ip = (headers: Record<string, string>) => clientIp(new Request('http://localhost/', { headers }));
  assert.equal(ip({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1', 'x-real-ip': '198.51.100.1' }), '203.0.113.7');
  assert.equal(ip({ 'x-real-ip': '198.51.100.1' }), '198.51.100.1');
  assert.equal(ip({}), 'local');
});

test('the per-IP key is a salted daily hash, never the raw address', () => {
  const day = new Date('2026-10-22T08:00:00.000Z');
  const key = trialIpKey('203.0.113.7', day);
  assert.match(key, /^__ip__:2026-10-22:[0-9a-f]{32}$/);
  assert.doesNotMatch(key, /203/);
  assert.equal(trialIpKey('203.0.113.7', new Date('2026-10-22T23:59:59.000Z')), key);
  assert.notEqual(trialIpKey('203.0.113.8', day), key);
  assert.notEqual(trialIpKey('203.0.113.7', new Date('2026-10-23T00:00:00.000Z')).split(':')[2], key.split(':')[2]);
});

test('151 distinct install ids from one IP: the default cap of 150 a day refuses the 151st', async () => {
  const now = new Date('2026-10-22T12:00:00.000Z');
  const ip = '203.0.113.7';
  for (let i = 1; i <= 150; i += 1) {
    const reservation = await reserveTrialAction(trialInstallKey(`ip-cap-install-${i}`), 'ai_explanation', ip, now);
    assert.equal(reservation.denied, null, `install #${i} is under the per-IP cap`);
  }
  const fresh = trialInstallKey('ip-cap-install-fresh');
  const denied = await reserveTrialAction(fresh, 'ai_explanation', ip, now);
  assert.equal(denied.denied?.status, 429);
  const body = await errorBody(denied.denied);
  assert.equal(body.error, 'trial_network_limit');
  assert.match(String(body.message), /network/);
  assert.equal((await trialUsageLine(fresh, 'ai_explanation', now)).used, 0, 'a refused request gives the install unit back');
  assert.equal(await trialCounterUsed(trialIpKey(ip, now)), 150);
  assert.equal(await trialCounterUsed(trialGlobalMonthKey(now)), 150, 'a refused request gives the global unit back');
  assert.equal(await trialCounterUsed(trialGlobalDayKey(now)), 150);

  assert.equal((await reserveTrialAction(fresh, 'project_question', ip, now)).denied?.status, 429, 'follow-ups share the per-IP cap');
  assert.equal((await reserveTrialAction(fresh, 'ai_explanation', '198.51.100.9', now)).denied, null, 'another network is unaffected');
  assert.equal((await reserveTrialAction(fresh, 'ai_explanation', ip, new Date('2026-10-23T00:00:01.000Z'))).denied, null, 'the next UTC day starts over');
});

test('through /reviews, 51 distinct install ids from one IP get 429 with UNVIBE_TRIAL_IP_DAILY_LIMIT=50', async () => {
  process.env.UNVIBE_TRIAL_IP_DAILY_LIMIT = '50';
  for (let i = 1; i <= 50; i += 1) {
    const response = await review(explainRequest(trialHeaders(`route-ip-${i}-abcdef`, '203.0.113.20')));
    assert.equal(response.status, 200, `install #${i}`);
    assert.match(await response.text(), /"type":"done"/);
  }
  const callsBefore = aiCalls;
  const denied = await review(explainRequest(trialHeaders('route-ip-51-abcdef', '203.0.113.20')));
  assert.equal(denied.status, 429);
  assert.equal((await errorBody(denied)).error, 'trial_network_limit');
  assert.equal(aiCalls, callsBefore, 'no AI call is made once the network is over its cap');
  const comprehensionDenied = await comprehension(questionRequest(trialHeaders('route-ip-52-abcdef', '203.0.113.20')));
  assert.equal(comprehensionDenied.status, 429);
  assert.equal((await review(explainRequest(trialHeaders('route-ip-53-abcdef', '203.0.113.21')))).status, 200);
});

test('a 4,001-character question gets 413 in /reviews and /comprehension; 4,000 passes validation', async () => {
  const install = 'question-cap-install';
  const tooLong = await review(explainRequest(trialHeaders(install), { question: 'a'.repeat(4_001) }));
  assert.equal(tooLong.status, 413);
  const body = await errorBody(tooLong);
  assert.equal(body.error, 'question_too_long');
  assert.match(String(body.message), /4,000 characters/);
  assert.equal((await trialUsageLine(trialInstallKey(install), 'ai_explanation')).used, 0, 'a refused question spends nothing');
  assert.equal(aiCalls, 0);

  const atLimit = await review(explainRequest(trialHeaders(install), { question: 'a'.repeat(4_000) }));
  assert.equal(atLimit.status, 200);
  assert.match(await atLimit.text(), /"type":"done"/);

  const notText = await review(explainRequest(trialHeaders(install), { question: ['a'.repeat(10_000)] }));
  assert.equal(notText.status, 400);

  const quizTooLong = await comprehension(questionRequest(trialHeaders(install), { question: 'a'.repeat(4_001) }));
  assert.equal(quizTooLong.status, 413);
  assert.equal((await errorBody(quizTooLong)).error, 'question_too_long');
  upstream = 'question';
  assert.equal((await comprehension(questionRequest(trialHeaders(install), { question: 'a'.repeat(4_000) }))).status, 200);
});

test('the global counter is monthly: a new month\'s key starts at 0', async () => {
  process.env.UNVIBE_TRIAL_GLOBAL_MONTHLY_LIMIT = '2';
  const october = new Date('2026-10-31T23:59:00.000Z');
  const november = new Date('2026-11-01T00:00:30.000Z');
  assert.equal(trialGlobalMonthKey(october), '__global__:2026-10');
  assert.equal(trialGlobalMonthKey(november), '__global__:2026-11');
  assert.equal((await reserveTrialAction(trialInstallKey('month-a-install'), 'ai_explanation', '198.51.100.1', october)).denied, null);
  assert.equal((await reserveTrialAction(trialInstallKey('month-b-install'), 'project_question', '198.51.100.2', october)).denied, null);
  const full = await reserveTrialAction(trialInstallKey('month-c-install'), 'ai_explanation', '198.51.100.3', october);
  assert.equal(full.denied?.status, 429);
  const body = await errorBody(full.denied);
  assert.equal(body.error, 'trial_capacity_reached');
  assert.match(String(body.message), /temporarily full/);
  assert.equal(await trialCounterUsed(trialGlobalMonthKey(october)), 2);

  assert.equal(await trialCounterUsed(trialGlobalMonthKey(november)), 0);
  assert.equal((await reserveTrialAction(trialInstallKey('month-c-install'), 'ai_explanation', '198.51.100.3', november)).denied, null);
  assert.equal(await trialCounterUsed(trialGlobalMonthKey(november)), 1);
});

test('the daily global cap returns 429 once reached and resets the next UTC day', async () => {
  process.env.UNVIBE_TRIAL_GLOBAL_DAILY_LIMIT = '3';
  const today = new Date('2026-10-22T10:00:00.000Z');
  assert.equal(trialGlobalDayKey(today), '__global_day__:2026-10-22');
  for (let i = 1; i <= 3; i += 1) {
    assert.equal((await reserveTrialAction(trialInstallKey(`day-${i}-install`), 'ai_explanation', `198.51.100.${i}`, today)).denied, null);
  }
  const full = await reserveTrialAction(trialInstallKey('day-4-install'), 'ai_explanation', '198.51.100.4', today);
  assert.equal(full.denied?.status, 429);
  const body = await errorBody(full.denied);
  assert.equal(body.error, 'trial_capacity_reached');
  assert.match(String(body.message), /today/);
  assert.equal(await trialCounterUsed(trialGlobalDayKey(today)), 3);
  assert.equal(await trialCounterUsed(trialGlobalMonthKey(today)), 3, 'the refused request gives its monthly unit back');
  assert.equal(await trialCounterUsed(trialIpKey('198.51.100.4', today)), 0, 'the refused request gives its per-IP unit back');

  const tomorrow = new Date('2026-10-23T00:00:00.000Z');
  assert.equal((await reserveTrialAction(trialInstallKey('day-4-install'), 'ai_explanation', '198.51.100.4', tomorrow)).denied, null);
});

/** A PostgREST stand-in whose trial_reserve fails for keys matching `failing`. */
function failingStore(failing: RegExp): { patches: string[] } {
  process.env.SUPABASE_URL = 'https://trial.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
  const patches: string[] = [];
  supabase = async (url, init) => {
    if (url.pathname === '/rest/v1/trial_installs') {
      return init?.method === 'POST' ? new Response(null, { status: 201 }) : Response.json([{ started_at: new Date().toISOString() }]);
    }
    if (url.pathname === '/rest/v1/rpc/trial_reserve') {
      const args = JSON.parse(String(init?.body)) as { p_install_key: string };
      if (failing.test(args.p_install_key)) return Response.json({ message: 'database unavailable', code: 'XX000' }, { status: 500 });
      return Response.json(1);
    }
    if (url.pathname === '/rest/v1/trial_counters') {
      if (init?.method === 'PATCH') {
        patches.push(url.searchParams.get('install_key') ?? '');
        return Response.json([{ used: 0 }]);
      }
      return Response.json([{ used: 1 }]);
    }
    throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url.pathname}`);
  };
  return { patches };
}

test('a counter store error refuses the trial request with 503 and gives back what it took', async () => {
  const now = new Date();
  const ip = '203.0.113.30';
  const install = trialInstallKey('store-error-install');
  const { patches } = failingStore(/^__global_day__:/);
  const refused = await reserveTrialAction(install, 'ai_explanation', ip, now);
  assert.equal(refused.denied?.status, 503);
  const body = await errorBody(refused.denied);
  assert.equal(body.error, 'trial_unavailable');
  assert.match(String(body.message), /try again/i);
  assert.deepEqual(patches.sort(), [`eq.${install}`, `eq.${trialGlobalMonthKey(now)}`, `eq.${trialIpKey(ip, now)}`].sort());
});

test('a per-install counter error is also refused (503), never allowed', async () => {
  failingStore(/^[0-9a-f]{64}$/);
  const refused = await reserveTrialAction(trialInstallKey('install-error-install'), 'project_question', '203.0.113.31');
  assert.equal(refused.denied?.status, 503);
});

test('through /reviews, a store error returns 503 and never calls the AI', async () => {
  failingStore(/^__global_day__:/);
  const response = await review(explainRequest(trialHeaders('route-store-error')));
  assert.equal(response.status, 503);
  assert.equal((await errorBody(response)).error, 'trial_unavailable');
  assert.equal(aiCalls, 0);
});

test('a failed explanation gives back the install, per-IP, monthly and daily units it took', async () => {
  const ip = '203.0.113.40';
  const install = 'release-all-install';
  upstream = 'fail';
  assert.match(await (await review(explainRequest(trialHeaders(install, ip)))).text(), /"type":"error"/);
  const now = new Date();
  assert.equal((await trialUsageLine(trialInstallKey(install), 'ai_explanation')).used, 0);
  assert.equal(await trialCounterUsed(trialIpKey(ip, now)), 0);
  assert.equal(await trialCounterUsed(trialGlobalMonthKey(now)), 0);
  assert.equal(await trialCounterUsed(trialGlobalDayKey(now)), 0);

  upstream = 'question';
  const quiz = await comprehension(questionRequest(trialHeaders(install, ip)));
  assert.equal(quiz.status, 200);
  assert.equal(await trialCounterUsed(trialIpKey(ip, now)), 1, 'Test me counts towards the per-IP cap');
  assert.equal(await trialCounterUsed(trialGlobalDayKey(now)), 1);
});
