'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/Button';
import { track } from '@/lib/analytics';
import { FAIR_USE_LABEL, PRICING } from '@/lib/pricing';
import { pricingCopy } from '@/lib/pricingCopy';
import { trackDownloadPageClick } from '@/lib/downloadTracking';

type Interval = 'monthly' | 'annual';

/** Enterprise is monthly only, so it keeps its monthly price under the Annual toggle. */
function priceFor(id: string, interval: Interval, fallback: string): { price: string; per: string } {
  if (id === 'pro') return interval === 'annual' ? { price: `$${PRICING.proAnnual}`, per: '/year' } : { price: `$${PRICING.proMonthly}`, per: '/month' };
  if (id === 'enterprise') return { price: `$${PRICING.enterpriseMonthly}`, per: '/month' };
  if (id === 'business') return { price: fallback, per: ' once' };
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
            <small>{plan.detail}</small>
            <p className="marketing-plan-allowance">
              {(() => {
                // Big Business: the offer at allowance weight, then its fair-use rate limit on its own line
                // at regular weight. Same words in the same paragraph, so its text never changes.
                const head = plan.allowanceLimit ? plan.allowance.slice(0, -plan.allowanceLimit.length) : plan.allowance;
                const linked = (text: string) => {
                  if (!plan.allowanceHref || !text.includes(FAIR_USE_LABEL)) return text;
                  const [before, after] = text.split(FAIR_USE_LABEL);
                  return <>{before}<a href={plan.allowanceHref}>{FAIR_USE_LABEL}</a>{after}</>;
                };
                return (
                  <>
                    {linked(head)}
                    {plan.allowanceLimit ? <span className="marketing-plan-allowance-limit">{linked(plan.allowanceLimit)}</span> : null}
                  </>
                );
              })()}
            </p>
            <ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
            {plan.note ? <p className="marketing-plan-note">{plan.note}</p> : null}
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
