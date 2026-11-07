'use client';

import { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { PRICING } from '@/lib/pricing';
import { pricingCopy } from '@/lib/pricingCopy';
import { AI_MAINTENANCE, AI_MAINTENANCE_NOTE } from '@/lib/aiMaintenance';
import { DownloadCta } from '@/site/dia/DownloadCta';
import { BtnDot } from '@/site/dia/effects';

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

/** A plan button click. The download buttons are DownloadCta's one-click download, which sends download_cta_clicked. */
export function trackPlanCta(plan: { id: string }): void {
  track('plan_cta_clicked', { plan: plan.id });
}

/**
 * `paymentsOpen` comes from the server (lib/paymentsStatus); closed copy never promises checkout. Direction D (mock 10):
 * three white cards; hovering or focusing the Pro card fades Van Gogh's Irises in behind the page (the card is the
 * [data-d-bgswap-trigger]; app/pricing/page.tsx holds the painting layer and its credit).
 */
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
      <div className="pricing-plans__intro">
        <h1 id="pricing-title" className="d-serif">{copy.heading.lead}<em className="d-hl">{copy.heading.emphasis}</em>{copy.heading.tail}</h1>
        <p>Free needs no card and no API key.</p>
      </div>
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
          <article key={plan.id} id={plan.id} className={`marketing-plan-card${plan.featured ? ' featured' : ''}`} {...(plan.id === 'pro' ? { 'data-d-bgswap-trigger': '' } : {})}>
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
            <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            {plan.after ? <p className="plan-after">{plan.after}</p> : null}
            {plan.href === '/beta' ? (
              <DownloadCta surface="pricing" className={plan.primary ? 'pricing-button d-btn' : 'pricing-button pricing-button--quiet d-btn'} onClick={() => trackPlanCta(plan)}>
                {plan.cta}
              </DownloadCta>
            ) : (
              <a href={plan.href} className="pricing-button pricing-button--quiet d-btn" onClick={() => trackPlanCta(plan)}>
                {plan.cta}
                <BtnDot />
              </a>
            )}
          </article>
        ))}
      </div>
      {AI_MAINTENANCE ? <p className="pricing-disclosure" role="status">{AI_MAINTENANCE_NOTE}</p> : null}
      <p className="pricing-disclosure">{copy.disclosure}</p>
    </div>
  );
}
