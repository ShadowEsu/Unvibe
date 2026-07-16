import { currentUserId } from '@/lib/session';
import { getStore } from '@/data/store';
import { SignInNotice } from '@/components/SignInNotice';

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
  const rows: Array<[string, string | number]> = [
    ['Total reviews', p.totalReviews],
    ['Understood', p.understood],
    ['Needs review', p.needsReview],
    ['Concepts seen', p.conceptsSeen],
    ['Concepts with passed checks', p.conceptsUnderstood],
    ['Concepts to review', p.conceptsNeedReview],
    ['Current streak', `${p.currentStreakDays} day${p.currentStreakDays === 1 ? '' : 's'}`],
    ['Last active', p.lastActive ? new Date(p.lastActive).toLocaleString() : '—'],
  ];

  return (
    <>
      <h1>Profile</h1>
      <p className="subtitle">Your learning over time.</p>
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
