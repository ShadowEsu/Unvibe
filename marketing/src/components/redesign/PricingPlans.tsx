'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/Button';
import { track } from '@/lib/analytics';

type Interval = 'monthly' | 'annual';
type PlanId = 'free' | 'pro' | 'team' | 'enterprise';

const cards = {
  free: [
    '30 explanations each month',
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
  team: [
    'Shared workspace in one app',
    'Notes and explanations visible to every seat',
    '2 seat minimum, 20 seat maximum',
    '$10 per seat each month',
  ],
  enterprise: [
    '1,000 AI questions and integrations a month',
    'One company workspace',
    'More room than Team',
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
      <p className="annual-savings-note">Annual is 25% off for Pro, Team, and Enterprise. Pro is $72/year. Team is $90 per seat per year, $180 for two seats, up to $1,800 for twenty. Enterprise is $450/year.</p>
      <div className="marketing-plan-grid">
        <PlanCard plan="free" interval={interval} name="Free" eyebrow="Learn the code in front of you." price="$0" detail="No card required" features={cards.free} cta="Join waitlist" />
        <PlanCard plan="pro" interval={interval} name="Pro" eyebrow="Understand the change around it." price={annual ? '$72/year' : '$8/month'} detail={annual ? 'About $6/month, billed once yearly' : 'For one personal account, billed monthly'} features={cards.pro} cta="Join waitlist" featured />
        <PlanCard plan="team" interval={interval} name="Team" eyebrow="Share the record in one app." price={annual ? '$90/seat/year' : '$10/seat'} detail={annual ? '2 seats $180/year. 20 seats $1,800/year.' : '2 seats minimum ($20). 20 seats maximum ($200).'} features={cards.team} cta="Join waitlist" soon />
        <PlanCard plan="enterprise" interval={interval} name="Enterprise" eyebrow="More room for the company." price={annual ? '$450/year' : '$50/month'} detail={annual ? 'About $37.50/month, billed once yearly' : '1,000 AI questions and integrations a month'} features={cards.enterprise} cta="Join waitlist" soon />
      </div>
      <p className="pricing-disclosure">Free and Pro are for one person. Team is a shared workspace for 2 to 20 seats. Enterprise is one company workspace with 1,000 AI questions and integrations a month. Team and Enterprise are priced, and coming soon. Private code is filtered locally before approved context is sent.</p>
    </div>
  );
}

function PlanCard({ plan, interval, name, eyebrow, price, detail, savings, features, cta, featured = false, soon = false }: { plan: PlanId; interval: Interval; name: string; eyebrow: string; price: string; detail: string; savings?: string; features: string[]; cta: string; featured?: boolean; soon?: boolean }) {
  return (
    <article className={`marketing-plan-card${featured ? ' featured' : ''}${soon ? ' is-soon' : ''}`}>
      <span className="plan-badge">{soon ? 'Coming soon' : eyebrow}</span>
      <h3>{name}</h3>
      {soon ? <p className="plan-kicker">{eyebrow}</p> : null}
      <strong className="marketing-plan-price">{price}</strong>
      <small>{detail}</small>
      {savings ? <b className="savings-badge">{savings}</b> : null}
      <ul>{features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
      <Button href="/#waitlist" size="lg" className="pricing-button" onClick={() => track('plan_cta_clicked', { plan, interval, soon })}>{cta}</Button>
    </article>
  );
}
