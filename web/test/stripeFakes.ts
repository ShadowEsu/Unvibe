import type Stripe from 'stripe';

/**
 * A PaymentIntent as the webhook retrieves it (`latest_charge` expanded): succeeded, its charge
 * neither refunded nor disputed, unless the overrides say otherwise.
 */
export function paymentIntent(id: string, charge: Partial<Stripe.Charge> = {}, status: Stripe.PaymentIntent.Status = 'succeeded'): Stripe.PaymentIntent {
  return {
    id,
    object: 'payment_intent',
    status,
    latest_charge: { id: `ch_${id}`, object: 'charge', amount: 500_000, amount_refunded: 0, refunded: false, disputed: false, ...charge },
  } as unknown as Stripe.PaymentIntent;
}

/**
 * A paid invoice of `subscriptionId` whose line period starts at `periodStart`. With the
 * subscription's `current_period_start` and the default reason it is the invoice that pays the
 * current period; `subscription_update` makes it a proration.
 */
export function periodInvoice(subscriptionId: string, periodStart: number, billingReason: Stripe.Invoice.BillingReason = 'subscription_create'): Stripe.Invoice {
  return {
    id: `in_${subscriptionId}_${periodStart}_${billingReason}`, object: 'invoice', billing_reason: billingReason,
    parent: { subscription_details: { subscription: subscriptionId } }, lines: { data: [{ period: { start: periodStart } }] },
  } as unknown as Stripe.Invoice;
}

/** One paid payment of a subscription's latest paid invoice as the webhook route returns it: with the invoice expanded. */
export function paidPayment(paymentIntentId: string, invoice: Stripe.Invoice): Stripe.InvoicePayment {
  return { payment: { type: 'payment_intent', payment_intent: paymentIntentId }, invoice } as Stripe.InvoicePayment;
}

/** The grant checks' Stripe calls when every payment is good: no paid invoice yet, and any PaymentIntent succeeded. */
export const goodPayments = {
  latestPaidInvoicePayments: async (): Promise<Stripe.InvoicePayment[]> => [],
  retrievePaymentIntent: async (id: string): Promise<Stripe.PaymentIntent> => paymentIntent(id),
};
