import { getStore } from '@/data/store';
import { getBillingStore } from '@/billing/store';
import { isResponse, requireUser, billingError } from '@/billing/http';
import { normalizedSeats } from '@/billing/plans';
import { getStripe, publicAppUrl, stripePriceId } from '@/billing/stripe';
import type { BillingInterval } from '@/billing/types';

export const runtime = 'nodejs';

interface CheckoutBody { plan?: unknown; interval?: unknown; seats?: unknown; workspaceId?: unknown; workspaceName?: unknown }

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  try {
    const body = (await req.json()) as CheckoutBody;
    if ((body.plan !== 'pro' && body.plan !== 'teams') || (body.interval !== 'monthly' && body.interval !== 'annual')) {
      return Response.json({ error: 'invalid_checkout', message: 'Choose Pro or Teams and a valid billing interval.' }, { status: 400 });
    }
    const billing = getBillingStore();
    const requestedSeats = typeof body.seats === 'number' ? body.seats : Number(body.seats ?? (body.plan === 'teams' ? 2 : 1));
    const seats = normalizedSeats(body.plan, requestedSeats);
    const personal = body.plan === 'pro';
    let workspace = personal ? await billing.ensurePersonalWorkspace(user) : null;
    if (!personal && typeof body.workspaceId === 'string') workspace = await billing.getWorkspaceAccess(user, body.workspaceId);
    if (!personal && !workspace) {
      const name = typeof body.workspaceName === 'string' ? body.workspaceName.trim() : 'My team';
      workspace = await billing.createTeamWorkspace(user, name);
    }
    if (!workspace || workspace.role !== 'owner' || workspace.type !== (personal ? 'personal' : 'team')) {
      return Response.json({ error: 'forbidden', message: 'Only the workspace owner can start this subscription.' }, { status: 403 });
    }
    const current = await billing.overview(user, workspace.id);
    if (current.subscription.stripeSubscriptionId && current.subscription.status !== 'canceled') {
      return Response.json({ error: 'subscription_exists', message: 'Use Manage billing to change an existing subscription.' }, { status: 409 });
    }
    const stripe = getStripe();
    const pending = await billing.pendingCheckout(user, workspace.id);
    if (pending?.stripeCheckoutSessionId && pending.plan === body.plan && pending.interval === body.interval && pending.seats === seats) {
      const existing = await stripe.checkout.sessions.retrieve(pending.stripeCheckoutSessionId);
      if (existing.status === 'open' && existing.url) return Response.json({ url: existing.url, reused: true });
      await billing.expireCheckoutIntent(pending.id);
    } else if (pending) {
      return Response.json({ error: 'checkout_pending', message: 'Finish or wait for the open checkout before starting another.' }, { status: 409 });
    }
    const intent = await billing.createCheckoutIntent({ userId: user, workspaceId: workspace.id, plan: body.plan, interval: body.interval, seats });
    const account = await getStore().accountInfo(user);
    const appUrl = publicAppUrl(req);
    const metadata = { workspace_id: workspace.id, user_id: user, plan: body.plan, interval: body.interval, checkout_intent_id: intent.id };
    let session;
    try { session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: stripePriceId(body.plan, body.interval as BillingInterval), quantity: seats }],
      success_url: `${appUrl}/plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/plan?checkout=canceled`,
      client_reference_id: intent.id,
      customer_email: account.email,
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
    }, { idempotencyKey: `uncode-checkout-${intent.id}` }); }
    catch (error) { await billing.expireCheckoutIntent(intent.id); await billing.recordAudit(user, workspace.id, 'checkout.failed', { plan: body.plan, interval: body.interval }); throw error; }
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    await billing.attachCheckoutSession(intent.id, session.id);
    await billing.recordAudit(user, workspace.id, 'checkout.created', { plan: body.plan, interval: body.interval, seats });
    return Response.json({ url: session.url }, { status: 201 });
  } catch (error) {
    return billingError(error, 503);
  }
}
