import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import type { Completion, TokenUsage } from '../src/ai/provider';
import {
  AI_PAUSED,
  AI_PAUSED_TODAY,
  AiPausedError,
  DAY_CAP_NANO_USD,
  MemorySpendStore,
  MeteredProvider,
  SupabaseSpendStore,
  TOTAL_CAP_NANO_USD,
  costNanoUsd,
  worstCaseNanoUsd,
  type MeterableProvider,
  type SpendStore,
} from '../src/ai/spendMeter';
import { POST as review } from '../app/api/v1/reviews/route';
import { POST as comprehension } from '../app/api/v1/comprehension/route';
import { POST as tryRoute } from '../app/api/v1/try/route';
import { TRY_CONSENT_VERSION } from '../src/lib/tryDemo';
import { selectProvider } from '../src/ai';

/** A provider double that records calls and answers with fixed usage (or none, or a failure). */
class SpyProvider implements MeterableProvider {
  readonly name = 'spy';
  readonly mock = false;
  readonly maxOutputTokens = 2048;
  calls = 0;
  constructor(private readonly outcome: { usage?: TokenUsage; fail?: Error }) {}
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

test('prices are $0.10 / $0.50 per million tokens, and a worst case covers chars/3 of the prompt plus the whole output budget', () => {
  assert.equal(costNanoUsd({ inputTokens: 1_000_000, outputTokens: 0 }), 100_000_000); // $0.10
  assert.equal(costNanoUsd({ inputTokens: 0, outputTokens: 1_000_000 }), 500_000_000); // $0.50
  assert.equal(worstCaseNanoUsd(3001, 2048), 1001 * 100 + 2048 * 500);
  // The largest call the API accepts (120k chars) reserves about half a cent, so $1 a day covers
  // at least 190 of them even before settling.
  assert.ok(Math.floor(DAY_CAP_NANO_USD / worstCaseNanoUsd(120_000, 2048)) >= 190);
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
  assert.equal(reservedDuringCall, worstCaseNanoUsd(60, 2048));
  assert.equal(sum(store), 1000 * 100 + 200 * 500);
});

test('a call without measured usage, or one that failed after it was sent, keeps its whole worst case', async () => {
  for (const outcome of [{}, { usage: { inputTokens: 1, outputTokens: 1, estimated: true as const } }, { fail: new Error('socket hang up') }]) {
    const store = new MemorySpendStore();
    const metered = new MeteredProvider(new SpyProvider(outcome), store);
    await metered.stream('sys', 'user', () => {}).catch(() => undefined);
    assert.equal(sum(store), worstCaseNanoUsd(7, 2048), JSON.stringify(outcome));
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
  assert.equal(error.message, AI_PAUSED_TODAY);
  assert.equal(inner.calls, 0);
  assert.equal(store.days.get('2026-10-29'), DAY_CAP_NANO_USD - 1000);

  now = new Date('2026-10-30T00:00:00Z');
  await metered.complete('s', 'u');
  assert.equal(inner.calls, 1);
});

test('the total stop holds on a new day and refuses the call that would cross it', async () => {
  const store = new MemorySpendStore(() => new Date('2026-11-02T08:00:00Z'));
  store.days.set('2026-11-01', TOTAL_CAP_NANO_USD - worstCaseNanoUsd(2, 2048) + 1);
  const inner = new SpyProvider({ usage: { inputTokens: 1, outputTokens: 1 } });
  const error = await new MeteredProvider(inner, store).complete('s', 'u').catch((e: unknown) => e);
  assert.ok(error instanceof AiPausedError);
  assert.equal(error.reason, 'total_cap');
  assert.equal(error.message, AI_PAUSED);
  assert.equal(inner.calls, 0);
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
  assert.equal(sum(memory), worstCaseNanoUsd(2, 2048));
});

test('the Supabase store accepts only a well-formed answer; anything else pauses AI', async () => {
  const originalFetch = globalThis.fetch;
  const answers: Array<{ status: number; body: unknown; expect: 'ok' | 'day_cap' | 'total_cap' | 'paused' }> = [
    { status: 200, body: [{ status: 'ok', day: '2026-10-29' }], expect: 'ok' },
    { status: 200, body: [{ status: 'day_cap', day: '2026-10-29' }], expect: 'day_cap' },
    { status: 200, body: [{ status: 'total_cap', day: '2026-10-29' }], expect: 'total_cap' },
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
        assert.deepEqual(rpc, ['/rest/v1/rpc/reserve_ai_spend', '/rest/v1/rpc/settle_ai_spend'], label);
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

test('reviews past the daily stop: the stream says AI is paused for today; no provider is called', async () => {
  fullMeter();
  const response = await review(appRequest('reviews'));
  assert.equal(response.status, 200);
  const events = (await response.text()).split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')));
  assert.deepEqual(events, [{ type: 'error', message: AI_PAUSED_TODAY }]);
  assert.deepEqual(hosts, []);
});

test('comprehension past the daily stop: 503 ai_paused; no provider is called', async () => {
  fullMeter();
  const response = await comprehension(appRequest('comprehension'));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'ai_paused', message: AI_PAUSED_TODAY });
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
  assert.deepEqual(await response.json(), { error: AI_PAUSED_TODAY });
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
