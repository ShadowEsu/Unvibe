export type CheckoutOutcome = 'success' | 'canceled';

// Without a session this page cannot know whether a payment went through, so it never says one did.
const COPY: Record<CheckoutOutcome, { title: string; body: string }> = {
  success: { title: 'Back from checkout', body: 'If you finished paying, go back to the Unvibe app. Your plan updates there within a minute.' },
  canceled: { title: 'Checkout canceled', body: 'Nothing was charged. You can go back to the Unvibe app.' },
};

/**
 * Where Stripe returns a buyer whose browser has no Unvibe session (the desktop app opens checkout in
 * the system browser). Static copy only: it reads no account, trusts no session_id, and grants nothing;
 * the webhook updates the plan.
 */
export function CheckoutReturn({ outcome }: { outcome: CheckoutOutcome }) {
  const { title, body } = COPY[outcome];
  return (
    <section className="plan-page" aria-labelledby="checkout-return-title">
      <header className="plan-header">
        <div><p className="eyebrow">Plan & usage</p><h1 id="checkout-return-title">{title}</h1></div>
      </header>
      <p className="plan-notice plan-notice--quiet" role="status">{body}</p>
    </section>
  );
}
