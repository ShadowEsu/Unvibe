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

/** The grant checks' Stripe calls when every payment is good: no paid invoice yet, and any PaymentIntent succeeded. */
export const goodPayments = {
  latestPaidInvoicePayments: async (): Promise<Stripe.InvoicePayment[]> => [],
  retrievePaymentIntent: async (id: string): Promise<Stripe.PaymentIntent> => paymentIntent(id),
};
