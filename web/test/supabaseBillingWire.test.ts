import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { SupabaseBillingStore } from '../src/billing/supabaseBillingStore';

// Exercise the real supabase-js request builder, but answer every request locally. No network.
test('G4: Supabase billing RPC arguments match SQL signatures, values and returned write result', async () => {
  const seen: Array<{ method: string; url: URL; body: unknown }> = [];
  const original = globalThis.fetch;
  let reply: unknown = true;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    seen.push({ method: init?.method ?? 'GET', url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const store = new SupabaseBillingStore('http://127.0.0.1:9', 'service-role-test-placeholder');
    const input = {
      workspaceId: '00000000-0000-0000-0000-000000000001', plan: 'enterprise' as const,
      interval: 'monthly' as const, status: 'active' as const, seats: 1,
      stripeCustomerId: 'cus_wire', stripeSubscriptionId: 'sub_wire', stripePriceId: 'price_wire',
      currentPeriodStart: '2026-11-01T00:00:00.000Z', currentPeriodEnd: '2026-12-01T00:00:00.000Z',
      gracePeriodEndsAt: '2026-12-08T00:00:00.000Z', stripeEventAt: '2026-11-01T01:00:00.000Z', cancelAtPeriodEnd: true,
    };
    const sql = readFileSync('supabase/migrations/20261101090000_atomic_subscription_writes.sql', 'utf8');
    for (const result of [true, false, null]) {
      reply = result;
      assert.equal(await store.syncSubscription(input), result === true);
    }
    const calls = seen.splice(0);
    assert.equal(calls.length, 3);
    const signature = sql.match(/create or replace function public\.sync_subscription_if_not_older\(([\s\S]*?)\)\s*returns boolean/);
    assert.ok(signature);
    const declared = [...signature[1]!.matchAll(/\b(p_[a-z_]+)\s+[a-z]+/g)].map((match) => match[1]);
    assert.equal(declared.length, 13);
    for (const call of calls) {
      assert.equal(call.method, 'POST');
      assert.equal(call.url.pathname, '/rest/v1/rpc/sync_subscription_if_not_older');
      assert.ok(call.body && typeof call.body === 'object');
      assert.deepEqual(Object.keys(call.body).sort(), [...declared].sort());
      assert.deepEqual(call.body, {
        p_workspace_id: input.workspaceId, p_plan: input.plan, p_interval: input.interval,
        p_status: input.status, p_seats: input.seats, p_stripe_customer_id: input.stripeCustomerId,
        p_stripe_subscription_id: input.stripeSubscriptionId, p_stripe_price_id: input.stripePriceId,
        p_current_period_start: input.currentPeriodStart, p_current_period_end: input.currentPeriodEnd,
        p_grace_period_ends_at: input.gracePeriodEndsAt, p_stripe_event_at: input.stripeEventAt,
        p_cancel_at_period_end: input.cancelAtPeriodEnd,
      });
    }
    reply = null;
    await store.markSubscriptionCanceled('sub_wire', input.stripeEventAt);
    await store.markSubscriptionCanceled('sub_without_time');
    const cancel = seen.splice(0);
    assert.equal(cancel.length, 2);
    const cancelSignature = sql.match(/create or replace function public\.cancel_subscription_by_provider_id\(([^)]*)\)/);
    assert.ok(cancelSignature);
    const cancelDeclared = [...cancelSignature[1]!.matchAll(/\b(p_[a-z_]+)\s+[a-z]+/g)].map((match) => match[1]);
    for (const call of cancel) {
      assert.equal(call.method, 'POST');
      assert.equal(call.url.pathname, '/rest/v1/rpc/cancel_subscription_by_provider_id');
      assert.ok(call.body && typeof call.body === 'object');
      assert.deepEqual(Object.keys(call.body).sort(), [...cancelDeclared].sort());
    }
    assert.deepEqual(cancel.map((call) => call.body), [
      { p_stripe_subscription_id: 'sub_wire', p_stripe_event_at: input.stripeEventAt },
      { p_stripe_subscription_id: 'sub_without_time', p_stripe_event_at: null },
    ]);
    reply = [];
    assert.equal(await store.paymentRefunded('pi_wire'), false);
    reply = [{ id: 1 }];
    assert.equal(await store.paymentRefunded('pi_wire'), true);
    for (const call of seen) {
      assert.equal(call.method, 'GET');
      assert.equal(call.url.pathname, '/rest/v1/billing_audit_log');
      assert.equal(call.url.searchParams.get('select'), 'id');
      assert.equal(call.url.searchParams.get('action'), 'eq.refund.full');
      assert.equal(call.url.searchParams.get('metadata->>paymentIntentId'), 'eq.pi_wire');
      assert.equal(call.url.searchParams.get('limit'), '1');
    }
  } finally {
    globalThis.fetch = original;
  }
});

test('Big Business: a null cap from SQL stays null (never 0), and the fair-use RPC sends the SQL parameters and reads its verdict', async () => {
  const seen: Array<{ url: URL; body: unknown }> = [];
  const original = globalThis.fetch;
  let reply: unknown = null;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    seen.push({ url, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const store = new SupabaseBillingStore('http://127.0.0.1:9', 'service-role-test-placeholder');
    const unlimited = { kind: 'ai_explanation', used: 1_000_000, limit: null, remaining: null, resets_at: '2026-12-01T00:00:00Z' };
    const capped = { kind: 'saved_item', used: 3, limit: 20_000, remaining: 19_997, resets_at: '2026-12-01T00:00:00Z' };
    reply = {
      workspace: { id: 'w', name: 'Big', type: 'team', role: 'member' },
      subscription: { workspace_id: 'w', plan: 'business', interval: 'lifetime', status: 'active', seats: 10, cancel_at_period_end: false },
      usage: [unlimited, capped], occupied_seats: 2, pending_invitations: 0, minimum_billable_seats: 2, can_manage_billing: false, can_manage_members: false,
    };
    const overview = await store.overview('u');
    assert.deepEqual(overview.usage.map(({ limit, remaining, used }) => ({ limit, remaining, used })), [
      { limit: null, remaining: null, used: 1_000_000 },
      { limit: 20_000, remaining: 19_997, used: 3 },
    ]);
    reply = { allowed: true, line: { ...unlimited, used: 1_000_001 } };
    const reservation = await store.reserveUsage('u', 'ai_explanation');
    assert.equal(reservation.allowed, true);
    assert.equal(reservation.line.limit, null);
    assert.equal(reservation.line.remaining, null);

    seen.length = 0;
    const sql = readFileSync('supabase/migrations/20261031090000_enterprise_business_tiers.sql', 'utf8');
    const signature = sql.match(/create or replace function public\.consume_fair_use_rate_limit\(([\s\S]*?)\)\s*returns jsonb/);
    assert.ok(signature);
    const declared = [...signature[1]!.matchAll(/\b(p_[a-z_]+)\s+[a-z]+/g)].map((match) => match[1]);
    const limits = { perMinute: 10, perHour: 60, charactersPerHour: 1_000_000 };
    reply = { allowed: true };
    assert.deepEqual(await store.consumeFairUseRate('fair-use:abc', 1234, limits), { allowed: true });
    reply = { allowed: false, window: 'hour', retry_after_seconds: 1800, alert: true };
    assert.deepEqual(await store.consumeFairUseRate('fair-use:abc', 1234, limits), { allowed: false, window: 'hour', retryAfterSeconds: 1800, alert: true });
    reply = { allowed: false, window: 'minute', retry_after_seconds: 12, alert: false };
    assert.deepEqual(await store.consumeFairUseRate('fair-use:abc', 1234, limits), { allowed: false, window: 'minute', retryAfterSeconds: 12, alert: false });
    assert.equal(seen.length, 3);
    for (const call of seen) {
      assert.equal(call.url.pathname, '/rest/v1/rpc/consume_fair_use_rate_limit');
      assert.ok(call.body && typeof call.body === 'object');
      assert.deepEqual(Object.keys(call.body).sort(), [...declared].sort());
      assert.deepEqual(call.body, { p_bucket: 'fair-use:abc', p_characters: 1234, p_per_minute: 10, p_per_hour: 60, p_characters_per_hour: 1_000_000 });
    }
  } finally {
    globalThis.fetch = original;
  }
});
