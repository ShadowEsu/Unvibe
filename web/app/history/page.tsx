import { currentUserId } from '@/lib/session';
import { getStore } from '@/data/store';
import { SignInNotice } from '@/components/SignInNotice';

export const dynamic = 'force-dynamic';

const OUTCOME_LABEL: Record<string, string> = {
  reviewed: 'Reviewed',
  understood: 'Understood',
  needs_review: 'Needs review',
};

export default async function HistoryPage() {
  const userId = await currentUserId();
  if (!userId) {
    return (
      <>
        <h1>History</h1>
        <p className="subtitle">Every review you have done.</p>
        <SignInNotice />
      </>
    );
  }

  const events = await getStore().history(userId, 200);
  return (
    <>
      <h1>History</h1>
      <p className="subtitle">Every review you have done.</p>
      {events.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Nothing here yet</p>
          <p>Your reviews will appear here once you start reviewing code.</p>
        </div>
      ) : (
        <div className="list">
          {events.map((e) => (
            <div className="row" key={e.id}>
              <div>
                <div className="row__main">{e.file ?? `${e.scope} review`}</div>
                <div className="row__meta">
                  {e.scope} · {e.level} · {new Date(e.ts).toLocaleString()}
                </div>
              </div>
              <span className="badge">{OUTCOME_LABEL[e.outcome] ?? e.outcome}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
