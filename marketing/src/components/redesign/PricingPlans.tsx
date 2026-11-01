'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/Button';
import { track } from '@/lib/analytics';
import { PRICING } from '@/lib/pricing';
import { pricingCopy } from '@/lib/pricingCopy';
import { AI_MAINTENANCE, AI_MAINTENANCE_NOTE } from '@/lib/aiMaintenance';
import { trackDownloadPageClick } from '@/lib/downloadTracking';

/** 'both': payments closed, so there is nothing to choose; each card states both prices in one line. */
type Interval = 'monthly' | 'annual' | 'both';

function priceFor(id: string, interval: Interval, fallback: string): { price: string; per: string } {
  if (id === 'pro') {
    if (interval === 'both') return { price: `$${PRICING.proMonthly}`, per: ` a month, or $${PRICING.proAnnual} a year` };
    return interval === 'annual' ? { price: `$${PRICING.proAnnual}`, per: '/year' } : { price: `$${PRICING.proMonthly}`, per: '/month' };
  }
  if (id === 'teams') {
    if (interval === 'both') return { price: `$${PRICING.teamsSeatMonthly}`, per: ` a seat a month, or $${PRICING.teamsSeatAnnual} a year` };
    return interval === 'annual' ? { price: `$${PRICING.teamsSeatAnnual}`, per: '/seat/year' } : { price: `$${PRICING.teamsSeatMonthly}`, per: '/seat/month' };
  }
  return { price: fallback, per: '' };
}

/** Plan buttons that open the download page also count as download calls to action. */
export function trackPlanCta(plan: { id: string; href: string | null }): void {
  track('plan_cta_clicked', { plan: plan.id });
  if (plan.href === '/beta') trackDownloadPageClick('pricing');
}

/** `paymentsOpen` comes from the server (lib/paymentsStatus); closed copy never promises checkout. */
export function PricingPlans({ paymentsOpen }: { paymentsOpen: boolean }) {
  const trackedView = useRef(false);
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  // The Monthly/Annual toggle comes back when checkout opens.
  const interval: Interval = paymentsOpen ? billing : 'both';
  const copy = pricingCopy(paymentsOpen);
  useEffect(() => {
    if (!trackedView.current) {
      trackedView.current = true;
      track('pricing_viewed');
    }
  }, []);

  return (
    <div className="pricing-plans">
      <header className="pricing-plans__intro">
        <p className="paper-meta">Pricing</p>
        <h1 id="pricing-title">{copy.heading.lead}<em>{copy.heading.emphasis}</em>{copy.heading.tail}</h1>
        <p>Free needs no card and no API key.</p>
      </header>
      {paymentsOpen ? (
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
      ) : null}
      {/* The h1 above is the page heading; this keeps the outline h1 > h2 > h3 for the plan cards. */}
      <h2 className="sr-only">Plans</h2>
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
            {plan.note ? <p className="plan-note">{plan.note}</p> : null}
            <small>{plan.detail}</small>
            <ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
            {plan.after ? <p className="plan-after">{plan.after}</p> : null}
            {plan.cta && plan.href ? (
              <Button
                href={plan.href}
                size="lg"
                variant={plan.primary ? 'primary' : 'secondary'}
                className={plan.primary ? 'pricing-button' : 'pricing-button pricing-button--quiet'}
                onClick={() => trackPlanCta(plan)}
              >
                {plan.cta}
              </Button>
            ) : null}
          </article>
        ))}
      </div>
      {AI_MAINTENANCE ? <p className="pricing-disclosure" role="status">{AI_MAINTENANCE_NOTE}</p> : null}
      <p className="pricing-disclosure">{copy.disclosure}</p>
    </div>
  );
}
