import { currentUserId } from '@/lib/session';
import { getStore } from '@/data/store';
import { SignInNotice } from '@/components/SignInNotice';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const userId = await currentUserId();

  return (
    <>
      <h1>Home</h1>
      <p className="subtitle">Your code understanding at a glance.</p>
      {userId ? <HomeStats userId={userId} /> : <SignInNotice />}
    </>
  );
}

async function HomeStats({ userId }: { userId: string }) {
  const p = await getStore().profile(userId);
  const tiles: Array<[string, number | string]> = [
    ['Reviews', p.totalReviews],
    ['Understood', p.understood],
    ['Needs review', p.needsReview],
    ['Concepts', p.conceptsUnderstood],
    ['Streak', `${p.currentStreakDays}d`],
  ];
  if (p.totalReviews === 0) {
    return (
      <div className="empty">
        <p className="empty__title">No reviews yet</p>
        <p>Review some AI-written code in your editor and it will show up here.</p>
      </div>
    );
  }
  return (
    <div className="grid">
      {tiles.map(([label, value]) => (
        <div className="tile" key={label}>
          <div className="tile__value">{value}</div>
          <div className="tile__label">{label}</div>
        </div>
      ))}
    </div>
  );
}
