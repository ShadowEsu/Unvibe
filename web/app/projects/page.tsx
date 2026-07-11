import { currentUserId } from '@/lib/session';
import { getStore } from '@/data/store';
import { SignInNotice } from '@/components/SignInNotice';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const userId = await currentUserId();
  if (!userId) {
    return (
      <>
        <h1>Projects</h1>
        <p className="subtitle">Repositories you have reviewed.</p>
        <SignInNotice />
      </>
    );
  }

  const projects = await getStore().projects(userId);
  return (
    <>
      <h1>Projects</h1>
      <p className="subtitle">Repositories you have reviewed.</p>
      {projects.length === 0 ? (
        <div className="empty">
          <p className="empty__title">No projects yet</p>
          <p>Review code in a project and it will be tracked here.</p>
        </div>
      ) : (
        <div className="list">
          {projects.map((p) => (
            <div className="row" key={p.name}>
              <div className="row__main">{p.name}</div>
              <div className="row__meta">
                {p.reviews} review{p.reviews === 1 ? '' : 's'} · {new Date(p.lastActive).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
