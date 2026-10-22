import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST as review } from '../app/api/v1/reviews/route';
import { POST as comprehension } from '../app/api/v1/comprehension/route';
import { POST as createWorkspace } from '../app/api/v1/workspaces/route';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';
import { monthWindow } from '../src/billing/plans';
import { trialCounterUsed, trialGlobalMonthKey, trialInstallKey, trialUsageLine } from '../src/lib/trialAccess';
import type { UsageKind } from '../src/billing/types';

// Real route handlers, memory stores; only the remote AI HTTP boundary is local.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ENABLE_MOCK_AI;
process.env.GEMINI_API_KEY = 'local-gemini-key';
process.env.UNVIBE_TRIAL_TOKEN = 'local-trial-token-abcdefghijklmnop';

type Upstream = 'answer' | 'fail' | 'empty' | 'question' | 'not-json';
let upstream: Upstream = 'answer';
const QUESTION = { question: 'What does it return?', options: ['Its input', 'Nothing'], answerIndex: 0, rationale: 'identity', concept: 'functions', conceptLabel: 'Functions' };

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.hostname !== 'generativelanguage.googleapis.com') throw new Error(`Unexpected request: ${url}`);
  // The provider forwards the caller's signal; a request the client already dropped aborts here.
  init?.signal?.throwIfAborted();
  if (upstream === 'fail') return new Response('upstream unavailable', { status: 503 });
  const text = upstream === 'empty' ? '' : upstream === 'question' ? JSON.stringify(QUESTION) : upstream === 'not-json' ? 'Sorry, I cannot.' : 'This function returns its input.';
  const chunk = { candidates: [{ content: { parts: [{ text }] } }] };
  return url.pathname.endsWith(':streamGenerateContent')
    ? new Response(`data: ${JSON.stringify(chunk)}\n\n`, { headers: { 'content-type': 'text/event-stream' } })
    : Response.json(chunk);
}) as typeof fetch;

const context = { language: 'typescript', projectStructure: [], imports: [], code: 'const identity = (x: number) => x;' };

function explainRequest(headers: Record<string, string>, extra: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/v1/reviews', {
    method: 'POST',
    headers,
    body: JSON.stringify({ scope: 'selection', level: 'beginner', context, ...extra }),
  });
}

function questionRequest(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/v1/comprehension', {
    method: 'POST',
    headers,
    body: JSON.stringify({ scope: 'selection', level: 'beginner', context }),
  });
}

async function signedIn(plan: 'free' | 'pro'): Promise<{ userId: string; headers: Record<string, string> }> {
  const account = await getStore().signIn(`${plan}-${crypto.randomUUID()}@metering.test`);
  const workspace = await getBillingStore().ensurePersonalWorkspace(account.userId);
  if (plan === 'pro') {
    await getBillingStore().syncSubscription({
      workspaceId: workspace.id, plan: 'pro', interval: 'monthly', status: 'active', seats: 1,
      stripeCustomerId: `cus_${account.userId}`, stripeSubscriptionId: `sub_${account.userId}`, stripePriceId: 'price_pro_monthly',
      cancelAtPeriodEnd: false,
    });
  }
  return { userId: account.userId, headers: { authorization: `Bearer ${account.token}` } };
}

async function used(userId: string, kind: UsageKind): Promise<number> {
  const line = (await getBillingStore().overview(userId)).usage.find((entry) => entry.kind === kind);
  assert.ok(line, `missing ${kind} usage line`);
  return line.used;
}

/** The JSON body as a plain record; the assertions check the route's contract field by field. */
async function jsonRecord(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();
  assert.ok(body !== null && typeof body === 'object' && !Array.isArray(body), 'expected a JSON object');
  return Object.fromEntries(Object.entries(body));
}

test('a signed-in Pro user is metered by the Pro plan, not the old 30-explanation beta counter', async () => {
  upstream = 'answer';
  const pro = await signedIn('pro');
  for (let i = 1; i <= 100; i += 1) {
    const response = await review(explainRequest(pro.headers));
    assert.equal(response.status, 200, `explanation #${i} should be allowed on Pro`);
    assert.match(await response.text(), /"type":"done"/);
  }
  assert.equal(await used(pro.userId, 'ai_explanation'), 100, 'the Plan meter must count every explanation');
  assert.equal(await used(pro.userId, 'project_question'), 0);
  const denied = await review(explainRequest(pro.headers));
  assert.equal(denied.status, 429, 'explanation #101 is over the Pro monthly allowance');
  assert.equal((await jsonRecord(denied)).error, 'plan_limit_reached');
});

test('explanations fail closed when the plan cannot be checked', async () => {
  upstream = 'answer';
  const pro = await signedIn('pro');
  const billing = getBillingStore();
  const reserveUsage = billing.reserveUsage;
  billing.reserveUsage = async () => { throw new Error('billing database unavailable'); };
  try {
    const response = await review(explainRequest(pro.headers));
    assert.equal(response.status, 503);
    assert.equal((await jsonRecord(response)).error, 'entitlements_unavailable');
  } finally {
    billing.reserveUsage = reserveUsage;
  }
});

test('follow-ups and Explain differently count as follow-up questions', async () => {
  upstream = 'answer';
  const pro = await signedIn('pro');
  assert.equal((await review(explainRequest(pro.headers, { question: 'Why x?' }))).status, 200);
  assert.equal((await review(explainRequest(pro.headers, { variant: 'different' }))).status, 200);
  assert.equal(await used(pro.userId, 'project_question'), 2);
  assert.equal(await used(pro.userId, 'ai_explanation'), 0);
});

test('a Free user at the plan limit gets a plan_limit_reached 429 with the upgrade path', async () => {
  upstream = 'answer';
  const free = await signedIn('free');
  const limit = (await getBillingStore().overview(free.userId)).usage.find((line) => line.kind === 'ai_explanation')?.limit ?? 0;
  assert.ok(limit > 0);
  for (let i = 0; i < limit; i += 1) assert.equal((await review(explainRequest(free.headers))).status, 200);
  const denied = await review(explainRequest(free.headers));
  assert.equal(denied.status, 429);
  const body = await jsonRecord(denied);
  assert.equal(body.error, 'plan_limit_reached');
  assert.equal(body.upgradePath, '/plan');
  assert.deepEqual(body.usage, { kind: 'ai_explanation', used: limit, limit, remaining: 0, resetsAt: monthWindow().resetsAt });
});

test('an explanation that fails or returns nothing does not spend the signed-in allowance', async () => {
  const pro = await signedIn('pro');
  upstream = 'fail';
  assert.match(await (await review(explainRequest(pro.headers))).text(), /"type":"error"/);
  upstream = 'empty';
  await (await review(explainRequest(pro.headers))).text();
  upstream = 'fail';
  await (await review(explainRequest(pro.headers, { question: 'Why?' }))).text();
  assert.equal(await used(pro.userId, 'ai_explanation'), 0);
  assert.equal(await used(pro.userId, 'project_question'), 0);
});

test('an explanation that fails does not spend the signed-out trial allowance, but stays on the global meter', async () => {
  const installId = `metering-${crypto.randomUUID().replaceAll('-', '')}`;
  const install = trialInstallKey(installId);
  const headers = { authorization: `Bearer ${process.env.UNVIBE_TRIAL_TOKEN}`, 'x-unvibe-install-id': installId };
  const globalBefore = await trialCounterUsed(trialGlobalMonthKey());
  upstream = 'fail';
  assert.match(await (await review(explainRequest(headers))).text(), /"type":"error"/);
  assert.equal((await trialUsageLine(install, 'ai_explanation')).used, 0);
  assert.equal(await trialCounterUsed(trialGlobalMonthKey()), globalBefore + 1, 'the AI call was made, so the spend meter keeps it');
  upstream = 'answer';
  assert.match(await (await review(explainRequest(headers))).text(), /"type":"done"/);
  assert.equal((await trialUsageLine(install, 'ai_explanation')).used, 1);
});

test('Test me charges a follow-up only when a valid question comes back', async () => {
  const pro = await signedIn('pro');
  upstream = 'fail';
  const failed = await comprehension(questionRequest(pro.headers));
  assert.equal(failed.status, 502);
  upstream = 'not-json';
  assert.equal((await comprehension(questionRequest(pro.headers))).status, 502);
  assert.equal(await used(pro.userId, 'project_question'), 0);
  upstream = 'question';
  const ok = await comprehension(questionRequest(pro.headers));
  assert.equal(ok.status, 200);
  assert.equal((await jsonRecord(ok)).question, QUESTION.question);
  assert.equal(await used(pro.userId, 'project_question'), 1);
});

test('a person who disconnects after the allowance was reserved is still charged', async () => {
  upstream = 'answer';
  const pro = await signedIn('pro');
  const gone = new AbortController();
  gone.abort();
  const dropped = new Request('http://localhost/api/v1/reviews', {
    method: 'POST',
    headers: pro.headers,
    body: JSON.stringify({ scope: 'selection', level: 'beginner', context }),
    signal: gone.signal,
  });
  // text() resolves only after the route closes the stream, which is after any refund decision.
  await (await review(dropped)).text();
  assert.equal(await used(pro.userId, 'ai_explanation'), 1, 'a disconnect is not a provider failure');
});

test('Test me is charged when the person disconnects, not refunded', async () => {
  upstream = 'question';
  const pro = await signedIn('pro');
  const gone = new AbortController();
  gone.abort();
  const dropped = new Request('http://localhost/api/v1/comprehension', {
    method: 'POST',
    headers: pro.headers,
    body: JSON.stringify({ scope: 'selection', level: 'beginner', context }),
    signal: gone.signal,
  });
  await comprehension(dropped);
  assert.equal(await used(pro.userId, 'project_question'), 1);
});

/** A team workspace the signed-in person creates through the real route. */
async function newTeamWorkspace(headers: Record<string, string>): Promise<string> {
  const response = await createWorkspace(new Request('http://localhost/api/v1/workspaces', {
    method: 'POST', headers, body: JSON.stringify({ name: 'Side project' }),
  }));
  assert.equal(response.status, 201);
  const workspace = (await jsonRecord(response)).workspace;
  assert.ok(workspace !== null && typeof workspace === 'object' && 'id' in workspace && typeof workspace.id === 'string');
  return workspace.id;
}

test('a new free team workspace does not give a Free user a second allowance', async () => {
  upstream = 'answer';
  const free = await signedIn('free');
  const limit = (await getBillingStore().overview(free.userId)).usage.find((line) => line.kind === 'ai_explanation')?.limit ?? 0;
  for (let i = 0; i < limit; i += 1) assert.equal((await review(explainRequest(free.headers))).status, 200);
  const teamId = await newTeamWorkspace(free.headers);
  const viaTeam = await review(explainRequest({ ...free.headers, 'x-uncode-workspace-id': teamId }));
  assert.equal(viaTeam.status, 429, 'naming a free team workspace must still spend the personal allowance');
  assert.equal(await used(free.userId, 'ai_explanation'), limit);
});

test('a paid Teams workspace named in the request pays from the team allowance', async () => {
  upstream = 'answer';
  const owner = await signedIn('free');
  const teamId = await newTeamWorkspace(owner.headers);
  await getBillingStore().syncSubscription({
    workspaceId: teamId, plan: 'teams', interval: 'monthly', status: 'active', seats: 2,
    stripeCustomerId: `cus_team_${owner.userId}`, stripeSubscriptionId: `sub_team_${owner.userId}`, stripePriceId: 'price_teams_monthly',
    cancelAtPeriodEnd: false,
  });
  assert.equal((await review(explainRequest({ ...owner.headers, 'x-uncode-workspace-id': teamId }))).status, 200);
  const teamLine = (await getBillingStore().overview(owner.userId, teamId)).usage.find((line) => line.kind === 'ai_explanation');
  assert.equal(teamLine?.used, 1, 'the Teams workspace is charged');
  assert.equal(await used(owner.userId, 'ai_explanation'), 0, 'the personal allowance is untouched');
});

test('naming a workspace the person is not a member of is refused without spending anything', async () => {
  upstream = 'answer';
  const stranger = await signedIn('free');
  const other = await signedIn('free');
  const teamId = await newTeamWorkspace(other.headers);
  const response = await review(explainRequest({ ...stranger.headers, 'x-uncode-workspace-id': teamId }));
  assert.notEqual(response.status, 200);
  assert.equal(await used(stranger.userId, 'ai_explanation'), 0);
});
