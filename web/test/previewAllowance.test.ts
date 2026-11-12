import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { POST as preview } from '../app/api/v1/previews/route';
import { POST as review } from '../app/api/v1/reviews/route';
import { ANTHROPIC_MODEL, SHORT_MAX_TOKENS } from '../src/ai/anthropic';
import { BilledProviderError, ProviderRejectedError, type Completion, type TokenUsage } from '../src/ai/provider';
import {
  ACCOUNT_DAY_CAP_NANO_USD,
  AiPausedError,
  DAY_CAP_NANO_USD,
  MODEL_PRICES,
  MONTH_CAP_NANO_USD,
  MemorySpendStore,
  MeteredProvider,
  PREVIEW_ACCOUNT_DAY_LIMIT,
  PREVIEW_DAY_CAP_NANO_USD,
  PreviewLimitError,
  SupabaseSpendStore,
  spendAccount,
  worstCaseNanoUsd,
  type MeterableProvider,
  type SpendStore,
} from '../src/ai/spendMeter';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';
import { TRIAL_PREVIEW_IP_DAILY_LIMIT, trialCounterUsed, trialInstallFromRequest, trialIpKey, trialUsageLine } from '../src/lib/trialAccess';
import { ANTHROPIC_HOST, anthropicAnswer, anthropicError } from './anthropicStub';

/** A provider double that records calls and answers with fixed usage, or fails. */
class SpyProvider implements MeterableProvider {
  readonly name = 'spy';
  readonly mock = false;
  readonly model = ANTHROPIC_MODEL;
  readonly maxOutputTokens = SHORT_MAX_TOKENS;
  calls = 0;
  during: (() => void) | null = null;
  constructor(private readonly outcome: { usage?: TokenUsage; fail?: Error } = { usage: { inputTokens: 100, outputTokens: 10 } }) {}
  async stream(_s: string, _u: string, onToken: (t: string) => void): Promise<TokenUsage | undefined> {
    this.calls += 1;
    this.during?.();
    if (this.outcome.fail) throw this.outcome.fail;
    onToken('- It adds one.');
    return this.outcome.usage;
  }
  async complete(): Promise<Completion> {
    this.calls += 1;
    if (this.outcome.fail) throw this.outcome.fail;
    return { text: '- It adds one.', usage: this.outcome.usage };
  }
}

const PRICES = MODEL_PRICES[ANTHROPIC_MODEL];
const WORST = worstCaseNanoUsd(PRICES, 's', 'u', SHORT_MAX_TOKENS);
const MEASURED = 100 * PRICES.input + 10 * PRICES.output;
const DAY = '2026-11-11';
const kindDay = (store: MemorySpendStore, day = DAY) => store.kindDays.get(`ai_preview ${day}`) ?? 0;
const kindCalls = (store: MemorySpendStore, account: string, day = DAY) => store.kindAccounts.get(`ai_preview ${day} ${account}`) ?? 0;
const previewOf = (inner: SpyProvider, store: SpendStore | null, account?: string) => new MeteredProvider(inner, store, account, 'ai_preview');
const run = (provider: MeteredProvider) => provider.stream('s', 'u', () => {}).catch((e: unknown) => e);

// --- The meter: a preview is held inside the shared caps, and its own allowance sits on top.

test('a preview reserves through the meter: it counts toward the day, the month and the account, and settles to the measured cost', async () => {
  const store = new MemorySpendStore(() => new Date(`${DAY}T10:00:00Z`));
  const account = spendAccount('install', 'install-a');
  const inner = new SpyProvider();
  const held: number[] = [];
  inner.during = () => held.push(store.days.get(DAY) ?? 0, store.accounts.get(`${DAY} ${account}`) ?? 0, kindDay(store));
  await previewOf(inner, store, account).stream('s', 'u', () => {});
  assert.deepEqual(held, [WORST, WORST, WORST], 'the worst case is held on the shared day (and so the month), the account and the preview day');
  assert.equal(store.days.get(DAY), MEASURED);
  assert.equal(store.accounts.get(`${DAY} ${account}`), MEASURED);
  assert.equal(kindDay(store), MEASURED);
  assert.equal(kindCalls(store, account), 1);
});

test('a preview past any shared cap is refused by that cap, nothing is sent, and the preview is given back', async () => {
  const account = spendAccount('user', 'user-a');
  const fills: Array<[string, (store: MemorySpendStore) => void]> = [
    ['day_cap', (store) => store.days.set(DAY, DAY_CAP_NANO_USD)],
    ['month_cap', (store) => store.days.set('2026-11-01', MONTH_CAP_NANO_USD)],
    ['account_day_cap', (store) => store.accounts.set(`${DAY} ${account}`, ACCOUNT_DAY_CAP_NANO_USD)],
  ];
  for (const [reason, fill] of fills) {
    const store = new MemorySpendStore(() => new Date(`${DAY}T10:00:00Z`));
    fill(store);
    const inner = new SpyProvider();
    const error = await run(previewOf(inner, store, account));
    assert.ok(error instanceof AiPausedError && error.reason === reason, reason);
    assert.equal(inner.calls, 0, reason);
    assert.equal(kindDay(store), 0, reason);
    assert.equal(kindCalls(store, account), 0, reason);
  }
});

test('the 21st preview for one account in a UTC day is refused; other accounts and the next UTC day are not', async () => {
  let now = new Date(`${DAY}T10:00:00Z`);
  const store = new MemorySpendStore(() => now);
  const heavy = spendAccount('install', 'install-heavy');
  const inner = new SpyProvider();
  for (let i = 0; i < PREVIEW_ACCOUNT_DAY_LIMIT; i += 1) await previewOf(inner, store, heavy).stream('s', 'u', () => {});
  assert.equal(PREVIEW_ACCOUNT_DAY_LIMIT, 20);
  const spent = store.days.get(DAY);

  const error = await run(previewOf(inner, store, heavy));
  assert.ok(error instanceof PreviewLimitError);
  assert.equal(error.reason, 'kind_account_calls');
  assert.equal(inner.calls, 20, 'the 21st never reaches the provider');
  assert.equal(store.days.get(DAY), spent, 'a refused preview counts nowhere');
  assert.equal(kindCalls(store, heavy), 20);

  await previewOf(inner, store, spendAccount('install', 'install-other')).stream('s', 'u', () => {});
  assert.equal(inner.calls, 21);
  now = new Date('2026-11-12T00:00:00Z');
  await previewOf(inner, store, heavy).stream('s', 'u', () => {});
  assert.equal(inner.calls, 22);
});

test('past the $2 preview budget for everyone, previews are refused before the caps and explanations still go through', async () => {
  const store = new MemorySpendStore(() => new Date(`${DAY}T10:00:00Z`));
  assert.equal(PREVIEW_DAY_CAP_NANO_USD, 2_000_000_000);
  store.kindDays.set(`ai_preview ${DAY}`, PREVIEW_DAY_CAP_NANO_USD - WORST + 1);
  const account = spendAccount('user', 'user-b');
  const inner = new SpyProvider();

  const error = await run(previewOf(inner, store, account));
  assert.ok(error instanceof PreviewLimitError);
  assert.equal(error.reason, 'kind_day_cap');
  assert.equal(inner.calls, 0);
  assert.equal(store.days.get(DAY) ?? 0, 0, 'nothing reserved on the shared caps');
  assert.equal(kindCalls(store, account), 0);

  await new MeteredProvider(inner, store, account).stream('s', 'u', () => {});
  assert.equal(inner.calls, 1, 'the explanation is not refused');
});

test('an explanation never draws on the preview budget or the preview count', async () => {
  const store = new MemorySpendStore(() => new Date(`${DAY}T10:00:00Z`));
  const account = spendAccount('install', 'install-c');
  const inner = new SpyProvider();
  for (let i = 0; i < 5; i += 1) await new MeteredProvider(inner, store, account).stream('s', 'u', () => {});
  assert.equal(kindDay(store), 0);
  assert.equal(kindCalls(store, account), 0);
  for (let i = 0; i < PREVIEW_ACCOUNT_DAY_LIMIT; i += 1) await previewOf(inner, store, account).stream('s', 'u', () => {});
  assert.equal(inner.calls, 5 + PREVIEW_ACCOUNT_DAY_LIMIT, 'all 20 previews still fit after the explanations');
});

test('an error Anthropic answered with (not billed) gives the preview back; a cut stream keeps it counted', async () => {
  const account = spendAccount('install', 'install-d');
  const rejected = new MemorySpendStore(() => new Date(`${DAY}T10:00:00Z`));
  await run(previewOf(new SpyProvider({ fail: new ProviderRejectedError(529, 'Anthropic API 529: overloaded_error') }), rejected, account));
  assert.equal(kindDay(rejected), 0);
  assert.equal(kindCalls(rejected, account), 0);
  assert.equal(rejected.days.get(DAY), 0);

  const cut = new MemorySpendStore(() => new Date(`${DAY}T10:00:00Z`));
  await run(previewOf(new SpyProvider({ fail: new BilledProviderError(new Error('stream cut'), { inputTokens: 1, outputTokens: 1, estimated: true }) }), cut, account));
  assert.equal(kindDay(cut), WORST);
  assert.equal(kindCalls(cut, account), 1);
  assert.equal(cut.days.get(DAY), WORST);
});

test('fail closed: a preview without an account, without a store, or with a store that cannot count it is refused before anything is sent', async () => {
  const memory = new MemorySpendStore(() => new Date(`${DAY}T10:00:00Z`));
  const broken: SpendStore = {
    reserve: (n, account) => memory.reserve(n, account),
    settle: (r, d) => memory.settle(r, d),
    reserveKind: async () => { throw new Error('connection refused'); },
    settleKind: async () => {},
  };
  const account = spendAccount('user', 'user-e');
  for (const [label, provider] of [['no account', previewOf(new SpyProvider(), memory)], ['no store', previewOf(new SpyProvider(), null, account)], ['broken store', previewOf(new SpyProvider(), broken, account)]] as const) {
    const error = await run(provider);
    assert.ok(error instanceof AiPausedError && error.reason === 'unavailable', label);
  }
  assert.equal(memory.days.get(DAY) ?? 0, 0);
});

test('the Supabase store checks the preview allowance first, then the account caps, and settles both', async () => {
  const originalFetch = globalThis.fetch;
  const account = spendAccount('user', 'user-f');
  const runWith = async (answers: Record<string, unknown>) => {
    const calls: Array<{ fn: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const fn = new URL(input instanceof Request ? input.url : String(input)).pathname.replace('/rest/v1/rpc/', '');
      calls.push({ fn, body: JSON.parse(String(init?.body ?? '{}')) });
      return fn.startsWith('settle_') ? new Response(null, { status: 204 }) : Response.json(answers[fn]);
    }) as typeof fetch;
    const inner = new SpyProvider();
    const result = await run(previewOf(inner, new SupabaseSpendStore('http://127.0.0.1:54321', 'service-role-key'), account));
    return { calls, inner, result };
  };
  try {
    const ok = await runWith({ reserve_ai_spend_kind: [{ status: 'ok', day: DAY }], reserve_ai_spend_account: [{ status: 'ok', day: DAY }] });
    assert.deepEqual(ok.calls.map((call) => call.fn), ['reserve_ai_spend_kind', 'reserve_ai_spend_account', 'settle_ai_spend_account', 'settle_ai_spend_kind']);
    assert.equal(ok.inner.calls, 1);
    assert.deepEqual(ok.calls[0].body, {
      p_meter: 'anthropic', p_kind: 'ai_preview', p_account_hash: account, p_nano_usd: WORST,
      p_kind_day_cap: PREVIEW_DAY_CAP_NANO_USD, p_account_day_calls: PREVIEW_ACCOUNT_DAY_LIMIT,
    });
    assert.equal(ok.calls[1].body.p_account_day_cap, ACCOUNT_DAY_CAP_NANO_USD, 'the same account caps as an explanation');
    assert.deepEqual(ok.calls[3].body, { p_meter: 'anthropic', p_kind: 'ai_preview', p_day: DAY, p_account_hash: account, p_delta_nano_usd: MEASURED - WORST, p_release: false });

    for (const stop of ['kind_day_cap', 'kind_account_calls'] as const) {
      const refused = await runWith({ reserve_ai_spend_kind: [{ status: stop, day: DAY }] });
      assert.deepEqual(refused.calls.map((call) => call.fn), ['reserve_ai_spend_kind'], stop);
      assert.ok(refused.result instanceof PreviewLimitError && refused.result.reason === stop, stop);
      assert.equal(refused.inner.calls, 0, stop);
    }

    const capped = await runWith({ reserve_ai_spend_kind: [{ status: 'ok', day: DAY }], reserve_ai_spend_account: [{ status: 'account_day_cap', day: DAY }] });
    assert.deepEqual(capped.calls.map((call) => call.fn), ['reserve_ai_spend_kind', 'reserve_ai_spend_account', 'settle_ai_spend_kind']);
    assert.equal(capped.calls[2].body.p_release, true, 'the preview is given back');
    assert.equal(capped.calls[2].body.p_delta_nano_usd, -WORST);
    assert.ok(capped.result instanceof AiPausedError && capped.result.reason === 'account_day_cap');

    for (const answer of [[{ status: 'account_day_cap', day: DAY }], [{ status: 'ok', day: 'today' }], [], null]) {
      const odd = await runWith({ reserve_ai_spend_kind: answer });
      assert.ok(odd.result instanceof AiPausedError && odd.result.reason === 'unavailable', JSON.stringify(answer));
      assert.equal(odd.inner.calls, 0);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// --- The route: real handlers, memory stores; only the Anthropic HTTP boundary is local.

const TOKEN = 'local-trial-token-abcdefghijklmnop';
const BASE_ENV = { ...process.env };
let anthropicBodies: Array<{ max_tokens: number; system: string; messages: Array<{ content: string }> }> = [];
/** `empty` streams no text; `abort-after-send` is the client leaving once the request reached Anthropic. */
let upstream: 'answer' | 'fail' | 'empty' | 'abort-after-send' = 'answer';
/** The client side of the request under test, for the abort cases. */
let client: AbortController | null = null;
let meter: MemorySpendStore;

beforeEach(() => {
  process.env = { ...BASE_ENV, NODE_ENV: 'test', ANTHROPIC_API_KEY: 'local-anthropic-key', UNVIBE_TRIAL_TOKEN: TOKEN };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.ENABLE_MOCK_AI;
  delete process.env.AI_MAINTENANCE;
  delete process.env.UNVIBE_TRIAL_PREVIEW_IP_DAILY_LIMIT;
  anthropicBodies = [];
  upstream = 'answer';
  client = null;
  // A fixed clock for the meter, so no test reads a different UTC day than the request counted on.
  meter = new MemorySpendStore(() => new Date(`${DAY}T10:00:00Z`));
  const g = globalThis as unknown as TestGlobals; // the memory stores' globals (spendMeter.ts, trialAccess.ts)
  g.__unvibeSpendMemory = meter;
  g.__unvibeTrialUsage = new Map();
  g.__unvibeTrialInstalls = new Map();
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname !== ANTHROPIC_HOST) throw new Error(`Unexpected request: ${url}`);
    anthropicBodies.push(JSON.parse(String(init?.body)));
    if (upstream === 'abort-after-send') {
      client?.abort();
      init?.signal?.throwIfAborted();
    }
    if (upstream === 'fail') return anthropicError();
    return anthropicAnswer(init, upstream === 'empty' ? '' : '- It returns its input.');
  }) as typeof fetch;
});

type TestGlobals = { __unvibeSpendMemory?: MemorySpendStore; __unvibeTrialUsage?: Map<string, unknown>; __unvibeTrialInstalls?: Map<string, { startedAt: string }> };

/** The JSON body as a plain record; the assertions check the route's contract field by field. */
async function jsonRecord(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();
  assert.ok(body !== null && typeof body === 'object' && !Array.isArray(body), 'expected a JSON object');
  return Object.fromEntries(Object.entries(body));
}

const context = { language: 'typescript', projectStructure: [], imports: [], code: 'const identity = (x: number) => x;' };

function trialHeaders(installId: string, ip = '203.0.113.20'): Record<string, string> {
  return { authorization: `Bearer ${TOKEN}`, 'x-unvibe-install-id': installId, 'x-forwarded-for': ip };
}

function previewRequest(headers: Record<string, string>, body: Record<string, unknown> = { level: 'beginner', context }): Request {
  return new Request('http://localhost/api/v1/previews', { method: 'POST', headers, body: JSON.stringify(body) });
}

function explainRequest(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/v1/reviews', { method: 'POST', headers, body: JSON.stringify({ scope: 'selection', level: 'beginner', context }) });
}

async function events(response: Response): Promise<Array<{ type: string }>> {
  return (await response.text()).split('\n\n').filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, '')));
}

async function streamed(response: Response): Promise<boolean> {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/event-stream');
  return (await events(response)).some((event) => event.type === 'done');
}

test('Security: a refused preview (its 20 a day used) leaves the next explanation allowed, and previews take no explanation', async () => {
  const headers = trialHeaders('preview-install-1');
  for (let i = 0; i < PREVIEW_ACCOUNT_DAY_LIMIT; i += 1) assert.ok(await streamed(await preview(previewRequest(headers))), `preview ${i + 1}`);
  const calls = anthropicBodies.length;

  const refused = await preview(previewRequest(headers));
  assert.equal(refused.status, 429);
  const body = await jsonRecord(refused);
  assert.equal(body.error, 'preview_limit_reached');
  assert.equal(body.reason, 'account_daily_limit');
  assert.equal(body.limit, PREVIEW_ACCOUNT_DAY_LIMIT);
  assert.equal(typeof body.message, 'string');
  assert.equal(anthropicBodies.length, calls, 'the refused preview sent nothing');

  const install = trialInstallFromRequest(previewRequest(headers));
  assert.ok(install);
  assert.equal((await trialUsageLine(install, 'ai_explanation')).used, 0, '20 previews used none of the trial\'s explanations');
  assert.ok(await streamed(await review(explainRequest(headers))), 'the next explanation goes through');
  assert.equal((await trialUsageLine(install, 'ai_explanation')).used, 1);
});

test('past the $2 preview budget for everyone: 429 daily_budget, nothing sent, and explanations still go through', async () => {
  meter.kindDays.set(`ai_preview ${DAY}`, PREVIEW_DAY_CAP_NANO_USD);
  const headers = trialHeaders('preview-install-2');
  const refused = await preview(previewRequest(headers));
  assert.equal(refused.status, 429);
  const body = await jsonRecord(refused);
  assert.equal(body.error, 'preview_limit_reached');
  assert.equal(body.reason, 'daily_budget');
  assert.equal(anthropicBodies.length, 0);
  assert.equal(meter.days.get(DAY) ?? 0, 0, 'the shared caps were never reserved');
  assert.ok(await streamed(await review(explainRequest(headers))));
});

test('an explanation does not reduce preview headroom', async () => {
  const headers = trialHeaders('preview-install-3');
  for (let i = 0; i < 3; i += 1) assert.ok(await streamed(await review(explainRequest(headers))));
  assert.equal(meter.kindDays.size, 0);
  assert.equal(meter.kindAccounts.size, 0);
  for (let i = 0; i < PREVIEW_ACCOUNT_DAY_LIMIT; i += 1) assert.ok(await streamed(await preview(previewRequest(headers))), `preview ${i + 1}`);
});

test('the output budget is 400 tokens whatever the client asks for, and only the selection context reaches the prompt', async () => {
  const response = await preview(previewRequest(trialHeaders('preview-install-4'), {
    level: 'expert', scope: 'project', detail: 'full', question: 'QUESTION-FIELD-MARKER', shortAnswer: 'SHORT-ANSWER-MARKER',
    max_tokens: 4096, maxTokens: 4096, maxOutputTokens: 4096, model: 'claude-fable-5', context,
  }));
  assert.ok(await streamed(response));
  assert.equal(anthropicBodies.length, 1);
  assert.equal(SHORT_MAX_TOKENS, 400);
  assert.equal(anthropicBodies[0].max_tokens, 400);
  assert.equal(anthropicBodies[0].max_tokens, SHORT_MAX_TOKENS);
  const user = anthropicBodies[0].messages[0].content;
  assert.ok(user.includes(context.code));
  assert.ok(!user.includes('QUESTION-FIELD-MARKER') && !user.includes('SHORT-ANSWER-MARKER'), 'fields outside level and context are dropped');
});

test('a preview through the route settles on the shared day, the account and the preview day, keyed on the install', async () => {
  const headers = trialHeaders('preview-install-5');
  const install = trialInstallFromRequest(previewRequest(headers));
  assert.ok(install);
  assert.ok(await streamed(await preview(previewRequest(headers))));
  const account = spendAccount('install', install);
  assert.equal(meter.kindAccounts.get(`ai_preview ${DAY} ${account}`), 1);
  const measured = 120 * PRICES.input + 40 * PRICES.output; // STUB_USAGE
  assert.equal(meter.days.get(DAY), measured);
  assert.equal(meter.accounts.get(`${DAY} ${account}`), measured);
  assert.equal(meter.kindDays.get(`ai_preview ${DAY}`), measured);
});

test('ordinary code that names keys, tokens or secrets goes through, in the selection and in nearby files (the app scans before sending, as for explanations)', async () => {
  const lines = [
    'const params = { grant_type: "refresh_token", token: "access_token" };',
    'const client = new OpenAI({ apiKey: "YOUR_API_KEY" });',
    'await signIn({ email: "a@b.co", password: "correct-horse" });',
    '      secretName: postgres-creds2',
    'tokenizer: bert-base-uncased-v2',
    'const secret = "test-secret-123";',
    'passportNumber: AB1234567',
  ];
  for (const line of lines) {
    assert.ok(await streamed(await preview(previewRequest(trialHeaders('preview-install-6'), { level: 'beginner', context: { ...context, code: line } }))), line);
    assert.ok(await streamed(await preview(previewRequest(trialHeaders('preview-install-6b'), { level: 'beginner', context: { ...context, enclosing: line } }))), `nearby: ${line}`);
  }
  assert.equal(anthropicBodies.length, lines.length * 2);
});

test('one network gets a capped number of trial previews a day; its explanations and signed-in previews are not affected', async () => {
  process.env.UNVIBE_TRIAL_PREVIEW_IP_DAILY_LIMIT = '2';
  assert.equal(TRIAL_PREVIEW_IP_DAILY_LIMIT, 60);
  for (const id of ['preview-net-a', 'preview-net-b']) assert.ok(await streamed(await preview(previewRequest(trialHeaders(id, '198.51.100.7')))), id);
  const sent = anthropicBodies.length;

  const rotated = trialHeaders('preview-net-c', '198.51.100.7');
  const refused = await preview(previewRequest(rotated));
  assert.equal(refused.status, 429);
  const body = await jsonRecord(refused);
  assert.equal(body.error, 'preview_limit_reached');
  assert.equal(body.reason, 'network_daily_limit');
  assert.equal(body.limit, 2);
  assert.equal(anthropicBodies.length, sent, 'nothing sent');
  assert.equal(meter.days.get(DAY), 2 * (120 * PRICES.input + 40 * PRICES.output), 'nothing reserved for the refused preview');

  assert.ok(await streamed(await review(explainRequest(rotated))), 'an explanation from the same network still goes through');
  assert.ok(await streamed(await preview(previewRequest(trialHeaders('preview-net-d', '198.51.100.8')))), 'another network still has previews');
  const signed = await getStore().signIn(`preview-net-${crypto.randomUUID()}@preview.test`);
  assert.ok(await streamed(await preview(previewRequest({ authorization: `Bearer ${signed.token}`, 'x-forwarded-for': '198.51.100.7' }))), 'signed-in previews have no network cap');
});

/** The network's trial previews counted today (the route counts on the real clock's UTC day). */
async function networkUsed(ip = '203.0.113.20'): Promise<number> {
  const key = trialIpKey(ip);
  assert.ok(key);
  return trialCounterUsed(key.replace(/^__ip__:/, '__preview_ip__:'));
}

test('a trial preview the meter refuses gives its network unit back; one that was sent keeps it', async () => {
  process.env.UNVIBE_TRIAL_PREVIEW_IP_DAILY_LIMIT = '2';
  const ip = '198.51.100.30';
  meter.kindDays.set(`ai_preview ${DAY}`, PREVIEW_DAY_CAP_NANO_USD);
  for (const id of ['preview-rel-a', 'preview-rel-b', 'preview-rel-c']) {
    const refused = await preview(previewRequest(trialHeaders(id, ip)));
    assert.equal(refused.status, 429, id);
    assert.equal((await jsonRecord(refused)).reason, 'daily_budget', id);
  }
  assert.equal(await networkUsed(ip), 0, 'three refusals used none of the network\'s two');

  meter.kindDays.clear();
  assert.ok(await streamed(await preview(previewRequest(trialHeaders('preview-rel-d', ip)))));
  assert.equal(await networkUsed(ip), 1, 'a sent preview counts');
  upstream = 'fail';
  await events(await preview(previewRequest(trialHeaders('preview-rel-e', ip))));
  assert.equal(await networkUsed(ip), 2, 'a preview that reached the provider counts even when it failed');
  assert.equal(anthropicBodies.length, 2);
});

test('production without a secret for the per-network key refuses trial previews with 503, as for explanations', async () => {
  Object.assign(process.env, { NODE_ENV: 'production' });
  delete process.env.TRY_IP_SALT;
  const response = await preview(previewRequest(trialHeaders('preview-install-salt')));
  assert.equal(response.status, 503);
  assert.equal((await jsonRecord(response)).error, 'trial_unavailable');
  assert.equal(anthropicBodies.length, 0);
});

test('past a shared cap, a preview gets the same stream error as an explanation, and its preview count is given back', async () => {
  const headers = trialHeaders('preview-install-cap');
  const install = trialInstallFromRequest(previewRequest(headers));
  assert.ok(install);
  const account = spendAccount('install', install);
  const fills: Array<[string, () => void]> = [
    ['account_day_cap', () => meter.accounts.set(`${DAY} ${account}`, ACCOUNT_DAY_CAP_NANO_USD)],
    ['day_cap', () => { meter.accounts.clear(); meter.days.set(DAY, DAY_CAP_NANO_USD); }],
  ];
  for (const [label, fill] of fills) {
    fill();
    const previewed = await preview(previewRequest(headers));
    assert.equal(previewed.status, 200, label);
    const previewEvents = await events(previewed);
    const explained = await events(await review(explainRequest(headers)));
    assert.equal(previewEvents.length, 1, label);
    assert.equal(previewEvents[0].type, 'error', label);
    assert.deepEqual(previewEvents, explained, label);
    assert.equal(meter.kindAccounts.get(`ai_preview ${DAY} ${account}`), 0, label);
    assert.equal(meter.kindDays.get(`ai_preview ${DAY}`), 0, label);
    assert.equal(await networkUsed(), 0, `${label}: the network unit is given back`);
  }
  assert.equal(anthropicBodies.length, 0);
});

test('a client that leaves before the request is sent gets both holds back; one that leaves after it was sent keeps them', async () => {
  // The client leaves while the meter is counting (before anything is sent).
  class LeavingStore extends MemorySpendStore {
    override async reserve(nanoUsd: number, account?: string) {
      client?.abort();
      return super.reserve(nanoUsd, account);
    }
  }
  meter = new LeavingStore(() => new Date(`${DAY}T10:00:00Z`));
  const g = globalThis as unknown as TestGlobals;
  g.__unvibeSpendMemory = meter;
  const headers = trialHeaders('preview-install-abort');
  const install = trialInstallFromRequest(previewRequest(headers));
  assert.ok(install);
  const account = spendAccount('install', install);
  const body = JSON.stringify({ level: 'beginner', context });
  client = new AbortController();
  await preview(new Request('http://localhost/api/v1/previews', { method: 'POST', headers, body, signal: client.signal }));
  assert.equal(anthropicBodies.length, 0, 'nothing sent');
  assert.equal(meter.days.get(DAY), 0);
  assert.equal(meter.accounts.get(`${DAY} ${account}`), 0);
  assert.equal(meter.kindDays.get(`ai_preview ${DAY}`), 0);
  assert.equal(meter.kindAccounts.get(`ai_preview ${DAY} ${account}`), 0);
  assert.equal(await networkUsed(), 0, 'the network unit is given back');

  // The client leaves once Anthropic has the request: it may be billed, so both worst cases stay.
  meter = new MemorySpendStore(() => new Date(`${DAY}T10:00:00Z`));
  g.__unvibeSpendMemory = meter;
  upstream = 'abort-after-send';
  client = new AbortController();
  await preview(new Request('http://localhost/api/v1/previews', { method: 'POST', headers, body, signal: client.signal }));
  assert.equal(anthropicBodies.length, 1);
  const held = meter.days.get(DAY) ?? 0;
  assert.ok(held > 0);
  assert.equal(meter.kindDays.get(`ai_preview ${DAY}`), held);
  assert.equal(meter.kindAccounts.get(`ai_preview ${DAY} ${account}`), 1);
  assert.equal(await networkUsed(), 1, 'a preview that was sent keeps its network unit');
});

// The test's own timeout is the hang check: a response that never resolves fails it.
test('an answer with no text ends the response and gives the preview back; its measured cost stays counted', { timeout: 5_000 }, async () => {
  upstream = 'empty';
  const headers = trialHeaders('preview-install-empty');
  const install = trialInstallFromRequest(previewRequest(headers));
  assert.ok(install);
  const response = await preview(previewRequest(headers));
  assert.deepEqual((await events(response)).map((event) => event.type), ['done']);
  const account = spendAccount('install', install);
  const measured = 120 * PRICES.input + 40 * PRICES.output; // STUB_USAGE
  assert.equal(meter.kindAccounts.get(`ai_preview ${DAY} ${account}`), 0, 'the preview count is given back');
  assert.equal(meter.kindDays.get(`ai_preview ${DAY}`), measured, 'the billed tokens stay on the preview budget');
  assert.equal(meter.days.get(DAY), measured);
});

test('previews keep the explanation input rules: size cap 413, missing fields 400, no session 401', async () => {
  const huge = await preview(previewRequest(trialHeaders('preview-install-7'), { level: 'beginner', context: { ...context, code: 'x'.repeat(200_001) } }));
  assert.equal(huge.status, 413);
  for (const body of [{ context }, { level: 'beginner' }, { level: 'guru', context }, { level: 'beginner', context: { ...context, code: '  ' } }]) {
    assert.equal((await preview(previewRequest(trialHeaders('preview-install-7'), body))).status, 400, JSON.stringify(body));
  }
  assert.equal((await preview(previewRequest({}))).status, 401);
  assert.equal(anthropicBodies.length, 0);
});

test('a trial whose 30 days ended gets no previews', async () => {
  const headers = trialHeaders('preview-install-8');
  const install = trialInstallFromRequest(previewRequest(headers));
  assert.ok(install);
  const g = globalThis as unknown as TestGlobals;
  assert.ok(g.__unvibeTrialInstalls);
  g.__unvibeTrialInstalls.set(install, { startedAt: new Date(Date.now() - 31 * 86_400_000).toISOString() });
  const response = await preview(previewRequest(headers));
  assert.equal(response.status, 429);
  const ended = await jsonRecord(response);
  assert.equal(ended.error, 'plan_limit_reached');
  assert.equal(typeof ended.resetsAt, 'string');
  assert.equal(anthropicBodies.length, 0);
});

test('a provider failure gives the preview back and says so in the stream', async () => {
  upstream = 'fail';
  const headers = trialHeaders('preview-install-9');
  const install = trialInstallFromRequest(previewRequest(headers));
  assert.ok(install);
  const response = await preview(previewRequest(headers));
  assert.equal(response.status, 200);
  assert.deepEqual((await events(response)).map((event) => event.type), ['error']);
  assert.equal(meter.kindAccounts.get(`ai_preview ${DAY} ${spendAccount('install', install)}`), 0);
});

test("a signed-in user's previews are keyed on the user and take nothing from the plan's explanations", async () => {
  const signed = await getStore().signIn(`preview-${crypto.randomUUID()}@preview.test`);
  await getBillingStore().ensurePersonalWorkspace(signed.userId);
  const headers = { authorization: `Bearer ${signed.token}` };
  for (let i = 0; i < 2; i += 1) assert.ok(await streamed(await preview(previewRequest(headers))));
  assert.equal(meter.kindAccounts.get(`ai_preview ${DAY} ${spendAccount('user', signed.userId)}`), 2);
  const line = (await getBillingStore().overview(signed.userId)).usage.find((entry) => entry.kind === 'ai_explanation');
  assert.equal(line?.used, 0);
  // A second sign-in of the same user shares the same 20.
  const again = await getStore().signIn(signed.email);
  assert.equal(again.userId, signed.userId);
  assert.ok(await streamed(await preview(previewRequest({ authorization: `Bearer ${again.token}` }))));
  assert.equal(meter.kindAccounts.get(`ai_preview ${DAY} ${spendAccount('user', signed.userId)}`), 3);
});
