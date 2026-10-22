import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SupabaseBillingStore } from '../src/billing/supabaseBillingStore';
import { monthWindow } from '../src/billing/plans';

// The PostgREST HTTP boundary is local; the store and supabase-js are real.
test('releasing usage decrements this month\'s counter by compare-and-swap and retries a lost race', async () => {
  const previousFetch = globalThis.fetch;
  const periodStart = monthWindow().startsAt.slice(0, 10);
  const counters = [3, 4];
  const patches: Array<{ query: URLSearchParams; used: unknown }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/rpc/billing_overview') {
      return Response.json({
        workspace: { id: 'ws-1', name: 'Personal', type: 'personal', role: 'owner', owner_user_id: 'user-1' },
        subscription: { workspace_id: 'ws-1', plan: 'pro', status: 'active', seats: 1 },
        usage: [],
      });
    }
    if (url.pathname === '/rest/v1/usage_monthly' && (init?.method ?? 'GET') === 'GET') {
      assert.equal(url.searchParams.get('workspace_id'), 'eq.ws-1');
      assert.equal(url.searchParams.get('kind'), 'eq.ai_explanation');
      assert.equal(url.searchParams.get('period_start'), `eq.${periodStart}`);
      return Response.json([{ used: counters[0] }]);
    }
    if (url.pathname === '/rest/v1/usage_monthly' && init?.method === 'PATCH') {
      const body: unknown = JSON.parse(String(init.body));
      assert.ok(body !== null && typeof body === 'object' && 'used' in body, 'PATCH must set used');
      patches.push({ query: url.searchParams, used: body.used });
      // The first swap loses to a concurrent reservation (3 -> 4); the retry wins.
      if (patches.length === 1) {
        counters.shift();
        return Response.json([]);
      }
      return Response.json([{ used: counters[0] - 1 }]);
    }
    throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${url.pathname}`);
  }) as typeof fetch;
  try {
    await new SupabaseBillingStore('https://billing.supabase.test', 'service-key').releaseUsage('user-1', 'ai_explanation');
  } finally {
    globalThis.fetch = previousFetch;
  }
  assert.equal(patches.length, 2);
  assert.equal(patches[0].query.get('used'), 'eq.3');
  assert.equal(patches[0].used, 2);
  assert.equal(patches[1].query.get('used'), 'eq.4');
  assert.equal(patches[1].used, 3);
  assert.equal(patches[1].query.get('period_start'), `eq.${periodStart}`);
});
