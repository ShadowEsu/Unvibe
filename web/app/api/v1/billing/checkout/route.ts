import { getStore } from '@/data/store';
import { getBillingStore } from '@/billing/store';
import { isResponse, requireUser, billingError } from '@/billing/http';
import { CheckoutPendingError } from '@/billing/checkoutPending';
import { TeamWorkspaceLimitError, teamWorkspaceLimitResponse } from '@/billing/teamWorkspaceLimit';
import { CHECKOUT_SESSION_TTL_MS, complimentaryPaidEnd, isNewTierPlan, newTiersEnabled, normalizedSeats, PLAN_NAMES, planDisplayName, planSoldOnInterval, teamsCheckoutEnabled } from '@/billing/plans';
import { checkoutOpen, getStripe, lifetimeCheckoutOpen, newTierCheckoutOpen, PAYMENTS_NOT_OPEN, publicAppUrl, stripePriceId } from '@/billing/stripe';
import type { BillingInterval, BillingStore, SubscriptionStatus, WorkspaceAccess } from '@/billing/types';

export const runtime = 'nodejs';

interface CheckoutBody { plan?: unknown; interval?: unknown; seats?: unknown; workspaceId?: unknown; workspaceName?: unknown }

function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'monthly' || value === 'annual' || value === 'lifetime';
}

/**
 * The team workspace a Teams checkout without a workspace id should use: one the owner already has
 * with no live subscription (preferring one with an open checkout), so retries never pile up empty
 * workspaces or open a second payable session elsewhere.
 */
async function reusableTeamWorkspace(billing: BillingStore, userId: string): Promise<WorkspaceAccess | null> {
  const owned = (await billing.listWorkspaces(userId)).filter((w) => w.type === 'team' && w.role === 'owner');
  let free: WorkspaceAccess | null = null;
  for (const workspace of owned) {
    const { subscription } = await billing.overview(userId, workspace.id);
    if (subscription.stripeSubscriptionId && subscription.status !== 'canceled') continue;
    if (await billing.pendingCheckout(userId, workspace.id)) return workspace;
    free ??= workspace;
  }
  return free;
}

export async function POST(req: Request): Promise<Response> {
  const user = await requireUser(req);
  if (isResponse(user)) return user;
  // Fully configured (webhook secret included) and not locked; otherwise a paid session could never grant.
  if (!checkoutOpen()) return Response.json(PAYMENTS_NOT_OPEN, { status: 503 });
  try {
    const body = (await req.json()) as CheckoutBody;
    // Enterprise and Big Business are refused outright unless the flag is exactly `true`.
    if (isNewTierPlan(body.plan) && !newTiersEnabled()) {
      return Response.json({ error: 'plan_unavailable', message: 'Enterprise and Big Business payments open soon. Contact us to apply.' }, { status: 400 });
    }
    if (body.plan === 'teams' && !teamsCheckoutEnabled()) {
      return Response.json({ error: 'teams_unavailable', message: 'Teams is not available right now. Choose Pro for a personal plan.' }, { status: 403 });
    }
    if ((body.plan !== 'pro' && body.plan !== 'teams' && !isNewTierPlan(body.plan)) || !isBillingInterval(body.interval)) {
      return Response.json({ error: 'invalid_checkout', message: 'Choose Pro and a valid billing interval.' }, { status: 400 });
    }
    const plan = body.plan;
    const interval = body.interval;
    if (!planSoldOnInterval(plan, interval)) {
      const message = plan === 'enterprise' ? 'Enterprise is billed monthly.'
        : plan === 'business' ? 'Big Business is a one-time payment.'
        : 'Lifetime is only available for Pro.';
      return Response.json({ error: 'invalid_checkout', message }, { status: 400 });
    }
    if (isNewTierPlan(plan) && !newTierCheckoutOpen(plan)) {
      return Response.json({ error: 'plan_unavailable', message: `${PLAN_NAMES[plan]} is not available right now.` }, { status: 503 });
    }
    if (plan === 'pro' && interval === 'lifetime' && !lifetimeCheckoutOpen()) {
      return Response.json({ error: 'lifetime_unavailable', message: 'Pro Lifetime is not available. Choose monthly or annual Pro.' }, { status: 503 });
    }
    const billing = getBillingStore();
    const requestedSeats = typeof body.seats === 'number' ? body.seats : Number(body.seats ?? (plan === 'teams' ? 2 : 1));
    const seats = interval === 'lifetime' ? 1 : normalizedSeats(plan, requestedSeats);
    // Pro, Enterprise and Big Business are one account each, on the personal workspace.
    const personal = plan !== 'teams';
    let workspace: WorkspaceAccess | null;
    if (personal) {
      workspace = await billing.ensurePersonalWorkspace(user);
    } else if (typeof body.workspaceId === 'string') {
      workspace = await billing.getWorkspaceAccess(user, body.workspaceId);
      if (!workspace) return Response.json({ error: 'workspace_not_found', message: 'That team workspace was not found.' }, { status: 404 });
    } else {
      const name = typeof body.workspaceName === 'string' && body.workspaceName.trim() ? body.workspaceName.trim().slice(0, 120) : 'My team';
      workspace = (await reusableTeamWorkspace(billing, user)) ?? (await billing.createTeamWorkspace(user, name));
    }
    if (!workspace || workspace.role !== 'owner' || workspace.type !== (personal ? 'personal' : 'team')) {
      return Response.json({ error: 'forbidden', message: 'Only the workspace owner can start this subscription.' }, { status: 403 });
    }
    const current = await billing.overview(user, workspace.id);
    if (current.subscription.interval === 'lifetime' && current.subscription.status === 'active') {
      return Response.json({ error: 'lifetime_active', message: `This account already has ${current.subscription.plan === 'pro' ? 'Pro Lifetime' : planDisplayName(current.subscription.plan)}.` }, { status: 409 });
    }
    // Complimentary access (promo code, gift, referral) runs to its end date first: a paid
    // subscription now would replace it and the remaining free time would be lost.
    const complimentaryEnd = complimentaryPaidEnd(current.subscription);
    if (complimentaryEnd) {
      const planName = planDisplayName(current.subscription.plan);
      const until = new Date(complimentaryEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
      return Response.json({
        error: 'complimentary_active',
        message: `You already have ${planName} until ${until}. You can subscribe after that.`,
        proUntil: complimentaryEnd,
      }, { status: 409 });
    }
    // Only a subscription that can still charge or entitle blocks a new checkout; an inactive or
    // canceled row that still carries its old Stripe id must not lock the workspace out for good.
    const blocking: readonly SubscriptionStatus[] = ['active', 'trialing', 'past_due', 'grace_period', 'unpaid'];
    if (current.subscription.stripeSubscriptionId && blocking.includes(current.subscription.status)) {
      return Response.json({ error: 'subscription_exists', message: 'Use Manage billing to change an existing subscription.' }, { status: 409 });
    }
    const stripe = getStripe();
    const pending = await billing.pendingCheckout(user, workspace.id);
    if (!personal && !pending) {
      // One open Teams checkout per owner across all of their team workspaces.
      for (const other of (await billing.listWorkspaces(user)).filter((w) => w.type === 'team' && w.role === 'owner' && w.id !== workspace.id)) {
        if (await billing.pendingCheckout(user, other.id)) {
          return Response.json({ error: 'checkout_pending', message: 'Finish or wait for the open Teams checkout before starting another.' }, { status: 409 });
        }
      }
    }
    if (pending?.stripeCheckoutSessionId && pending.plan === plan && pending.interval === interval && pending.seats === seats) {
      const existing = await stripe.checkout.sessions.retrieve(pending.stripeCheckoutSessionId);
      if (existing.status === 'open' && existing.url) return Response.json({ url: existing.url, reused: true });
      await billing.expireCheckoutIntent(pending.id);
    } else if (pending) {
      return Response.json({ error: 'checkout_pending', message: 'Finish or wait for the open checkout before starting another.' }, { status: 409 });
    }
    // Everything that can fail on configuration runs before the intent, so a config error never
    // leaves an open intent that answers the next try with checkout_pending.
    const account = await getStore().accountInfo(user);
    const appUrl = publicAppUrl(req);
    const price = stripePriceId(plan, interval);
    let intent;
    try {
      intent = await billing.createCheckoutIntent({ userId: user, workspaceId: workspace.id, plan, interval, seats });
    } catch (error) {
      // A parallel request (double click, second tab) created the open intent first.
      if (error instanceof CheckoutPendingError) return Response.json({ error: 'checkout_pending', message: 'Finish or wait for the open checkout before starting another.' }, { status: 409 });
      throw error;
    }
    const metadata = {
      workspace_id: workspace.id,
      user_id: user,
      plan,
      interval,
      checkout_intent_id: intent.id,
    };
    // Reuse the Stripe customer after cancellation or a prior purchase. Email is only a
    // starting hint for a first checkout; it is never the authority for account ownership.
    const customer = current.subscription.stripeCustomerId
      ? { customer: current.subscription.stripeCustomerId }
      : { customer_email: account.email };
    let session;
    // Stripe keeps a session payable for 24 hours by default; end it before the intent is
    // considered stale, so the server never opens a second payable session for one workspace.
    const expires_at = Math.floor((Date.now() + CHECKOUT_SESSION_TTL_MS) / 1000);
    try {
      // Pro Lifetime and Big Business are one-time payments: the line item is the plan's own price only.
      // Big Business takes no promotion code: an account-wide code must never discount the $5,000 price.
      session = interval === 'lifetime'
        ? await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [{ price, quantity: 1 }],
          success_url: `${appUrl}/plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/plan?checkout=canceled`,
          client_reference_id: intent.id,
          expires_at,
          ...customer,
          ...(!current.subscription.stripeCustomerId ? { customer_creation: 'always' as const } : {}),
          metadata,
          payment_intent_data: { metadata },
          ...(plan === 'business' ? {} : { allow_promotion_codes: true }),
        }, { idempotencyKey: `uncode-checkout-${intent.id}` })
        : await stripe.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price, quantity: seats }],
          custom_text: {
            submit: {
              message: 'Your subscription renews automatically at the price shown above until canceled. Manage or cancel it from Unvibe Plan.',
            },
          },
          success_url: `${appUrl}/plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/plan?checkout=canceled`,
          client_reference_id: intent.id,
          expires_at,
          ...customer,
          metadata,
          subscription_data: { metadata },
          allow_promotion_codes: true,
        }, { idempotencyKey: `uncode-checkout-${intent.id}` });
    } catch (error) {
      await billing.expireCheckoutIntent(intent.id);
      await billing.recordAudit(user, workspace.id, 'checkout.failed', { plan, interval });
      throw error;
    }
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    await billing.attachCheckoutSession(intent.id, session.id);
    await billing.recordAudit(user, workspace.id, 'checkout.created', { plan, interval, seats });
    return Response.json({ url: session.url }, { status: 201 });
  } catch (error) {
    // Every owned team workspace is paid for and the owner is at the cap: no new one for this checkout.
    if (error instanceof TeamWorkspaceLimitError) return teamWorkspaceLimitResponse();
    return billingError(error, 503);
  }
}
