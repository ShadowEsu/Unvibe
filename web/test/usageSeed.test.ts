import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST as review } from '../app/api/v1/reviews/route';
import { getStore } from '../src/data/store';
import { createBillingStoreFromEnv, getBillingStore, resetBillingStoreCacheForTests } from '../src/billing/store';
import { reserveMeteredAction } from '../src/billing/enforce';

// QA's UNVIBE_TEST_USAGE_SEED=<plan>:<used> on the memory store, through the real explanation route.
// Only the remote AI HTTP boundary is local.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;
delete process.env.OPENROUTER_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ENABLE_MOCK_AI;
process.env.GEMINI_API_KEY = 'local-gemini-key';
process.env.UNVIBE_TRIAL_TOKEN = 'local-trial-token-abcdefghijklmnop';

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.hostname !== 'generativelanguage.googleapis.com') throw new Error(`Unexpected request: ${url}`);
  const chunk = { candidates: [{ content: { parts: [{ text: 'This function returns its input.' }] } }] };
  return url.pathname.endsWith(':streamGenerateContent')
    ? new Response(`data: ${JSON.stringify(chunk)}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
    : Response.json(chunk);
}) as typeof fetch;

const context = { language: 'typescript', projectStructure: [], imports: [], code: 'const identity = (x: number) => x;' };

/** A new signed-in account whose personal workspace the seeded store creates on first use. */
async function seededAccount(seed: string): Promise<Record<string, string>> {
  process.env.UNVIBE_TEST_USAGE_SEED = seed;
  resetBillingStoreCacheForTests();
  const account = await getStore().signIn(`seed-${crypto.randomUUID()}@seed.test`);
  return { authorization: `Bearer ${account.token}` };
}

async function explain(headers: Record<string, string>): Promise<{ status: number; message: string }> {
  const response = await review(new Request('http://localhost/api/v1/reviews', {
    method: 'POST', headers, body: JSON.stringify({ scope: 'selection', level: 'beginner', context }),
  }));
  const text = await response.text();
  if (response.status === 200) return { status: 200, message: '' };
  const body: unknown = JSON.parse(text);
  assert.ok(body !== null && typeof body === 'object' && 'message' in body, 'a refusal carries a message');
  return { status: response.status, message: String(body.message) };
}

for (const [seed, plan, last] of [['pro:199', 'Pro', 200], ['enterprise:999', 'Enterprise', 1_000]] as const) {
  test(`seed ${seed}: ${plan} explanation #${last} is allowed and #${last + 1} is refused`, async () => {
    try {
      const headers = await seededAccount(seed);
      assert.equal((await explain(headers)).status, 200, `#${last} is within the ${plan} allowance`);
      const refused = await explain(headers);
      assert.equal(refused.status, 429, `#${last + 1} is over the ${plan} allowance`);
      assert.match(refused.message, new RegExp(`your ${plan} monthly explanations limit \\(${last.toLocaleString('en-US')}\\)`));
    } finally {
      delete process.env.UNVIBE_TEST_USAGE_SEED;
      resetBillingStoreCacheForTests();
    }
  });
}

test('seed business:1000000: Big Business explanations are unlimited, far above any old cap, and the usage line says so with null', async () => {
  try {
    const headers = await seededAccount('business:1000000');
    assert.equal((await explain(headers)).status, 200);
    assert.equal((await explain(headers)).status, 200);
    const userId = await getStore().userForToken(headers.authorization.replace('Bearer ', ''));
    assert.ok(userId);
    const line = (await getBillingStore().overview(userId)).usage.find((entry) => entry.kind === 'ai_explanation');
    assert.deepEqual({ used: line?.used, limit: line?.limit, remaining: line?.remaining }, { used: 1_000_002, limit: null, remaining: null });
  } finally {
    delete process.env.UNVIBE_TEST_USAGE_SEED;
    resetBillingStoreCacheForTests();
  }
});

test('seed business: 20,000 questions this month (twice the old cap) still leave the next one allowed', async () => {
  try {
    process.env.UNVIBE_TEST_USAGE_SEED = 'business:0';
    resetBillingStoreCacheForTests();
    const account = await getStore().signIn(`seed-q-${crypto.randomUUID()}@seed.test`);
    for (let i = 0; i < 20_000; i += 1) assert.equal((await getBillingStore().reserveUsage(account.userId, 'project_question')).allowed, true);
    const allowed = await reserveMeteredAction(account.userId, 'project_question', new Request('http://localhost/api/v1/comprehension'), { characters: 100 });
    assert.ok(!(allowed instanceof Response), 'an unlimited allowance never refuses');
  } finally {
    delete process.env.UNVIBE_TEST_USAGE_SEED;
    resetBillingStoreCacheForTests();
  }
});

test('the seed applies to new workspaces only on the memory store and leaves unseeded stores alone', async () => {
  resetBillingStoreCacheForTests();
  const headers = await seededAccount('pro:0');
  assert.equal((await explain(headers)).status, 200);
  delete process.env.UNVIBE_TEST_USAGE_SEED;
  resetBillingStoreCacheForTests();
  const plain = await getStore().signIn(`plain-${crypto.randomUUID()}@seed.test`);
  assert.equal((await getBillingStore().overview(plain.userId)).subscription.plan, 'free');
});

/** A server environment: NODE_ENV defaults to `test`, everything else as given. */
function serverEnv(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...values };
}

test('the seed throws at store start on the production deployment', () => {
  for (const env of [
    { UNVIBE_TEST_USAGE_SEED: 'pro:199', VERCEL_ENV: 'production' },
    { UNVIBE_TEST_USAGE_SEED: 'enterprise:999', VERCEL_ENV: 'production', NODE_ENV: 'production', UNCODE_ALLOW_MEMORY_STORE: 'true' },
  ]) {
    assert.throws(() => createBillingStoreFromEnv(serverEnv(env)), /refused on the production deployment/);
  }
});

test('the seed throws at store start with the Supabase store (or half its config)', () => {
  for (const supabase of [
    { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role' },
    { SUPABASE_URL: 'https://project.supabase.co' },
    { SUPABASE_SERVICE_ROLE_KEY: 'service-role' },
  ]) {
    assert.throws(() => createBillingStoreFromEnv(serverEnv({ UNVIBE_TEST_USAGE_SEED: 'pro:199', ...supabase })), /only with the memory billing store/);
  }
});

test('a malformed seed throws; production memory without its explicit override still throws', () => {
  for (const seed of ['teams:5', 'gold:1', 'pro', 'pro:-1', 'pro:1.5', ' pro:1', 'pro:12345678']) {
    assert.throws(() => createBillingStoreFromEnv(serverEnv({ UNVIBE_TEST_USAGE_SEED: seed })), /must be <plan>:<used>/, seed);
  }
  assert.throws(() => createBillingStoreFromEnv(serverEnv({ UNVIBE_TEST_USAGE_SEED: 'pro:1', NODE_ENV: 'production' })), /Memory storage is disabled in production/);
  assert.equal(createBillingStoreFromEnv(serverEnv({ UNVIBE_TEST_USAGE_SEED: 'pro:1', NODE_ENV: 'production', UNCODE_ALLOW_MEMORY_STORE: 'true' })).kind, 'memory billing (dev)');
});
