'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { SegmentedControl } from 'glisse';
import { Button } from '@/components/Button';
import { GlassPlate } from '@/components/glass/GlassPlate';
import { track } from '@/lib/analytics';
import { PRICING } from '@/lib/pricing';
import { pricingCopy } from '@/lib/pricingCopy';
import { trackDownloadPageClick } from '@/lib/downloadTracking';

type Interval = 'monthly' | 'annual';

function priceFor(id: string, interval: Interval, fallback: string): { price: string; per: string } {
  if (id === 'pro') return interval === 'annual' ? { price: `$${PRICING.proAnnual}`, per: '/year' } : { price: `$${PRICING.proMonthly}`, per: '/month' };
  if (id === 'teams') return interval === 'annual' ? { price: `$${PRICING.teamsSeatAnnual}`, per: '/seat/year' } : { price: `$${PRICING.teamsSeatMonthly}`, per: '/seat/month' };
  return { price: fallback, per: '' };
}

/** Plan buttons that open the download page also count as download calls to action. */
export function trackPlanCta(plan: { id: string; href: string }): void {
  track('plan_cta_clicked', { plan: plan.id });
  if (plan.href === '/beta') trackDownloadPageClick('pricing');
}

/** `paymentsOpen` comes from the server (lib/paymentsStatus); closed copy never promises checkout. */
export function PricingPlans({ paymentsOpen }: { paymentsOpen: boolean }) {
  const trackedView = useRef(false);
  const [interval, setBilling] = useState<Interval>('monthly');
  const copy = pricingCopy(paymentsOpen);
  // Glisse's SegmentedControl: a radiogroup of two radios, arrow keys move the choice. Built here, not at module
  // level: the test runner's classic JSX transform needs React in scope for JSX evaluated at import.
  const billingItems = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'annual', label: <>Annual <span>Save {PRICING.annualDiscountPercent}%</span></> },
  ];
  useEffect(() => {
    if (!trackedView.current) {
      trackedView.current = true;
      track('pricing_viewed');
    }
  }, []);

  return (
    <div className="pricing-plans">
      <header className="pricing-plans__intro">
        {/* One upright sentence: the copy keeps its lead/emphasis/tail parts, rendered without an accent word (Design, ledger 443). */}
        <h1 id="pricing-title">{`${copy.heading.lead}${copy.heading.emphasis}${copy.heading.tail}`}</h1>
        <p>Free needs no card and no API key.</p>
      </header>
      <SegmentedControl
        className="pricing-toggle"
        aria-label="Billing interval"
        items={billingItems}
        value={interval}
        onValueChange={(value) => {
          const next: Interval = value === 'annual' ? 'annual' : 'monthly';
          setBilling(next);
          track('billing_interval_selected', { interval: next });
        }}
      />
      {/* The h1 above is the page heading; this keeps the outline h1 > h2 > h3 for the plan cards. */}
      <h2 className="sr-only">Plans</h2>
      <div className="marketing-plan-grid marketing-plan-grid--core">
        {copy.plans.map((plan) => (
          <article key={plan.id} id={plan.id} className={`marketing-plan-card${plan.featured ? ' featured' : ''}`}>
            <GlassPlate />
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
              onClick={() => trackPlanCta(plan)}
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
