import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';

// Real route + memory store. Test-mode key; the event type is one the handler ignores, so no
// request leaves the machine.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.STRIPE_SECRET_KEY = 'sk_test_local_only_never_sent';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';

function post(event: { id: string; type: string }): Promise<Response> {
  const payload = JSON.stringify({ object: 'event', data: { object: { id: 'cus_ignored', object: 'customer' } }, ...event });
  return webhook(new Request('http://localhost/api/v1/billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': getStripe().webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_only' }) },
    body: payload,
  }));
}

test('a delivery that arrives while the first is still processing gets 409 so Stripe retries; a completed one is a 200 duplicate', async () => {
  const event = { id: `evt_${randomUUID()}`, type: 'customer.created' };
  const store = getBillingStore();
  // The first delivery holds the claim and is still running.
  await store.claimWebhook(event.id, event.type);
  const retry = await post(event);
  assert.equal(retry.status, 409, 'an in-progress claim must not be acknowledged');
  assert.equal((await retry.json() as { error: string }).error, 'webhook_in_progress');

  await store.completeWebhook(event.id);
  const replay = await post(event);
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), { received: true, duplicate: true });
});
