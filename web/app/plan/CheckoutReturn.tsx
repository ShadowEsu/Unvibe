export type CheckoutOutcome = 'success' | 'canceled' | 'signed-out';

// Without a session this page cannot know whether a payment went through, so it never says one did.
const COPY: Record<CheckoutOutcome, { title: string; body: string }> = {
  success: { title: 'Back from checkout', body: 'If you finished paying, go back to the Unvibe app. Your plan updates there within a minute.' },
  canceled: { title: 'Checkout canceled', body: 'Nothing was charged. You can go back to the Unvibe app.' },
  // The web sign-in page was retired (35dd9946); sign-in starts in the app, which also shows the plan.
  'signed-out': { title: 'Sign in from the Unvibe app', body: 'Open the Unvibe app and choose Sign in to sync from the account menu. Your plan shows there under Plan and usage.' },
};

/**
 * The no-session /plan page: where Stripe returns a buyer whose browser has no Unvibe session (the
 * desktop app opens checkout in the system browser), and where an old /plan link lands signed out.
 * Static copy only: it reads no account, trusts no session_id, and grants nothing; the webhook updates the plan.
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
