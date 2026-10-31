import { isProPlan } from '../../core/plan';
import { deviceName } from '../shared/platform';

/**
 * The Briefs page's two AI buttons (Understand Change, Explain the change) run Pro reviews; the
 * brief itself is built from local git and stays free (unvibe.site/pricing). Free and trial plans
 * see "· Pro" on those buttons. While the plan is still loading (null), no label is guessed.
 */
export function briefsAiLabel(label: string, plan: string | null): string {
  return plan !== null && !isProPlan(plan) ? `${label} · Pro` : label;
}

/**
 * Shown on Briefs when a Free or trial user presses an AI button (main returns `proRequired`).
 * Its one button opens Plan, which owns checkout; while sales are closed it says "Pro opens soon".
 */
export function BriefsProCard({ proOpen, onPlan }: { proOpen: boolean; onPlan: () => void }) {
  return (
    <section className="briefings__empty" role="status">
      <h2>Explaining a change is part of Pro</h2>
      <p>
        The brief stays free and is built on this {deviceName}. Understand Change and Explain the change send the
        git diff to AI for a full explanation, and come with Unvibe Pro.
      </p>
      <button type="button" className="primary-btn" onClick={onPlan}>{proOpen ? 'Buy a subscription' : 'Pro opens soon'}</button>
    </section>
  );
}
