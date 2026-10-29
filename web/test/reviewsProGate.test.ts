import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST as review } from '../app/api/v1/reviews/route';
import { POST as createWorkspace } from '../app/api/v1/workspaces/route';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';
import { trialCounterUsed, trialGlobalDayKey, trialGlobalMonthKey, trialInstallKey, trialUsageLine } from '../src/lib/trialAccess';
import type { UsageKind } from '../src/billing/types';
import { ANTHROPIC_HOST, anthropicStream } from './anthropicStub';

// Real route handlers, memory stores; only the remote AI HTTP boundary is local.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.OPENROUTER_API_KEY;
delete process.env.ENABLE_MOCK_AI;
process.env.ANTHROPIC_API_KEY = 'local-anthropic-key';
process.env.UNVIBE_TRIAL_TOKEN = 'local-trial-token-abcdefghijklmnop';

let aiCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  if (url.hostname !== ANTHROPIC_HOST) throw new Error(`Unexpected request: ${url}`);
  aiCalls += 1;
  return anthropicStream(['This change renames a helper.']);
}) as typeof fetch;

const code = 'const identity = (x: number) => x;';
const selectionContext = { language: 'typescript', projectStructure: ['demo'], imports: [], code, primaryFile: 'src/id.ts' };
const diffHunks = [{ file: 'src/id.ts', oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ['-const id = (x) => x;', '+const identity = (x: number) => x;'] }];
const diffContext = { language: 'typescript', projectStructure: ['demo'], imports: [], code: `// src/id.ts\n${diffHunks[0]!.lines.join('\n')}`, primaryFile: 'src/id.ts', diffHunks };

/**
 * What the desktop app's Pro features send (app/src/main/contextBuilder.ts): Git diff explanations
 * and Change briefs are scope 'diff' with the hunks (buildDiffPayload), a follow-up or "Explain
 * differently" on them keeps that payload (review.ts ensurePayload), and Since last understood is
 * scope 'file' with the snapshot and the current file (buildComparePayload).
 */
const PRO_ONLY: Record<string, Record<string, unknown>> = {
  'a git diff explanation': { scope: 'diff', level: 'intermediate', variant: 'default', context: diffContext },
  'a change brief': {
    scope: 'diff', level: 'intermediate',
    question: 'Change brief: Summarize what these git changes do, why they matter, risks, and the top concepts to understand.',
    context: diffContext,
  },
  'a follow-up question on a git diff': { scope: 'diff', level: 'intermediate', question: 'Why rename it?', variant: 'default', context: diffContext },
  'Explain differently on a git diff': { scope: 'diff', level: 'intermediate', variant: 'different', context: diffContext },
  'a since last understood compare': {
    scope: 'file', level: 'intermediate',
    question: 'What changed since I last understood this file? Focus on behavior, risks, and what I should re-learn.',
    context: { ...selectionContext, code: '## Previously understood version (local snapshot)\n```\nconst id = (x) => x;\n```\n\n## Current version\n```\nconst identity = (x: number) => x;\n```' },
  },
  'a project overview': { scope: 'project', level: 'intermediate', context: selectionContext },
  'git diff hunks sent as a selection': { scope: 'selection', level: 'intermediate', context: diffContext },
};

/** What a Free user sends from the desktop app (buildSelectionPayload, follow-ups, Explain differently, Study assistant). */
const FREE: Record<string, Record<string, unknown>> = {
  'a selection explanation': { scope: 'selection', level: 'beginner', variant: 'default', context: selectionContext },
  'a follow-up question': { scope: 'selection', level: 'beginner', question: 'Why is x a number?', variant: 'default', context: selectionContext },
  'Explain differently': { scope: 'selection', level: 'beginner', variant: 'different', context: selectionContext },
};

function post(headers: Record<string, string>, payload: Record<string, unknown>): Request {
  return new Request('http://localhost/api/v1/reviews', { method: 'POST', headers, body: JSON.stringify(payload) });
}

async function signedIn(plan: 'free' | 'pro'): Promise<{ userId: string; headers: Record<string, string> }> {
  const account = await getStore().signIn(`${plan}-${crypto.randomUUID()}@pro-gate.test`);
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

async function used(userId: string, kind: UsageKind, workspaceId?: string): Promise<number> {
  const line = (await getBillingStore().overview(userId, workspaceId)).usage.find((entry) => entry.kind === kind);
  assert.ok(line, `missing ${kind} usage line`);
  return line.used;
}

async function jsonRecord(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();
  assert.ok(body !== null && typeof body === 'object' && !Array.isArray(body), 'expected a JSON object');
  return Object.fromEntries(Object.entries(body));
}

async function assertProRequired(response: Response, what: string): Promise<void> {
  assert.equal(response.status, 402, `${what} needs Pro`);
  const body = await jsonRecord(response);
  assert.equal(body.error, 'pro_required', what);
  assert.equal(body.upgradePath, '/plan', what);
  assert.equal(typeof body.message, 'string', what);
}

test('a Free account gets 402 pro_required for every Pro-only payload, and nothing is reserved or sent to the AI', async () => {
  const free = await signedIn('free');
  const callsBefore = aiCalls;
  for (const [what, payload] of Object.entries(PRO_ONLY)) {
    await assertProRequired(await review(post(free.headers, payload)), what);
  }
  assert.equal(await used(free.userId, 'ai_explanation'), 0);
  assert.equal(await used(free.userId, 'project_question'), 0);
  assert.equal(aiCalls, callsBefore);
});

test('a trial install gets 402 pro_required for every Pro-only payload, and no trial unit is reserved', async () => {
  const installId = `pro-gate-${crypto.randomUUID().replaceAll('-', '')}`;
  const headers = { authorization: `Bearer ${process.env.UNVIBE_TRIAL_TOKEN}`, 'x-unvibe-install-id': installId };
  const monthBefore = await trialCounterUsed(trialGlobalMonthKey());
  const dayBefore = await trialCounterUsed(trialGlobalDayKey());
  const callsBefore = aiCalls;
  for (const [what, payload] of Object.entries(PRO_ONLY)) {
    await assertProRequired(await review(post(headers, payload)), what);
  }
  assert.equal((await trialUsageLine(trialInstallKey(installId), 'ai_explanation')).used, 0);
  assert.equal(await trialCounterUsed(trialGlobalMonthKey()), monthBefore);
  assert.equal(await trialCounterUsed(trialGlobalDayKey()), dayBefore);
  assert.equal(aiCalls, callsBefore);
});

test('a Pro account gets every Pro-only payload, metered as usual', async () => {
  const pro = await signedIn('pro');
  for (const [what, payload] of Object.entries(PRO_ONLY)) {
    const response = await review(post(pro.headers, payload));
    assert.equal(response.status, 200, `${what} is included with Pro`);
    assert.match(await response.text(), /"type":"done"/, what);
  }
  // Questions (the brief, the follow-up, the compare) and "Explain differently" spend follow-ups; the rest spend explanations.
  assert.equal(await used(pro.userId, 'project_question'), 4);
  assert.equal(await used(pro.userId, 'ai_explanation'), Object.keys(PRO_ONLY).length - 4);
});

test('Teams includes the Pro features when the paid Teams workspace pays for the request', async () => {
  const owner = await signedIn('free');
  const created = await createWorkspace(new Request('http://localhost/api/v1/workspaces', {
    method: 'POST', headers: owner.headers, body: JSON.stringify({ name: 'Team' }),
  }));
  assert.equal(created.status, 201);
  const workspace = (await jsonRecord(created)).workspace;
  assert.ok(workspace !== null && typeof workspace === 'object' && 'id' in workspace && typeof workspace.id === 'string');
  const teamId = workspace.id;
  const teamHeaders = { ...owner.headers, 'x-uncode-workspace-id': teamId };
  const teams = {
    workspaceId: teamId, plan: 'teams' as const, interval: 'monthly' as const, status: 'active' as const, seats: 2,
    stripeCustomerId: `cus_team_${owner.userId}`, stripeSubscriptionId: `sub_team_${owner.userId}`, stripePriceId: 'price_teams_monthly',
    cancelAtPeriodEnd: false,
  };

  // A free team workspace is not Teams: the personal Free plan decides, as it does for metering.
  await assertProRequired(await review(post(teamHeaders, PRO_ONLY['a change brief']!)), 'a change brief on a free team workspace');

  await getBillingStore().syncSubscription(teams);
  const response = await review(post(teamHeaders, PRO_ONLY['a change brief']!));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /"type":"done"/);
  assert.equal(await used(owner.userId, 'project_question', teamId), 1, 'the Teams workspace pays');
  assert.equal(await used(owner.userId, 'project_question'), 0, 'the personal allowance is untouched');

  // Without the workspace header the personal Free plan pays, so the Pro features are refused.
  await assertProRequired(await review(post(owner.headers, PRO_ONLY['a change brief']!)), 'a change brief paid by the personal Free plan');

  await getBillingStore().syncSubscription({ ...teams, status: 'canceled' });
  await assertProRequired(await review(post(teamHeaders, PRO_ONLY['a change brief']!)), 'a change brief after Teams ended');
});

test('a Free account and a trial install keep selection explanations, follow-up questions and Explain differently', async () => {
  const free = await signedIn('free');
  const installId = `pro-gate-free-${crypto.randomUUID().replaceAll('-', '')}`;
  const trialHeaders = { authorization: `Bearer ${process.env.UNVIBE_TRIAL_TOKEN}`, 'x-unvibe-install-id': installId };
  for (const [what, payload] of Object.entries(FREE)) {
    for (const headers of [free.headers, trialHeaders]) {
      const response = await review(post(headers, payload));
      assert.equal(response.status, 200, `${what} stays on Free and the trial`);
      assert.match(await response.text(), /"type":"done"/, what);
    }
  }
  assert.equal(await used(free.userId, 'ai_explanation'), 1);
  assert.equal(await used(free.userId, 'project_question'), 2);
  assert.equal((await trialUsageLine(trialInstallKey(installId), 'ai_explanation')).used, 3);
});

test('a Pro-only payload fails closed with 503 when the plan cannot be checked', async () => {
  const pro = await signedIn('pro');
  const billing = getBillingStore();
  const overview = billing.overview;
  billing.overview = async () => { throw new Error('billing database unavailable'); };
  try {
    const response = await review(post(pro.headers, PRO_ONLY['a git diff explanation']!));
    assert.equal(response.status, 503);
    assert.equal((await jsonRecord(response)).error, 'entitlements_unavailable');
  } finally {
    billing.overview = overview;
  }
  assert.equal(await used(pro.userId, 'ai_explanation'), 0);
});
