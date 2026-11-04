import assert from 'node:assert/strict';
import test from 'node:test';
import { getStore } from '../src/data/store';
import { getBillingStore } from '../src/billing/store';
import { GET as overview } from '../app/api/v1/billing/overview/route';
import { SupabaseBillingStore } from '../src/billing/supabaseBillingStore';
import { SupabaseStore } from '../src/data/supabaseStore';

// 2 Nov: the GET overview route answered from Next.js's fetch cache. A returning account got the
// billing_overview response of its deleted workspace, the plan.viewed audit hit the workspace FK,
// and the app's Plan tab showed a 400. Every server Supabase request must ask for a live answer.
async function requestCacheModes(run: () => Promise<unknown>): Promise<Array<RequestCache | undefined>> {
  const realFetch = globalThis.fetch;
  const modes: Array<RequestCache | undefined> = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    modes.push(init?.cache);
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    await run().catch(() => undefined);
  } finally {
    globalThis.fetch = realFetch;
  }
  return modes;
}

test('the billing store asks Postgres for a live answer, never a cached one', async () => {
  const store = new SupabaseBillingStore('https://example.supabase.co', 'service-role-fake');
  const modes = await requestCacheModes(() => store.overview('00000000-0000-4000-8000-000000000001'));
  assert.ok(modes.length > 0, 'the overview made a request');
  assert.deepEqual([...new Set(modes)], ['no-store']);
});

test('the account store (sessions, users) asks for a live answer too', async () => {
  const store = new SupabaseStore('https://example.supabase.co', 'service-role-fake');
  const modes = await requestCacheModes(() => store.userForToken('00000000-0000-4000-8000-000000000002'));
  assert.ok(modes.length > 0, 'the token lookup made a request');
  assert.deepEqual([...new Set(modes)], ['no-store']);
});

test('a failed plan.viewed audit does not fail the overview read', async () => {
  const account = await getStore().signIn(`overview-audit-${crypto.randomUUID()}@example.test`);
  const billing = getBillingStore();
  const realAudit = billing.recordAudit.bind(billing);
  billing.recordAudit = async () => { throw new Error('Persistent billing record audit failed: insert or update on table "billing_audit_log" violates foreign key constraint'); };
  const realError = console.error;
  console.error = () => undefined;
  try {
    const res = await overview(new Request('https://example.test/api/v1/billing/overview', { headers: { authorization: `Bearer ${account.token}` } }));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { overview?: { subscription?: { plan?: string } } };
    assert.ok(body.overview?.subscription?.plan, 'the overview is returned');
  } finally {
    billing.recordAudit = realAudit;
    console.error = realError;
  }
});
