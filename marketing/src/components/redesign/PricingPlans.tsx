'use client';

import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/Button';
import { track } from '@/lib/analytics';

const corePlans = [
  { id: 'free', name: 'Free', badge: 'Private beta', eyebrow: 'Understand the code in front of you.', price: '$0', detail: 'Limited monthly explanations. Included cloud models. No card or separate API key.', features: ['Selected-code explanations', 'Core explanation levels', 'Saved explanations and progress', 'On-device secret filtering'], cta: 'Get the beta', href: '/#install' },
  { id: 'pro', name: 'Pro', badge: 'Individual', eyebrow: 'Keep the context, not just the answer.', price: '$10/month', detail: 'One developer account, billed monthly. Annual is $90/year (25% off).', features: ['File, diff, and project context', 'Five explanation depths', 'Follow-up and Test me', 'Saved concepts, history, and study'], cta: 'Join the Pro waitlist', href: '/?utm_campaign=pro_pricing#waitlist', featured: true },
  { id: 'lifetime', name: 'Pro Lifetime', badge: 'One-time', eyebrow: 'Own the personal core.', price: '$80', detail: 'One-time. Local and core personal features forever. Checkout from the Unvibe app Plan page.', features: ['Personal understanding loop', 'Saved explanations and study', 'No monthly Pro bill', 'Does not include Teams GitHub intelligence'], cta: 'Get Lifetime in the app', href: '/#install' },
  { id: 'teams', name: 'Teams', badge: 'Founding pilot', eyebrow: 'Share a workspace and see who reviewed what.', price: '$8/seat/month', detail: 'Founding price. 2–20 seats. Shared activity with authorship in the app. Explanation text stays on each device. GitHub intelligence stays Pilot.', features: ['Shared workspace and invites', 'Who reviewed what (metadata)', '2–20 founding seats', 'GitHub intelligence still Pilot'], cta: 'Request Teams seats', href: 'mailto:preston@unvibe.site?subject=Unvibe%20Teams%20founding%20pilot&body=Company%20email%3A%20%0ASeats%20wanted%20(2%E2%80%9320)%3A%20%0A%0AWe%20want%20the%20Teams%20founding%20pilot%20(workspace%20%2B%20who%20reviewed%20what).' },
] as const;

export function PricingPlans() {
  const trackedView = useRef(false);
  useEffect(() => {
    if (!trackedView.current) {
      trackedView.current = true;
      track('pricing_viewed');
    }
  }, []);

  return (
    <div className="pricing-plans">
      <div className="pricing-plans__intro">
        <p className="paper-meta">Simple monthly pricing</p>
        <h2>Start personal. Add shared understanding when the team is ready.</h2>
        <p>
          Teams founding pilot includes a shared workspace and who-reviewed-what activity.
          GitHub-connected dashboards stay labeled Pilot — not current availability.
        </p>
      </div>
      <div className="marketing-plan-grid marketing-plan-grid--core">
        {corePlans.map((plan) => (
          <article key={plan.id} className={`marketing-plan-card${'featured' in plan && plan.featured ? ' featured' : ''}`}>
            <span className="plan-badge">{plan.badge}</span>
            <h3>{plan.name}</h3>
            <p className="plan-kicker">{plan.eyebrow}</p>
            <strong className="marketing-plan-price">{plan.price}</strong>
            <small>{plan.detail}</small>
            <ul>{plan.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
            <Button href={plan.href} size="lg" className="pricing-button" onClick={() => track('plan_cta_clicked', { plan: plan.id })}>{plan.cta}</Button>
          </article>
        ))}
      </div>
      <p className="pricing-disclosure">
        Prices are monthly in USD. “Pilot,” “Planned,” and “Later” are not claims of current availability.
        Full explanation text is not shared across seats.
      </p>
    </div>
  );
}
