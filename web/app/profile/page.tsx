import { currentUserId } from '@/lib/session';
import { getStore } from '@/data/store';
import { SignInNotice } from '@/components/SignInNotice';
import { PLANS } from '@/billing/plans';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const userId = await currentUserId();
  if (!userId) {
    return (
      <>
        <h1>Profile</h1>
        <p className="subtitle">Your learning over time.</p>
        <SignInNotice />
      </>
    );
  }

  const p = await getStore().profile(userId);
  const usage = await getStore().usage(userId);
  const rows: Array<[string, string | number]> = [
    ['Total reviews', p.totalReviews],
    ['Understood', p.understood],
    ['Needs review', p.needsReview],
    ['Concepts seen', p.conceptsSeen],
    ['Concepts understood', p.conceptsUnderstood],
    ['Concepts to review', p.conceptsNeedReview],
    ['Current streak', `${p.currentStreakDays} day${p.currentStreakDays === 1 ? '' : 's'}`],
    ['Last active', p.lastActive ? new Date(p.lastActive).toLocaleString() : '—'],
  ];

  return (
    <>
      <h1>Profile</h1>
      <p className="subtitle">Your learning over time.</p>
      <section className="usage-card" aria-labelledby="usage-heading">
        <div>
          <p className="usage-card__eyebrow">Plan</p>
          <h2 id="usage-heading">{PLANS[usage.planId].name}</h2>
          <p className="usage-card__copy">
            {usage.limit === null
              ? 'Custom explanation allowance. Learning and teaching stay free.'
              : `${usage.remaining} of ${usage.limit} AI explanations remain this month.`}
          </p>
        </div>
        <p className="usage-card__note">
          Explanations are metered. Saved learning, progress, and comprehension checks are free.
        </p>
      </section>
      <div className="list">
        {rows.map(([label, value]) => (
          <div className="row" key={label}>
            <div className="row__main">{label}</div>
            <div className="row__meta">{value}</div>
          </div>
        ))}
      </div>
    </>
  );
}
