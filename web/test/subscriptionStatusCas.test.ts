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
