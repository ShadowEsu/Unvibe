'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/Button';
import { track } from '@/lib/analytics';

type Interval = 'monthly' | 'annual';

const cards = {
  free: [
    '50 explanations each month',
    'Selected-code explanations',
    'Core explanation levels',
    'Spaced study / revisit queue',
    'Saved explanations and progress',
    'No credit card required',
  ],
  pro: [
    '100 explanations each month',
    'Git diff explanations',
    'Agent change briefs',
    'Nearby-file context',
    'Since-last-understood compares',
    'Expert explanations',
  ],
};

export function PricingPlans() {
  const [interval, setInterval] = useState<Interval>('monthly');
  const trackedView = useRef(false);
  const annual = interval === 'annual';
  useEffect(() => { if (!trackedView.current) { trackedView.current = true; track('pricing_viewed'); } }, []);
  const chooseInterval = (next: Interval) => { setInterval(next); track('billing_interval_selected', { interval: next }); };
  return (
    <div className="pricing-plans">
      <div className="marketing-billing-toggle" aria-label="Billing interval">
        <button type="button" className={!annual ? 'active' : ''} onClick={() => chooseInterval('monthly')} aria-pressed={!annual}>Monthly</button>
        <button type="button" className={annual ? 'active' : ''} onClick={() => chooseInterval('annual')} aria-pressed={annual}>Annual <span>Save 25%</span></button>
      </div>
      <p className="annual-savings-note"><strong>Pro annual:</strong> $72/year — about $6/month. Save 25% vs monthly.</p>
      <div className="marketing-plan-grid marketing-plan-grid--two">
        <PlanCard plan="free" interval={interval} name="Free" eyebrow="Learn the code in front of you." price="$0" detail="No card required" features={cards.free} cta="Start for free" />
        <PlanCard plan="pro" interval={interval} name="Pro" eyebrow="Understand the change around it." price={annual ? '$72/year' : '$8/month'} detail={annual ? 'About $6/month · billed once yearly' : 'For one personal account · billed monthly'} features={cards.pro} cta="Upgrade to Pro" featured />
      </div>
      <p className="pricing-disclosure">Free covers selected code and your study queue. Pro adds git diffs, agent briefs, nearby files, and since-last-understood compares. Private code is filtered locally before approved context is sent.</p>
    </div>
  );
}

function PlanCard({ plan, interval, name, eyebrow, price, detail, savings, features, cta, featured = false }: { plan: 'free' | 'pro'; interval: Interval; name: string; eyebrow: string; price: string; detail: string; savings?: string; features: string[]; cta: string; featured?: boolean }) {
  return <article className={`marketing-plan-card${featured ? ' featured' : ''}`}>
    <span className="plan-badge">{eyebrow}</span><h3>{name}</h3><strong className="marketing-plan-price">{price}</strong><small>{detail}</small>{savings && <b className="savings-badge">{savings}</b>}
    <ul>{features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
    <Button href="#waitlist" size="lg" className="pricing-button" onClick={() => track('plan_cta_clicked', { plan, interval })}>{cta}</Button>
  </article>;
}
