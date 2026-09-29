'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/Button';
import { track } from '@/lib/analytics';
import { PRICING } from '@/lib/pricing';

type Interval = 'monthly' | 'annual';

function priceFor(id: string, interval: Interval, fallback: string): { price: string; per: string } {
  if (id === 'pro') return interval === 'annual' ? { price: `$${PRICING.proAnnual}`, per: '/year' } : { price: `$${PRICING.proMonthly}`, per: '/month' };
  if (id === 'teams') return interval === 'annual' ? { price: `$${PRICING.teamsSeatAnnual}`, per: '/seat/year' } : { price: `$${PRICING.teamsSeatMonthly}`, per: '/seat/month' };
  if (id === 'lifetime') return { price: fallback, per: ' once' };
  return { price: fallback, per: '' };
}

const corePlans = [
  { id: 'free', name: 'Free', badge: 'Free during the beta', eyebrow: 'Understand the code in front of you.', price: '$0', detail: 'Limited AI explanations during the beta. Included cloud models. No card or separate API key.', features: ['Selected-code explanations', 'Core explanation levels', 'Saved explanations and progress', 'On-device secret filtering'], cta: 'Download free', href: '/beta' },
  { id: 'pro', name: 'Pro', badge: 'Individual', eyebrow: 'Keep the context, not just the answer.', price: '', detail: 'One developer account. Cancel anytime from the Plan page in the app.', features: ['File, diff, and project context', 'Five explanation depths', 'Follow-up and Test me', 'Saved concepts, history, and study'], cta: 'Download, then upgrade', href: '/beta', featured: true },
  { id: 'lifetime', name: 'Pro Lifetime', badge: 'One-time', eyebrow: 'Own the personal core.', price: `$${PRICING.proLifetime}`, detail: 'One-time. Local and core personal features forever. Checkout from the Unvibe app Plan page.', features: ['Personal understanding loop', 'Saved explanations and study', 'No monthly Pro bill', 'Does not include Teams GitHub intelligence'], cta: 'Download, then buy', href: '/beta' },
  { id: 'teams', name: 'Teams', badge: 'Founding pilot', eyebrow: 'Share a workspace and see who reviewed what.', price: '', detail: `Founding price. ${PRICING.teamsMinSeats}–${PRICING.teamsMaxSeats} seats. Shared activity with authorship in the app. Explanation text stays on each device. GitHub intelligence stays Pilot.`, features: ['Shared workspace and invites', 'Who reviewed what (metadata)', '2–20 founding seats', 'GitHub intelligence still Pilot'], cta: 'Request Teams seats', href: 'mailto:preston@unvibe.site?subject=Unvibe%20Teams%20founding%20pilot&body=Company%20email%3A%20%0ASeats%20wanted%20(2%E2%80%9320)%3A%20%0A%0AWe%20want%20the%20Teams%20founding%20pilot%20(workspace%20%2B%20who%20reviewed%20what).' },
] as const;

export function PricingPlans() {
  const trackedView = useRef(false);
  const [interval, setBilling] = useState<Interval>('monthly');
  useEffect(() => {
    if (!trackedView.current) {
      trackedView.current = true;
      track('pricing_viewed');
    }
  }, []);

  return (
    <div className="pricing-plans">
      <div className="pricing-plans__intro">
        <p className="paper-meta">Simple pricing</p>
        <h2>Start free. Upgrade when it earns a place in your day.</h2>
        <p>
          Free covers the core loop with no card and no API key. Pro adds more context and study tools.
          Teams is a founding pilot with a shared workspace.
        </p>
      </div>
      <div className="pricing-toggle" role="radiogroup" aria-label="Billing interval">
        {(['monthly', 'annual'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={interval === value}
            className={interval === value ? 'is-on' : undefined}
            onClick={() => { setBilling(value); track('billing_interval_selected', { interval: value }); }}
          >
            {value === 'monthly' ? 'Monthly' : 'Annual'}
            {value === 'annual' ? <span>Save {PRICING.annualDiscountPercent}%</span> : null}
          </button>
        ))}
        <span className="pricing-toggle__thumb" data-on={interval} aria-hidden="true" />
      </div>
      <div className="marketing-plan-grid marketing-plan-grid--core">
        {corePlans.map((plan) => (
          <article key={plan.id} className={`marketing-plan-card${'featured' in plan && plan.featured ? ' featured' : ''}`}>
            <span className="plan-badge">{plan.badge}</span>
            <h3>{plan.name}</h3>
            <p className="plan-kicker">{plan.eyebrow}</p>
            {(() => {
              const { price, per } = priceFor(plan.id, interval, plan.price);
              return (
                <strong className="marketing-plan-price" key={`${plan.id}-${interval}`}>
                  {price}<span className="marketing-plan-per">{per}</span>
                </strong>
              );
            })()}
            <small>{plan.detail}</small>
            <ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
            <Button href={plan.href} size="lg" className="pricing-button" onClick={() => track('plan_cta_clicked', { plan: plan.id })}>{plan.cta}</Button>
          </article>
        ))}
      </div>
      <p className="pricing-disclosure">
        Prices in USD. Lifetime is a one-time payment. “Pilot” means early access, not general availability.
        Full explanation text is not shared across seats.
      </p>
    </div>
  );
}
