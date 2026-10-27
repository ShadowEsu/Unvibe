import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mock, test } from 'node:test';
import { POST as review } from '../app/api/v1/reviews/route';
import { POST as invite } from '../app/api/v1/workspaces/[workspaceId]/invitations/route';
import { POST as accept } from '../app/api/v1/workspaces/invitations/accept/route';
import { POST as checkout } from '../app/api/v1/billing/checkout/route';
import { getStore } from '../src/data/store';
import { MemoryBillingStore } from '../src/billing/memoryBillingStore';
import { getBillingStore } from '../src/billing/store';
import { businessModelReady, newTierCheckoutOpen } from '../src/billing/stripe';
import { BUSINESS_SEATS, BUSINESS_SEATS_FULL, FAIR_USE_RATE_LIMIT, FAIR_USE_RATE_LIMIT_TEXT, LIFETIME_PERIOD_END } from '../src/billing/plans';

// Big Business: $5,000 once, up to 10 named seats on a team workspace, unlimited explanations and
// questions for each, and one limit per person: the fair-use rate limit. Real routes on the memory
// stores; only the remote AI HTTP boundary is local.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;
delete process.env.OPENROUTER_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ENABLE_MOCK_AI;
delete process.env.UNVIBE_TEST_USAGE_SEED;
delete process.env.AI_PROVIDER;
delete process.env.AWS_BEARER_TOKEN_BEDROCK;
delete process.env.BEDROCK_MODEL_ID;
process.env.GEMINI_API_KEY = 'local-gemini-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_localOnlyNeverSent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_annual';
process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY = 'price_enterprise_monthly';
process.env.STRIPE_PRICE_BUSINESS_LIFETIME = 'price_business_lifetime';
process.env.APP_URL = 'http://localhost:3000';

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.hostname !== 'generativelanguage.googleapis.com') throw new Error(`Unexpected request: ${url}`);
  const chunk = { candidates: [{ content: { parts: [{ text: 'This function returns its input.' }] } }] };
  return url.pathname.endsWith(':streamGenerateContent')
    ? new Response(`data: ${JSON.stringify(chunk)}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
    : Response.json(chunk);
}) as typeof fetch;

interface Person { userId: string; headers: Record<string, string> }

async function person(email = `bb-${randomUUID()}@team.test`): Promise<Person> {
  const account = await getStore().signIn(email);
  return { userId: account.userId, headers: { authorization: `Bearer ${account.token}`, 'content-type': 'application/json' } };
}

/** An owner whose team workspace holds an active Big Business purchase (10 seats). */
async function bigBusiness(): Promise<{ owner: Person; workspaceId: string }> {
  const owner = await person();
  const workspace = await getBillingStore().createTeamWorkspace(owner.userId, 'Big team');
  await getBillingStore().syncSubscription({
    workspaceId: workspace.id, plan: 'business', interval: 'lifetime', status: 'active', seats: BUSINESS_SEATS,
    stripeCustomerId: `cus_${randomUUID()}`, stripeSubscriptionId: `pi_${randomUUID()}`, stripePriceId: 'price_business_lifetime',
    currentPeriodStart: new Date().toISOString(), currentPeriodEnd: LIFETIME_PERIOD_END, cancelAtPeriodEnd: false,
  });
  return { owner, workspaceId: workspace.id };
}

async function sendInvite(owner: Person, workspaceId: string, email: string): Promise<Response> {
  return invite(new Request(`http://localhost/api/v1/workspaces/${workspaceId}/invitations`, {
    method: 'POST', headers: owner.headers, body: JSON.stringify({ email, role: 'member' }),
  }), { params: { workspaceId } });
}

/** Invites a new person and has them accept: they hold one of the named seats. */
async function join(owner: Person, workspaceId: string): Promise<Person> {
  const email = `seat-${randomUUID()}@team.test`;
  const sent = await sendInvite(owner, workspaceId, email);
  assert.equal(sent.status, 201);
  const { inviteUrl } = await sent.json() as { inviteUrl: string };
  const member = await person(email);
  const accepted = await accept(new Request('http://localhost/api/v1/workspaces/invitations/accept', {
    method: 'POST', headers: member.headers, body: JSON.stringify({ token: inviteUrl.split('/invite/')[1] }),
  }));
  assert.equal(accepted.status, 200);
  return member;
}

const context = (code = 'const identity = (x: number) => x;') => ({ language: 'typescript', projectStructure: [], imports: [], code });

async function explain(who: Person, opts: { code?: string; question?: string } = {}): Promise<Response> {
  const response = await review(new Request('http://localhost/api/v1/reviews', {
    method: 'POST', headers: who.headers,
    body: JSON.stringify({ scope: 'selection', level: 'beginner', context: context(opts.code), ...(opts.question ? { question: opts.question } : {}) }),
  }));
  if (response.status === 200) await response.text();
  return response;
}

/** Runs `body` with the clock (Date only) held at 09:00:05 UTC, so the fixed rate-limit windows never roll over mid-test. */
async function atFixedTime(body: () => Promise<void>): Promise<void> {
  mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 10, 2, 9, 0, 5) });
  try {
    await body();
  } finally {
    mock.timers.reset();
  }
}

test('seats: the 10th person (owner plus 9) joins; the 11th invitation is refused in plain words; removing someone frees a named seat', async () => {
  const { owner, workspaceId } = await bigBusiness();
  const members: Person[] = [];
  for (let i = 0; i < BUSINESS_SEATS - 1; i += 1) members.push(await join(owner, workspaceId));
  const full = await getBillingStore().overview(owner.userId, workspaceId);
  assert.equal(full.occupiedSeats, 10, 'the 10th person holds a seat');
  const refused = await sendInvite(owner, workspaceId, `eleventh-${randomUUID()}@team.test`);
  assert.equal(refused.status, 409);
  assert.deepEqual(await refused.json(), { error: 'billing_error', message: BUSINESS_SEATS_FULL });
  assert.equal(BUSINESS_SEATS_FULL, 'Big Business includes up to 10 named seats. Remove someone from the workspace to free a seat.');
  // Seats are named: nothing rotates them; only removing a person frees one.
  await getBillingStore().removeMember(owner.userId, workspaceId, members[0].userId);
  assert.equal((await sendInvite(owner, workspaceId, `replacement-${randomUUID()}@team.test`)).status, 201);
  assert.equal((await sendInvite(owner, workspaceId, `another-${randomUUID()}@team.test`)).status, 409, 'the pending invitation holds the freed seat');
});

test('each of the 10 people is unlimited: explanations and questions keep working far above any old monthly cap', async () => {
  const { owner, workspaceId } = await bigBusiness();
  const people = [owner];
  for (let i = 0; i < BUSINESS_SEATS - 1; i += 1) people.push(await join(owner, workspaceId));
  // The workspace has used 12,000 explanations and 12,000 questions this month (old caps 5,000 and 10,000).
  for (let i = 0; i < 12_000; i += 1) {
    await getBillingStore().reserveUsage(owner.userId, 'ai_explanation', workspaceId);
    await getBillingStore().reserveUsage(owner.userId, 'project_question', workspaceId);
  }
  for (const who of people) {
    // No workspace header: a named seat is billed to the Big Business workspace by default.
    const overview = await getBillingStore().overview(who.userId);
    assert.equal(overview.workspace.id, workspaceId);
    assert.equal(overview.subscription.plan, 'business');
    for (const kind of ['ai_explanation', 'project_question'] as const) {
      const line = overview.usage.find((entry) => entry.kind === kind);
      assert.equal(line?.limit, null, `${kind} has no monthly cap`);
      assert.equal(line?.remaining, null, `${kind} never reads as 0 left`);
      assert.ok((line?.used ?? 0) >= 12_000);
    }
    assert.equal((await explain(who)).status, 200);
    assert.equal((await explain(who, { question: 'Why?' })).status, 200);
  }
});

test('the fair-use rate limit is per person: one person over 10 requests a minute is refused with Retry-After and no upgrade; the others are not', async () => {
  const { owner, workspaceId } = await bigBusiness();
  const member = await join(owner, workspaceId);
  await atFixedTime(async () => {
    for (let i = 0; i < FAIR_USE_RATE_LIMIT.perMinute; i += 1) {
      assert.equal((await explain(member, i % 2 ? { question: 'Why?' } : {})).status, 200, `request ${i + 1}, explanations and questions counted together`);
    }
    const limited = await explain(member);
    assert.equal(limited.status, 429);
    const wait = Number(limited.headers.get('retry-after'));
    assert.equal(wait, 55, 'seconds to the end of the minute (the clock is held at 09:00:05)');
    const body = await limited.json() as Record<string, unknown>;
    assert.equal(body.error, 'fair_use_rate_limited');
    assert.equal(body.retryAfterSeconds, wait);
    assert.match(String(body.message), new RegExp(`^You have reached the ${FAIR_USE_RATE_LIMIT_TEXT}\\. Try again in \\d+ (second|minute)s?\\.$`));
    assert.equal('upgradePath' in body, false, 'no upgrade offer');
    assert.equal('usage' in body, false);
    // The refused request gave back its unit: usage counts only the 10 that ran.
    const line = (await getBillingStore().overview(member.userId)).usage;
    assert.equal(line.find((entry) => entry.kind === 'ai_explanation')!.used + line.find((entry) => entry.kind === 'project_question')!.used, 10);
    // Same workspace, another person: their own limit.
    assert.equal((await explain(owner)).status, 200);
  });
});

test('1 million characters an hour per person: the request over it is refused for the rest of the hour and raises one hashed alert', async () => {
  const { owner, workspaceId } = await bigBusiness();
  const member = await join(owner, workspaceId);
  const big = 'x'.repeat(115_000);
  const logged: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
  try {
    await atFixedTime(async () => {
      // 8 near-maximum requests send about 920,000 characters; the 9th would pass 1,000,000.
      for (let i = 0; i < 8; i += 1) assert.equal((await explain(member, { code: big })).status, 200, `large request ${i + 1}`);
      const over = await explain(member, { code: big });
      assert.equal(over.status, 429);
      assert.equal(over.headers.get('retry-after'), '3595', 'seconds to the end of the hour');
      assert.equal(((await over.json()) as { error: string }).error, 'fair_use_rate_limited');
      assert.equal((await explain(member, { code: big })).status, 429);
      assert.equal((await explain(owner, { code: big })).status, 200, 'another seat has its own characters');
    });
  } finally {
    console.warn = warn;
  }
  const alerts = logged.filter((line) => line.includes('BUSINESS_RATE_LIMIT_HIT'));
  assert.equal(alerts.length, 1, 'one alert per person per hour');
  const alert = JSON.parse(alerts[0]) as Record<string, unknown>;
  assert.deepEqual(Object.keys(alert).sort(), ['account', 'event', 'window']);
  assert.match(String(alert.account), /^[0-9a-f]{32}$/);
  assert.equal(alerts[0].includes(member.userId), false, 'the raw account id is never logged');
});

test('the rate limit trips at 10 a minute and 60 an hour and resets with each window; refused requests count nothing', async () => {
  let now = Date.UTC(2026, 10, 2, 9, 0, 5);
  const store = new MemoryBillingStore(() => new Date(now));
  const bucket = `fair-use:test-${randomUUID()}`;
  const consume = (characters = 100) => store.consumeFairUseRate(bucket, characters, FAIR_USE_RATE_LIMIT);
  for (let i = 0; i < 10; i += 1) assert.deepEqual(await consume(), { allowed: true });
  assert.deepEqual(await consume(), { allowed: false, window: 'minute', retryAfterSeconds: 55, alert: false });
  assert.deepEqual(await consume(), { allowed: false, window: 'minute', retryAfterSeconds: 55, alert: false });
  // Next minute: allowed again; the two refusals were not counted toward the hour.
  for (let minute = 1; minute < 6; minute += 1) {
    now = Date.UTC(2026, 10, 2, 9, minute, 5);
    for (let i = 0; i < 10; i += 1) assert.deepEqual(await consume(), { allowed: true }, `minute ${minute} request ${i + 1}`);
  }
  now = Date.UTC(2026, 10, 2, 9, 6, 0);
  assert.deepEqual(await consume(), { allowed: false, window: 'hour', retryAfterSeconds: 54 * 60, alert: true }, 'the 61st in the hour');
  now = Date.UTC(2026, 10, 2, 9, 30, 0);
  assert.deepEqual(await consume(), { allowed: false, window: 'hour', retryAfterSeconds: 30 * 60, alert: false }, 'one alert per hour');
  now = Date.UTC(2026, 10, 2, 10, 0, 0);
  assert.deepEqual(await consume(), { allowed: true }, 'the next hour resets');
  // Characters: 1,000,000 an hour, counted only for requests that ran.
  for (let i = 0; i < 8; i += 1) assert.deepEqual(await consume(120_000), { allowed: true });
  now = Date.UTC(2026, 10, 2, 10, 1, 0);
  assert.deepEqual(await consume(120_000), { allowed: false, window: 'hour', retryAfterSeconds: 59 * 60, alert: true });
  assert.deepEqual(await consume(39_000), { allowed: true }, '961,100 + 39,000 still fits');
  now = Date.UTC(2026, 10, 2, 11, 0, 0);
  assert.deepEqual(await consume(120_000), { allowed: true });
});

test('Big Business checkout opens only on Claude Haiku 5.5 through Bedrock, never Gemini Flash-Lite or Haiku 4.5; closed by default', async () => {
  const haiku55 = { AI_PROVIDER: 'bedrock', AWS_BEARER_TOKEN_BEDROCK: 'token', BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-5-5' };
  assert.equal(businessModelReady({}), false, 'closed by default');
  assert.equal(businessModelReady(haiku55), true);
  assert.equal(businessModelReady({ ...haiku55, BEDROCK_MODEL_ID: 'global.anthropic.claude-haiku-5-5' }), true);
  assert.equal(businessModelReady({ ...haiku55, AI_PROVIDER: ' Bedrock ' }), true, 'read like bedrockSelected()');
  for (const [label, env] of [
    ['Gemini', { ...haiku55, AI_PROVIDER: 'gemini' }],
    ['no provider', { ...haiku55, AI_PROVIDER: undefined }],
    ['no Bedrock token', { ...haiku55, AWS_BEARER_TOKEN_BEDROCK: ' ' }],
    ['Haiku 4.5', { ...haiku55, BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0' }],
    ['default model', { ...haiku55, BEDROCK_MODEL_ID: undefined }],
    ['Flash-Lite id', { ...haiku55, BEDROCK_MODEL_ID: 'gemini-3.1-flash-lite' }],
  ] as const) assert.equal(businessModelReady(env), false, label);

  process.env.BILLING_NEW_TIERS_ENABLED = 'true';
  try {
    assert.equal(newTierCheckoutOpen('enterprise'), true);
    assert.equal(newTierCheckoutOpen('business'), false, 'no Haiku 5.5: Big Business stays closed');
    const buyer = await person();
    const response = await checkout(new Request('http://localhost/api/v1/billing/checkout', {
      method: 'POST', headers: buyer.headers, body: JSON.stringify({ plan: 'business', interval: 'lifetime' }),
    }));
    assert.equal(response.status, 503);
    assert.equal(((await response.json()) as { error: string }).error, 'plan_unavailable');
    Object.assign(process.env, haiku55);
    assert.equal(newTierCheckoutOpen('business'), true);
  } finally {
    delete process.env.BILLING_NEW_TIERS_ENABLED;
    delete process.env.AI_PROVIDER;
    delete process.env.AWS_BEARER_TOKEN_BEDROCK;
    delete process.env.BEDROCK_MODEL_ID;
  }
});

test('no Big Business string on the server names a monthly number', () => {
  const monthly = /\d[\d,]*\s+(explanations|questions)?[^.]*\b(a|per|this|each)\s+month|pause until|next month|5,000 explanations|10,000 questions/i;
  for (const text of [FAIR_USE_RATE_LIMIT_TEXT, BUSINESS_SEATS_FULL, `You have reached the ${FAIR_USE_RATE_LIMIT_TEXT}. Try again in 2 minutes.`]) {
    assert.doesNotMatch(text, monthly, text);
  }
  assert.equal(FAIR_USE_RATE_LIMIT_TEXT, 'fair-use rate limit against automated abuse: per person, 10 requests a minute, 60 an hour and 1 million characters an hour');
  assert.deepEqual(FAIR_USE_RATE_LIMIT, { perMinute: 10, perHour: 60, charactersPerHour: 1_000_000 }, 'the words match the numbers enforced');
});
