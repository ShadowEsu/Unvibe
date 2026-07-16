'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/Button';
import { track } from '@/lib/analytics';

type Interval = 'monthly' | 'annual';

const cards = {
  free: ['Core code explanations', 'One active project', 'Basic project summaries', '30 AI explanations each month', 'No credit card required'],
  pro: ['More AI usage', 'Up to 10 repositories', 'Cross-file explanations', 'Persistent project memory', 'Larger project support', 'Personal learning history'],
  teams: ['Everything in Pro', 'Shared workspaces', 'Separate member accounts', 'Shared repositories and knowledge', 'Centralized billing', 'Roles and permissions'],
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
        <button className={!annual ? 'active' : ''} onClick={() => chooseInterval('monthly')} aria-pressed={!annual}>Monthly</button>
        <button className={annual ? 'active' : ''} onClick={() => chooseInterval('annual')} aria-pressed={annual}>Annual</button>
      </div>
      <div className="marketing-plan-grid">
        <PlanCard plan="free" interval={interval} name="Free" eyebrow="Learn how your code works." price="$0" detail="No card required" features={cards.free} cta="Start for free" />
        <PlanCard plan="pro" interval={interval} name="Pro" eyebrow="Best for individuals" price={annual ? '$96/year' : '$8/month'} detail={annual ? 'Equivalent to $8/month · billed once yearly' : 'For one personal account · billed monthly'} features={cards.pro} cta="Upgrade to Pro" featured />
        <PlanCard plan="teams" interval={interval} name="Teams" eyebrow="For 2+ members" price={annual ? '$6/member/month' : '$8/member/month'} detail={annual ? 'Billed annually · $72/member/year · $144/year minimum' : '2-seat minimum · $16/month minimum'} savings={annual ? 'Save 25% with annual billing' : undefined} features={cards.teams} cta="Start a team" />
      </div>
      <p className="pricing-disclosure">Every team member uses a separate account. Private code is filtered locally before approved context is sent; no plan requires you to bring an AI API key.</p>
    </div>
  );
}

function PlanCard({ plan, interval, name, eyebrow, price, detail, savings, features, cta, featured = false }: { plan: 'free' | 'pro' | 'teams'; interval: Interval; name: string; eyebrow: string; price: string; detail: string; savings?: string; features: string[]; cta: string; featured?: boolean }) {
  return <article className={`marketing-plan-card${featured ? ' featured' : ''}`}>
    <span className="plan-badge">{eyebrow}</span><h3>{name}</h3><strong className="marketing-plan-price">{price}</strong><small>{detail}</small>{savings && <b className="savings-badge">{savings}</b>}
    <ul>{features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
    <Button href="#waitlist" size="lg" className="pricing-button" onClick={() => track('plan_cta_clicked', { plan, interval })}>{cta}</Button>
  </article>;
}
