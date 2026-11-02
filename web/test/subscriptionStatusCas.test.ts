import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SupabaseBillingStore } from '../src/billing/supabaseBillingStore';

// The PostgREST HTTP boundary is local; the store and supabase-js are real.
test('the revoke-only status write is a compare-and-set on the stored status', async () => {
  const previousFetch = globalThis.fetch;
  const patches: Array<{ query: URLSearchParams; body: Record<string, unknown> }> = [];
  let rows: unknown[] = [{ workspace_id: 'ws-1' }];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/subscriptions' && init?.method === 'PATCH') {
      patches.push({ query: url.searchParams, body: JSON.parse(String(init.body)) as Record<string, unknown> });
      return Response.json(rows);
    }
    throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url.pathname}`);
  }) as typeof fetch;
  const store = new SupabaseBillingStore('https://billing.supabase.test', 'service-key');
  try {
    assert.equal(await store.setSubscriptionStatusIf('sub_1', 'grace_period', 'active'), true);
    // The row changed first (say it was canceled): no row matches, nothing is written.
    rows = [];
    assert.equal(await store.setSubscriptionStatusIf('sub_1', 'active', 'grace_period', '2026-11-02T00:00:00.000Z'), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.equal(patches.length, 2);
  assert.equal(patches[0].query.get('stripe_subscription_id'), 'eq.sub_1');
  assert.equal(patches[0].query.get('status'), 'eq.grace_period');
  assert.equal(patches[0].body.status, 'active');
  assert.equal(patches[0].body.grace_period_ends_at, null);
  assert.deepEqual(Object.keys(patches[0].body).sort(), ['grace_period_ends_at', 'status', 'updated_at'], 'only the status and grace end change');
  assert.equal(patches[1].query.get('status'), 'eq.active');
  assert.equal(patches[1].body.grace_period_ends_at, '2026-11-02T00:00:00.000Z');
});

// The unlocked-upsert race: the subscription sync writes the whole row only while updated_at is still
// the value it read (exactly as PostgREST returned it), or inserts only while the workspace has no row.
test('the subscription sync write is a compare-and-set on updated_at, and an insert only when no row exists', async () => {
  const previousFetch = globalThis.fetch;
  const requests: Array<{ method: string; query: URLSearchParams; prefer: string | null; body: Record<string, unknown> | null }> = [];
  let rows: unknown[] = [];
  const storedAt = '2026-11-02T18:00:00.123456+00:00';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, '/rest/v1/subscriptions');
    const method = init?.method ?? 'GET';
    requests.push({ method, query: url.searchParams, prefer: new Headers(init?.headers).get('prefer'), body: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null });
    if (method === 'GET') return Response.json([{ workspace_id: 'ws-1', plan: 'pro', interval: 'monthly', status: 'active', seats: 1, cancel_at_period_end: false, updated_at: storedAt }]);
    return Response.json(rows);
  }) as typeof fetch;
  const store = new SupabaseBillingStore('https://billing.supabase.test', 'service-key');
  const input = {
    workspaceId: 'ws-1', plan: 'pro' as const, interval: 'monthly' as const, status: 'canceled' as const, seats: 1,
    stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', stripePriceId: 'price_1', cancelAtPeriodEnd: false,
  };
  try {
    const read = await store.versionedSubscriptionByWorkspaceId('ws-1');
    assert.equal(read?.version, storedAt, 'the version is updated_at exactly as stored');
    assert.equal(read?.subscription.status, 'active');
    rows = [{ workspace_id: 'ws-1' }];
    assert.equal(await store.syncSubscriptionIf(input, storedAt), true);
    // Another write changed updated_at first: no row matches, nothing is written.
    rows = [];
    assert.equal(await store.syncSubscriptionIf(input, storedAt), false);
    // No row was read: an insert that does nothing when a row appeared meanwhile.
    assert.equal(await store.syncSubscriptionIf(input, null), false);
  } finally {
    globalThis.fetch = previousFetch;
  }
  const [, update, , insert] = requests;
  assert.equal(update?.method, 'PATCH');
  assert.equal(update?.query.get('workspace_id'), 'eq.ws-1');
  assert.equal(update?.query.get('updated_at'), `eq.${storedAt}`);
  assert.equal(update?.body?.status, 'canceled');
  assert.equal(update?.body?.stripe_subscription_id, 'sub_1');
  assert.equal('workspace_id' in (update?.body ?? {}), false, 'the key is the filter, not a written column');
  assert.notEqual(update?.body?.updated_at, storedAt, 'the write sets a new updated_at');
  assert.equal(insert?.method, 'POST');
  assert.equal(insert?.query.get('on_conflict'), 'workspace_id');
  assert.match(insert?.prefer ?? '', /resolution=ignore-duplicates/);
  assert.equal(insert?.body?.workspace_id, 'ws-1');
});

test('checkout stop audits are read in one query filtered by both actions and the session', async () => {
  const previousFetch = globalThis.fetch;
  const actions = ['checkout.stop_started', 'checkout.stopped_while_locked'];
  let rows: Array<{ id: string; action: string; metadata: Record<string, string> }> = [];
  const requests: URL[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    assert.equal(url.pathname, '/rest/v1/billing_audit_log');
    let matches = rows;
    for (const [column, filter] of url.searchParams) {
      if (column === 'action' && filter.startsWith('in.(') && filter.endsWith(')')) {
        const allowed = filter.slice(4, -1).split(',').map((value) => value.replace(/^"|"$/g, ''));
        matches = matches.filter((row) => allowed.includes(row.action));
      } else if (column === 'metadata' && filter.startsWith('cs.')) {
        const required = JSON.parse(filter.slice(3)) as Record<string, string>;
        matches = matches.filter((row) => Object.entries(required).every(([key, value]) => row.metadata[key] === value));
      } else if (column !== 'select') {
        assert.fail(`unexpected filter ${column}=${filter}`);
      }
    }
    return Response.json(matches.map(({ action }) => ({ action })));
  }) as typeof fetch;
  const store = new SupabaseBillingStore('https://billing.supabase.test', 'service-key');
  try {
    rows = [
      { id: 'other-action', action: 'checkout.completed', metadata: { checkoutSessionId: 'cs_target' } },
      { id: 'other-session', action: 'checkout.stopped_while_locked', metadata: { checkoutSessionId: 'cs_other' } },
    ];
    assert.deepEqual(await store.checkoutStopAudits('cs_target'), { started: false, finished: false }, 'another action or session is not a stop row');
    rows.push({ id: 'started', action: 'checkout.stop_started', metadata: { checkoutSessionId: 'cs_target', subscriptionId: 'sub_target' } });
    assert.deepEqual(await store.checkoutStopAudits('cs_target'), { started: true, finished: false }, 'a matching row can contain extra metadata');
    rows.push({ id: 'finished', action: 'checkout.stopped_while_locked', metadata: { checkoutSessionId: 'cs_target' } });
    assert.deepEqual(await store.checkoutStopAudits('cs_target'), { started: true, finished: true });

    assert.equal(requests.length, 3, 'one request per lookup');
    const query = requests[2]!.searchParams;
    assert.equal(query.get('select'), 'action');
    assert.deepEqual(query.get('action')!.slice(4, -1).split(',').map((value) => value.replace(/^"|"$/g, '')), actions);
    assert.equal(query.get('action')!.startsWith('in.('), true);
    assert.deepEqual(JSON.parse(query.get('metadata')!.slice(3)), { checkoutSessionId: 'cs_target' });
  } finally {
    globalThis.fetch = previousFetch;
  }
});
