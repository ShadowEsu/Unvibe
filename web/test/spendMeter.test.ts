import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { BilledProviderError, ProviderRejectedError, type Completion, type TokenUsage } from '../src/ai/provider';
import {
  ACCOUNT_DAY_CAP_NANO_USD,
  AI_LIMIT_ACCOUNT,
  AI_LIMIT_MONTH,
  AI_LIMIT_TODAY,
  AI_MAINTENANCE,
  AI_PAUSED,
  AiPausedError,
  DAY_CAP_NANO_USD,
  MemorySpendStore,
  MeteredProvider,
  SupabaseSpendStore,
  MODEL_PRICES,
  MONTH_CAP_NANO_USD,
  costNanoUsd,
  maxInputTokens,
  pricesFor,
  spendAccount,
  worstCaseNanoUsd,
  type MeterableProvider,
  type SpendStore,
} from '../src/ai/spendMeter';
import { POST as review } from '../app/api/v1/reviews/route';
import { POST as comprehension } from '../app/api/v1/comprehension/route';
import { POST as tryRoute } from '../app/api/v1/try/route';
import { TRY_CONSENT_VERSION } from '../src/lib/tryDemo';
import { selectProvider } from '../src/ai';
import { trialInstallFromRequest } from '../src/lib/trialAccess';
import { ANTHROPIC_MODEL } from '../src/ai/anthropic';
import { buildComprehensionPrompt, buildSystemPrompt, buildUserPrompt } from '../src/ai/prompt';
import { MAX_CONTEXT_BYTES, MAX_CONTEXT_CHARS, MAX_QUESTION_CHARS, payloadSizeError } from '../src/lib/reviewLimits';
import type { ReviewRequestPayload } from '../src/ai/protocol';

/** A provider double that records calls and answers with fixed usage (or none, or a failure). */
class SpyProvider implements MeterableProvider {
  readonly name = 'spy';
  readonly mock = false;
  readonly maxOutputTokens = 2048;
  calls = 0;
  constructor(private readonly outcome: { usage?: TokenUsage; fail?: Error }, readonly model: string = ANTHROPIC_MODEL) {}
  async stream(_s: string, _u: string, onToken: (t: string) => void): Promise<TokenUsage | undefined> {
    this.calls += 1;
    if (this.outcome.fail) throw this.outcome.fail;
    onToken('answer');
    return this.outcome.usage;
  }
  async complete(): Promise<Completion> {
    this.calls += 1;
    if (this.outcome.fail) throw this.outcome.fail;
    return { text: 'answer', usage: this.outcome.usage };
  }
}

const sum = (store: MemorySpendStore) => [...store.days.values()].reduce((a, b) => a + b, 0);
/** The prices the meter uses for the model production sends. */
const PRICES = MODEL_PRICES[ANTHROPIC_MODEL];
const worst = (s: string, u: string) => worstCaseNanoUsd(PRICES, s, u, 2048);

test('the hosted model is metered at Opus 5.5 list prices: $4 / $20 per million in / out at any length, cache writes $8', () => {
  const prices = pricesFor(ANTHROPIC_MODEL);
  assert.ok(prices, 'the hosted model has a price row');
  assert.equal(costNanoUsd(prices, { inputTokens: 1_000_000, outputTokens: 0 }), 4_000_000_000); // $4
  assert.equal(costNanoUsd(prices, { inputTokens: 0, outputTokens: 1_000_000 }), 20_000_000_000); // $20
  // One tier: a long prompt costs the same per token as a short one.
  assert.equal(costNanoUsd(prices, { inputTokens: 150_000, outputTokens: 1000 }), 150_000 * 4_000 + 1000 * 20_000);
  // Cache writes inside the input are priced at the 1h write price; the rest at the input price.
  assert.equal(costNanoUsd(prices, { inputTokens: 1000, outputTokens: 0, cacheWriteTokens: 600 }), 400 * 4_000 + 600 * 8_000);
});

test('a model without a price row is refused before anything is reserved or sent', async () => {
  for (const model of ['claude-haiku-5-5', 'claude-fable-5-1', '', '__proto__', 'toString']) {
    const store = new MemorySpendStore();
    const inner = new SpyProvider({ usage: { inputTokens: 1, outputTokens: 1 } }, model);
    const error = await new MeteredProvider(inner, store).complete('s', 'u').catch((e: unknown) => e);
    assert.ok(error instanceof AiPausedError && error.reason === 'unavailable', model);
    assert.equal(inner.calls, 0, model);
    assert.equal(sum(store), 0, model);
  }
});

test('the hold bounds input by UTF-8 bytes, so CJK and emoji can never be held below their cost', () => {
  assert.equal(maxInputTokens('ab', 'c'), 3 + 64);
  assert.equal(maxInputTokens('', '漢'), 3 + 64);
  assert.equal(maxInputTokens('', '😀'), 4 + 64);
  // A 120k-character CJK paste (the API's size cap counts UTF-16 length) is 360k bytes, held in full.
  const cjk = '漢'.repeat(120_000);
  assert.equal(worst('', cjk), (360_000 + 64) * 4_000 + 2048 * 20_000);
  assert.ok(worst('', cjk) >= costNanoUsd(PRICES, { inputTokens: 180_000, outputTokens: 2048 }));
  const emoji = '😀'.repeat(60_000); // 120k UTF-16 units, 240k bytes
  assert.ok(worst('', emoji) >= costNanoUsd(PRICES, { inputTokens: 120_000, outputTokens: 2048 }));
  assert.equal(worst('', 'x'.repeat(99_000)), (99_000 + 64) * 4_000 + 2048 * 20_000);
});

test('a call reserves its worst case first, then settles to the measured cost', async () => {
  const store = new MemorySpendStore();
  let reservedDuringCall = 0;
  const inner = new SpyProvider({ usage: { inputTokens: 1000, outputTokens: 200 } });
  const original = inner.complete.bind(inner);
  inner.complete = async () => {
    reservedDuringCall = sum(store);
    return original();
  };
  await new MeteredProvider(inner, store).complete('s'.repeat(30), 'u'.repeat(30));
  assert.equal(reservedDuringCall, (60 + 64) * 4_000 + 2048 * 20_000);
  assert.equal(sum(store), 1000 * 4_000 + 200 * 20_000);
});

test('a call without measured usage, or one that failed after it was sent, keeps its whole worst case', async () => {
  const billed = new BilledProviderError(new Error('stream cut'), { inputTokens: 1, outputTokens: 1, estimated: true });
  for (const outcome of [{}, { usage: { inputTokens: 1, outputTokens: 1, estimated: true as const } }, { fail: new Error('socket hang up') }, { fail: billed }]) {
    const store = new MemorySpendStore();
    const metered = new MeteredProvider(new SpyProvider(outcome), store);
    await metered.stream('sys', 'user', () => {}).catch(() => undefined);
    assert.equal(sum(store), worst('sys', 'user'), JSON.stringify(outcome));
  }
});

test('an error status Anthropic answered with (not billed) releases the whole hold', async () => {
  for (const status of [400, 401, 429, 529]) {
    const store = new MemorySpendStore();
    const inner = new SpyProvider({ fail: new ProviderRejectedError(status, `Anthropic API ${status}: error`) });
    const error = await new MeteredProvider(inner, store).complete('sys', 'user').catch((e: unknown) => e);
    assert.ok(error instanceof ProviderRejectedError);
    assert.equal(sum(store), 0, String(status));
  }
});

test('past the daily stop the call is refused before the provider is reached, and the next UTC day opens again', async () => {
  let now = new Date('2026-10-29T23:59:59Z');
  const store = new MemorySpendStore(() => now);
  store.days.set('2026-10-29', DAY_CAP_NANO_USD - 1000);
  const inner = new SpyProvider({ usage: { inputTokens: 10, outputTokens: 10 } });
  const metered = new MeteredProvider(inner, store);
  const error = await metered.complete('s', 'u').catch((e: unknown) => e);
  assert.ok(error instanceof AiPausedError);
  assert.equal(error.reason, 'day_cap');
  assert.equal(error.message, AI_LIMIT_TODAY);
  assert.equal(inner.calls, 0);
  assert.equal(store.days.get('2026-10-29'), DAY_CAP_NANO_USD - 1000);

  now = new Date('2026-10-30T00:00:00Z');
  await metered.complete('s', 'u');
  assert.equal(inner.calls, 1);
});

test('the monthly stop counts every day of this UTC month, refuses honestly, and the 1st opens again', async () => {
  let now = new Date('2026-11-30T12:00:00Z');
  const store = new MemorySpendStore(() => now);
  store.days.set('2026-10-31', MONTH_CAP_NANO_USD); // last month: never counted against this one
  store.days.set('2026-11-01', MONTH_CAP_NANO_USD - DAY_CAP_NANO_USD);
  store.days.set('2026-11-29', DAY_CAP_NANO_USD - worst('s', 'u') + 1); // today is empty, the month is not
  const inner = new SpyProvider({ usage: { inputTokens: 1, outputTokens: 1 } });
  const metered = new MeteredProvider(inner, store);
  const error = await metered.complete('s', 'u').catch((e: unknown) => e);
  assert.ok(error instanceof AiPausedError);
  assert.equal(error.reason, 'month_cap');
  assert.equal(error.message, AI_LIMIT_MONTH);
  assert.equal(inner.calls, 0);

  now = new Date('2026-12-01T00:00:00Z');
  await metered.complete('s', 'u');
  assert.equal(inner.calls, 1);
});

test('fail closed: no store, or a store that throws, refuses without calling the provider', async () => {
  const broken: SpendStore = {
    reserve: async () => { throw new Error('connection refused'); },
    settle: async () => {},
  };
  for (const store of [null, broken]) {
    const inner = new SpyProvider({ usage: { inputTokens: 1, outputTokens: 1 } });
    const error = await new MeteredProvider(inner, store).stream('s', 'u', () => {}).catch((e: unknown) => e);
    assert.ok(error instanceof AiPausedError);
    assert.equal(error.reason, 'unavailable');
    assert.equal(inner.calls, 0);
  }
});

test('a failed settle keeps the worst case counted and still returns the answer', async () => {
  const memory = new MemorySpendStore();
  const store: SpendStore = { reserve: (n) => memory.reserve(n), settle: async () => { throw new Error('timeout'); } };
  const { text } = await new MeteredProvider(new SpyProvider({ usage: { inputTokens: 1, outputTokens: 1 } }), store).complete('s', 'u');
  assert.equal(text, 'answer');
  assert.equal(sum(memory), worst('s', 'u'));
});

test("one account's daily share stops that account only, settles with the call, and opens again the next UTC day", async () => {
  let now = new Date('2026-11-02T10:00:00Z');
  const store = new MemorySpendStore(() => now);
  const heavy = spendAccount('user', 'user-a');
  const other = spendAccount('install', 'install-b');
  store.accounts.set(`2026-11-02 ${heavy}`, ACCOUNT_DAY_CAP_NANO_USD - worst('s', 'u') + 1);
  const inner = new SpyProvider({ usage: { inputTokens: 100, outputTokens: 10 } });

  const error = await new MeteredProvider(inner, store, heavy).complete('s', 'u').catch((e: unknown) => e);
  assert.ok(error instanceof AiPausedError);
  assert.equal(error.reason, 'account_day_cap');
  assert.equal(error.message, AI_LIMIT_ACCOUNT);
  assert.equal(inner.calls, 0);
  assert.equal(sum(store), 0, 'a refused call counts nowhere');

  // Another account, and the Try box (no account), still have the day.
  await new MeteredProvider(inner, store, other).complete('s', 'u');
  await new MeteredProvider(inner, store).complete('s', 'u');
  assert.equal(inner.calls, 2);
  const measured = 100 * 4_000 + 10 * 20_000;
  assert.equal(store.accounts.get(`2026-11-02 ${other}`), measured, 'the account row settles to the measured cost');
  assert.equal(sum(store), 2 * measured);

  now = new Date('2026-11-03T00:00:00Z');
  await new MeteredProvider(inner, store, heavy).complete('s', 'u');
  assert.equal(inner.calls, 3);
});

test('the account key is a hash that keeps users and installs apart', () => {
  assert.match(spendAccount('user', 'abc'), /^[0-9a-f]{64}$/);
  assert.notEqual(spendAccount('user', 'abc'), spendAccount('install', 'abc'));
  assert.ok(!spendAccount('user', 'abc').includes('abc'));
});

test('the budget is $25 a month, $5 a day and $1 per account a day: a fifth of each level above it', () => {
  assert.equal(MONTH_CAP_NANO_USD, 25_000_000_000);
  assert.equal(DAY_CAP_NANO_USD, 5_000_000_000);
  assert.equal(ACCOUNT_DAY_CAP_NANO_USD, 1_000_000_000);
  assert.equal(ACCOUNT_DAY_CAP_NANO_USD * 5, DAY_CAP_NANO_USD);
  assert.equal(DAY_CAP_NANO_USD * 5, MONTH_CAP_NANO_USD);
});

test('every payload the size check lets through is held under one account\'s daily share, so it is never refused as a spent limit', () => {
  const context = (code: string) => ({ language: 'typescript', projectStructure: [], imports: [], code });
  // The largest of each kind the size check accepts: ASCII at the character cap, 3-byte CJK and
  // 4-byte emoji at the byte cap, each with the longest question in the longest script.
  const fill = (unit: string) => {
    const overhead = Buffer.byteLength(JSON.stringify(context('')));
    const bytes = Buffer.byteLength(unit);
    const chars = unit.length;
    let n = Math.min(Math.floor((MAX_CONTEXT_BYTES - overhead) / bytes), Math.floor((MAX_CONTEXT_CHARS - overhead) / chars));
    while (payloadSizeError({ scope: 'selection', level: 'expert', context: context(unit.repeat(n + 1)) }) === null) n += 1;
    return unit.repeat(n);
  };
  for (const unit of ['x', '漢', '😀']) {
    const code = fill(unit);
    for (const question of [undefined, '漢'.repeat(MAX_QUESTION_CHARS)]) {
      const payload: ReviewRequestPayload = { scope: 'selection', level: 'expert', variant: 'different', context: context(code), question };
      assert.equal(payloadSizeError(payload), null, `${unit} is accepted at its largest`);
      const held = Math.max(
        worstCaseNanoUsd(PRICES, buildSystemPrompt(payload), buildUserPrompt(payload), 2048),
        worstCaseNanoUsd(PRICES, buildComprehensionPrompt(payload).system, buildComprehensionPrompt(payload).user, 2048),
      );
      assert.ok(held <= ACCOUNT_DAY_CAP_NANO_USD, `${unit} with question=${Boolean(question)} holds $${held / 1e9}`);
    }
    // One more unit is refused as too much code (413), before anything is reserved.
    const over = payloadSizeError({ scope: 'selection', level: 'expert', context: context(code + unit) });
    assert.equal(over?.status, 413, unit);
  }
});

test('the Supabase store sends the account hash to the account RPCs, and Try (no account) to the month RPC', async () => {
  const originalFetch = globalThis.fetch;
  const account = spendAccount('user', 'user-a');
  try {
    for (const [status, expect] of [['ok', 'ok'], ['account_day_cap', 'account_day_cap'], ['month_cap', 'month_cap']] as const) {
      const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        calls.push({ path: url.pathname, body: JSON.parse(String(init?.body ?? '{}')) });
        if (url.pathname.endsWith('/rpc/settle_ai_spend_account')) return new Response(null, { status: 204 });
        return Response.json([{ status, day: '2026-11-02' }]);
      }) as typeof fetch;
      const inner = new SpyProvider({ usage: { inputTokens: 1, outputTokens: 1 } });
      const store = new SupabaseSpendStore('http://127.0.0.1:54321', 'service-role-key');
      const result = await new MeteredProvider(inner, store, account).complete('s', 'u').catch((e: unknown) => e);
      assert.equal(calls[0].path, '/rest/v1/rpc/reserve_ai_spend_account', status);
      assert.equal(calls[0].body.p_account_hash, account);
      assert.equal(calls[0].body.p_account_day_cap, ACCOUNT_DAY_CAP_NANO_USD);
      if (expect === 'ok') {
        assert.equal(inner.calls, 1);
        assert.equal(calls[1].path, '/rest/v1/rpc/settle_ai_spend_account');
        assert.equal(calls[1].body.p_account_hash, account);
      } else {
        assert.equal(inner.calls, 0);
        assert.ok(result instanceof AiPausedError && result.reason === expect, status);
      }
    }

    // Without an account the month RPC answers; an account stop from it is not a valid answer.
    const paths: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      paths.push(new URL(input instanceof Request ? input.url : String(input)).pathname);
      return Response.json([{ status: 'account_day_cap', day: '2026-11-02' }]);
    }) as typeof fetch;
    const result = await new MeteredProvider(new SpyProvider({}), new SupabaseSpendStore('http://127.0.0.1:54321', 'k')).complete('s', 'u').catch((e: unknown) => e);
    assert.deepEqual(paths, ['/rest/v1/rpc/reserve_ai_spend_month']);
    assert.ok(result instanceof AiPausedError && result.reason === 'unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the Supabase store accepts only a well-formed answer; anything else pauses AI', async () => {
  const originalFetch = globalThis.fetch;
  const answers: Array<{ status: number; body: unknown; expect: 'ok' | 'day_cap' | 'month_cap' | 'paused' }> = [
    { status: 200, body: [{ status: 'ok', day: '2026-10-29' }], expect: 'ok' },
    { status: 200, body: [{ status: 'day_cap', day: '2026-10-29' }], expect: 'day_cap' },
    { status: 200, body: [{ status: 'month_cap', day: '2026-10-29' }], expect: 'month_cap' },
    { status: 200, body: [{ status: 'total_cap', day: '2026-10-29' }], expect: 'paused' },
    { status: 200, body: [{ status: 'OK', day: '2026-10-29' }], expect: 'paused' },
    { status: 200, body: [{ status: 'ok', day: 'tomorrow' }], expect: 'paused' },
    { status: 200, body: [], expect: 'paused' },
    { status: 200, body: null, expect: 'paused' },
    { status: 500, body: { code: 'XX000', message: 'boom' }, expect: 'paused' },
  ];
  try {
    for (const answer of answers) {
      const rpc: string[] = [];
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        rpc.push(url.pathname);
        if (url.pathname.endsWith('/rpc/settle_ai_spend')) return new Response(null, { status: 204 });
        return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'content-type': 'application/json' } });
      }) as typeof fetch;
      const inner = new SpyProvider({ usage: { inputTokens: 1, outputTokens: 1 } });
      const store = new SupabaseSpendStore('http://127.0.0.1:54321', 'service-role-key');
      const result = await new MeteredProvider(inner, store).complete('s', 'u').catch((e: unknown) => e);
      const label = JSON.stringify(answer);
      if (answer.expect === 'ok') {
        assert.equal(inner.calls, 1, label);
        assert.deepEqual(rpc, ['/rest/v1/rpc/reserve_ai_spend_month', '/rest/v1/rpc/settle_ai_spend'], label);
      } else {
        assert.equal(inner.calls, 0, label);
        assert.ok(result instanceof AiPausedError, label);
        assert.equal(result.reason, answer.expect === 'paused' ? 'unavailable' : answer.expect, label);
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Routes: a full meter answers with the paused text and no provider host is ever called.
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
let hosts: string[] = [];

function fullMeter(): void {
  const store = new MemorySpendStore();
  store.days.set(new Date().toISOString().slice(0, 10), DAY_CAP_NANO_USD);
  (globalThis as unknown as { __unvibeSpendMemory?: MemorySpendStore }).__unvibeSpendMemory = store;
}

beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: 'test', ANTHROPIC_API_KEY: 'sk-ant-test', GEMINI_API_KEY: 'gemini-key', GOOGLE_API_KEY: 'google-key', UNVIBE_TRIAL_TOKEN: 'local-trial-token-abcdefghijklmnop' };
  delete process.env.ENABLE_MOCK_AI;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  hosts = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    hosts.push(new URL(input instanceof Request ? input.url : String(input)).hostname);
    throw new Error('no provider call is expected');
  }) as typeof fetch;
});
afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
  delete (globalThis as unknown as { __unvibeSpendMemory?: MemorySpendStore }).__unvibeSpendMemory;
});

function appRequest(route: string): Request {
  return new Request(`http://localhost/api/v1/${route}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.UNVIBE_TRIAL_TOKEN}`, 'x-unvibe-install-id': `paused-${crypto.randomUUID().replaceAll('-', '')}` },
    body: JSON.stringify({ scope: 'selection', level: 'beginner', model: 'google/gemini', context: { language: 'typescript', projectStructure: [], imports: [], code: 'const x = 1;' } }),
  });
}

test('reviews past the daily stop: the stream says the AI limit is reached for today; no provider is called', async () => {
  fullMeter();
  const response = await review(appRequest('reviews'));
  assert.equal(response.status, 200);
  const events = (await response.text()).split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')));
  assert.deepEqual(events, [{ type: 'error', message: AI_LIMIT_TODAY }]);
  assert.deepEqual(hosts, []);
});

test('comprehension past the daily stop: 503 ai_paused; no provider is called', async () => {
  fullMeter();
  const response = await comprehension(appRequest('comprehension'));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'ai_paused', message: AI_LIMIT_TODAY });
  assert.deepEqual(hosts, []);
});

test('Try it past the daily stop: 503 with the paused text; no provider is called', async () => {
  fullMeter();
  const response = await tryRoute(new Request('http://localhost/api/v1/try', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify({ code: 'const a = 1;', consent: { v: TRY_CONSENT_VERSION, aiSend: true, age18: true } }),
  }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: AI_LIMIT_TODAY });
  assert.deepEqual(hosts, []);
});

test("an install past its daily share: the app's explanation and the quiz say so; no provider is called", async () => {
  const store = new MemorySpendStore();
  (globalThis as unknown as { __unvibeSpendMemory?: MemorySpendStore }).__unvibeSpendMemory = store;
  const first = appRequest('reviews');
  const install = trialInstallFromRequest(first);
  assert.ok(install);
  store.accounts.set(`${new Date().toISOString().slice(0, 10)} ${spendAccount('install', install)}`, ACCOUNT_DAY_CAP_NANO_USD);
  const events = (await (await review(first)).text()).split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')));
  assert.deepEqual(events, [{ type: 'error', message: AI_LIMIT_ACCOUNT }]);
  const sameInstall = new Request('http://localhost/api/v1/comprehension', { method: 'POST', headers: first.headers, body: JSON.stringify({ scope: 'selection', level: 'beginner', context: { language: 'typescript', projectStructure: [], imports: [], code: 'const x = 1;' } }) });
  const quiz = await comprehension(sameInstall);
  assert.equal(quiz.status, 503);
  assert.deepEqual(await quiz.json(), { error: 'ai_paused', message: AI_LIMIT_ACCOUNT });
  assert.deepEqual(hosts, []);
});

test('production without the meter store refuses every call before any provider request', async () => {
  Object.assign(process.env, { NODE_ENV: 'production' });
  const provider = selectProvider();
  assert.ok(provider);
  const error = await provider.complete('s', 'u').catch((e: unknown) => e);
  assert.ok(error instanceof AiPausedError);
  assert.equal(error.message, AI_PAUSED);
  assert.deepEqual(hosts, []);
});

test('AI_MAINTENANCE=1 pauses the app, the quiz and Try with the maintenance text; nothing is reserved or sent', async () => {
  const store = new MemorySpendStore();
  (globalThis as unknown as { __unvibeSpendMemory?: MemorySpendStore }).__unvibeSpendMemory = store;
  process.env.AI_MAINTENANCE = '1';
  const events = (await (await review(appRequest('reviews'))).text()).split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')));
  assert.deepEqual(events, [{ type: 'error', message: AI_MAINTENANCE }]);
  const quiz = await comprehension(appRequest('comprehension'));
  assert.equal(quiz.status, 503);
  assert.deepEqual(await quiz.json(), { error: 'ai_paused', message: AI_MAINTENANCE });
  const demo = await tryRoute(new Request('http://localhost/api/v1/try', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.10' },
    body: JSON.stringify({ code: 'const a = 1;', consent: { v: TRY_CONSENT_VERSION, aiSend: true, age18: true } }),
  }));
  assert.equal(demo.status, 503);
  assert.deepEqual(await demo.json(), { error: AI_MAINTENANCE });
  assert.deepEqual(hosts, []);
  assert.equal(sum(store), 0, 'nothing was reserved');
});

test('the maintenance switch is off for any value but 1', async () => {
  for (const value of ['0', 'true', '', ' 2 ']) {
    process.env.AI_MAINTENANCE = value;
    const inner = new SpyProvider({ usage: { inputTokens: 1, outputTokens: 1 } });
    const { text } = await new MeteredProvider(inner, new MemorySpendStore()).complete('s', 'u');
    assert.equal(text, 'answer', JSON.stringify(value));
  }
});

test('a provider failure quoting a key reaches neither the response nor the log', async () => {
  globalThis.fetch = (async () => { throw new TypeError('fetch failed: x-api-key sk-ant-api03-LEAKLEAKLEAK'); }) as typeof fetch;
  const logged: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => { logged.push(args.map((a) => (a instanceof Error ? `${a.message} ${String(a.cause)}` : String(a))).join(' ')); };
  try {
    const response = await review(appRequest('reviews'));
    const body = await response.text();
    assert.match(body, /The AI service had a problem/);
    assert.doesNotMatch(body, /sk-ant/);
    assert.ok(logged.some((line) => line.includes('review provider failed')));
    assert.ok(logged.every((line) => !line.includes('sk-ant')), logged.join('\n'));
  } finally {
    console.error = originalError;
  }
});
