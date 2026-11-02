import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import Stripe from 'stripe';
import { POST as webhook } from '../app/api/v1/billing/webhook/route';
import { getBillingStore } from '../src/billing/store';
import { getStripe } from '../src/billing/stripe';

// The real SDK follows pages against a local HTTP fake; no request leaves this process.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.BILLING_TEST_CHECKOUT_IN_PRODUCTION;
process.env.VERCEL_ENV = 'production';
process.env.STRIPE_SECRET_KEY = 'sk_test_localOnly';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_only';

test('locked checkout refunds read the second invoice-payment page before and after cancellation', async () => {
  const stripe = getStripe();
  const billing = getBillingStore();
  for (const ended of [false, true]) {
    const userId = randomUUID();
    const workspace = await billing.ensurePersonalWorkspace(userId);
    const intent = await billing.createCheckoutIntent({ userId, workspaceId: workspace.id, plan: 'pro', interval: 'monthly', seats: 1 });
    const sessionId = `cs_test_${randomUUID()}`;
    const subscriptionId = `sub_${randomUUID()}`;
    const invoiceId = `in_${randomUUID()}`;
    await billing.attachCheckoutSession(intent.id, sessionId);
    if (ended) await billing.recordAudit(null, workspace.id, 'checkout.stop_started', { checkoutSessionId: sessionId, subscriptionId });
    const pages: Array<string | null> = [];
    const client = new Stripe('sk_test_localOnly', {
      httpClient: Stripe.createFetchHttpClient(async (input) => {
        const url = new URL(String(input));
        assert.equal(url.pathname, '/v1/invoice_payments');
        assert.equal(url.searchParams.get('invoice'), invoiceId);
        assert.equal(url.searchParams.get('status'), 'paid');
        const after = url.searchParams.get('starting_after');
        pages.push(after);
        if (after !== null) assert.equal(after, 'ip_first');
        return Response.json({
          object: 'list', url: '/v1/invoice_payments', has_more: after === null,
          data: [{ id: after === null ? 'ip_first' : 'ip_second', object: 'invoice_payment', status: 'paid', payment: { type: 'payment_intent', payment_intent: after === null ? 'pi_first' : 'pi_second' } }],
        });
      }),
    });
    stripe.invoicePayments.list = client.invoicePayments.list.bind(client.invoicePayments);
    stripe.subscriptions.retrieve = (async () => ({ id: subscriptionId, status: ended ? 'canceled' : 'active' })) as unknown as typeof stripe.subscriptions.retrieve;
    stripe.invoices.list = (async () => ({ data: [{ id: invoiceId }] })) as unknown as typeof stripe.invoices.list;
    const refunded: string[] = [];
    stripe.refunds.create = (async (params: Stripe.RefundCreateParams) => {
      refunded.push(String(params.payment_intent));
      return { id: `re_${params.payment_intent}` };
    }) as unknown as typeof stripe.refunds.create;
    let cancels = 0;
    stripe.subscriptions.cancel = (async () => { cancels += 1; return {}; }) as unknown as typeof stripe.subscriptions.cancel;
    const payload = JSON.stringify({
      id: `evt_${randomUUID()}`, object: 'event', livemode: false, type: ended ? 'checkout.session.async_payment_succeeded' : 'checkout.session.completed',
      data: { object: { id: sessionId, mode: 'subscription', subscription: subscriptionId, invoice: invoiceId, payment_status: 'paid', metadata: { workspace_id: workspace.id } } },
    });
    const response = await webhook(new Request('http://localhost/api/v1/billing/webhook', {
      method: 'POST', headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_local_only' }) }, body: payload,
    }));
    assert.equal(response.status, 200);
    assert.deepEqual(pages, [null, 'ip_first'], `second page read with ended=${ended}`);
    assert.deepEqual(refunded, ['pi_first', 'pi_second']);
    assert.equal(cancels, ended ? 0 : 1);
  }
});
