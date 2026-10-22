import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mock, test } from 'node:test';
import type Stripe from 'stripe';
import { POST as checkout } from '../app/api/v1/billing/checkout/route';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';

// Real route + memory stores. Test-mode key; the Stripe client's two Checkout methods are replaced
// on the cached client, so no request leaves the machine.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.VERCEL_ENV;
delete process.env.BILLING_LIVE_PAYMENTS_APPROVED;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only_never_sent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_ANNUAL = 'price_pro_annual';
process.env.STRIPE_PRICE_TEAMS_MONTHLY = 'price_teams_monthly';
process.env.STRIPE_PRICE_TEAMS_ANNUAL = 'price_teams_annual';

interface FakeSession { id: string; url: string; expiresAt: number; workspaceId: string }
const sessions = new Map<string, FakeSession>();
const sessionsApi = getStripe().checkout.sessions;
sessionsApi.create = (async (params: Stripe.Checkout.SessionCreateParams) => {
  const id = `cs_test_${randomUUID()}`;
  // Stripe's default is 24 hours when expires_at is omitted.
  const expiresAt = params.expires_at ?? Math.floor(Date.now() / 1000) + 24 * 3600;
  const session = { id, url: `https://checkout.stripe.com/c/pay/${id}`, expiresAt, workspaceId: String(params.metadata?.workspace_id) };
  sessions.set(id, session);
  return { id, url: session.url, status: 'open', expires_at: expiresAt };
}) as unknown as typeof sessionsApi.create;
sessionsApi.retrieve = (async (id: string) => {
  const session = sessions.get(id);
  assert.ok(session, `unknown session ${id}`);
  const open = Date.now() / 1000 < session.expiresAt;
  return { id, url: open ? session.url : null, status: open ? 'open' : 'expired' };
}) as unknown as typeof sessionsApi.retrieve;

async function owner(): Promise<{ userId: string; token: string }> {
  const account = await getStore().signIn(`teams-${randomUUID()}@checkout.test`);
  return { userId: account.userId, token: account.token };
}

async function startTeams(token: string, body: Record<string, unknown> = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await checkout(new Request('http://localhost/api/v1/billing/checkout', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'teams', interval: 'monthly', seats: 3, workspaceName: 'Pilot team', ...body }),
  }));
  const json: unknown = await response.json();
  assert.ok(json !== null && typeof json === 'object');
  return { status: response.status, body: Object.fromEntries(Object.entries(json)) };
}

async function teamWorkspaces(userId: string): Promise<string[]> {
  return (await getBillingStore().listWorkspaces(userId)).filter((w) => w.type === 'team').map((w) => w.id);
}

test('retrying Teams checkout reuses the owner\'s team workspace and the open session', async () => {
  const me = await owner();
  const first = await startTeams(me.token);
  assert.equal(first.status, 201);
  const retry = await startTeams(me.token);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.url, first.body.url, 'the open Stripe session is reused, not a second payable one');
  assert.equal((await teamWorkspaces(me.userId)).length, 1, 'no extra empty team workspace per attempt');
});

test('an owner can have only one open Teams checkout across all of their team workspaces', async () => {
  const me = await owner();
  const a = await getBillingStore().createTeamWorkspace(me.userId, 'Team A');
  const b = await getBillingStore().createTeamWorkspace(me.userId, 'Team B');
  assert.equal((await startTeams(me.token, { workspaceId: a.id })).status, 201);
  const second = await startTeams(me.token, { workspaceId: b.id });
  assert.equal(second.status, 409);
  assert.equal(second.body.error, 'checkout_pending');
});

test('an unknown workspace id is refused instead of silently creating a workspace', async () => {
  const me = await owner();
  const response = await startTeams(me.token, { workspaceId: randomUUID() });
  assert.equal(response.status, 404);
  assert.equal((await teamWorkspaces(me.userId)).length, 0);
});

test('a checkout session stops being payable before the server will open another one', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-22T10:00:00.000Z') });
  try {
    const me = await owner();
    const first = await startTeams(me.token);
    assert.equal(first.status, 201);
    // 30.5 minutes later the first session must not be payable alongside a new one.
    mock.timers.setTime(new Date('2026-10-22T10:30:30.000Z').getTime());
    const retry = await startTeams(me.token);
    const [workspaceId] = await teamWorkspaces(me.userId);
    const openSessions = [...sessions.values()].filter((s) => s.workspaceId === workspaceId && Date.now() / 1000 < s.expiresAt);
    assert.equal(openSessions.length, 1, 'never two payable sessions for one workspace');
    assert.equal(retry.body.url, first.body.url);
    // Once the session has expired at Stripe, a new checkout opens normally.
    mock.timers.setTime(new Date('2026-10-22T11:00:00.000Z').getTime());
    const later = await startTeams(me.token);
    assert.equal(later.status, 201);
    assert.notEqual(later.body.url, first.body.url);
  } finally {
    mock.timers.reset();
  }
});
