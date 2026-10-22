'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/Button';
import { track } from '@/lib/analytics';
import { PRICING } from '@/lib/pricing';
import { pricingCopy } from '@/lib/pricingCopy';

type Interval = 'monthly' | 'annual';

function priceFor(id: string, interval: Interval, fallback: string): { price: string; per: string } {
  if (id === 'pro') return interval === 'annual' ? { price: `$${PRICING.proAnnual}`, per: '/year' } : { price: `$${PRICING.proMonthly}`, per: '/month' };
  if (id === 'teams') return interval === 'annual' ? { price: `$${PRICING.teamsSeatAnnual}`, per: '/seat/year' } : { price: `$${PRICING.teamsSeatMonthly}`, per: '/seat/month' };
  return { price: fallback, per: '' };
}

/** `paymentsOpen` comes from the server (lib/paymentsStatus); closed copy never promises checkout. */
export function PricingPlans({ paymentsOpen }: { paymentsOpen: boolean }) {
  const trackedView = useRef(false);
  const [interval, setBilling] = useState<Interval>('monthly');
  const copy = pricingCopy(paymentsOpen);
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
        <h2>{copy.heading.lead}<em>{copy.heading.emphasis}</em>{copy.heading.tail}</h2>
        <p>
          Free explains any code you select at four depths, with follow-ups and Test me. No card and no API key.
          Pro adds Expert depth, git diffs and nearby-file context. Teams is a founding pilot with a shared workspace.
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
        {copy.plans.map((plan) => (
          <article key={plan.id} id={plan.id} className={`marketing-plan-card${plan.featured ? ' featured' : ''}`}>
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
            <Button
              href={plan.href}
              size="lg"
              variant={plan.primary ? 'primary' : 'secondary'}
              className={plan.primary ? 'pricing-button' : 'pricing-button pricing-button--quiet'}
              onClick={() => track('plan_cta_clicked', { plan: plan.id })}
            >
              {plan.cta}
            </Button>
          </article>
        ))}
      </div>
      <p className="pricing-disclosure">{copy.disclosure}</p>
    </div>
  );
}
