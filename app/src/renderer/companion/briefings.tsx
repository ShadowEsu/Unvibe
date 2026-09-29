import { useEffect, useState } from 'react';
import type { ChangeBrief, BriefScope } from '../../core/changeBrief';
import type { KnowledgeObject } from '../../core/knowledge';

const SCOPES: Array<{ id: BriefScope; label: string }> = [
  { id: 'working', label: 'Working tree' },
  { id: 'staged', label: 'Staged' },
  { id: 'latest', label: 'Latest commit' },
  { id: 'branch', label: 'Branch vs base' },
];

export function Briefings() {
  const [scope, setScope] = useState<BriefScope>('working');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [branch, setBranch] = useState('');
  const [brief, setBrief] = useState<ChangeBrief | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeObject[]>([]);
  const [needsRepo, setNeedsRepo] = useState(false);
  const [openFile, setOpenFile] = useState<string | null>(null);

  const loadKnowledge = async () => {
    try {
      const result = await window.unvibe.listKnowledge() as { ok?: boolean; items?: KnowledgeObject[] };
      if (result?.ok) setKnowledge(result.items ?? []);
    } catch { setError('Saved knowledge could not be loaded. Try refreshing.'); }
  };

  const build = async (pick = false) => {
    setBusy(true);
    setError('');
    try {
      const result = await window.unvibe.buildChangeBrief({ scope, pick }) as {
        ok?: boolean;
        cancelled?: boolean;
        needsRepo?: boolean;
        error?: string;
        brief?: ChangeBrief;
        branch?: string;
        detached?: boolean;
      };
      if (result?.cancelled) return;
      setNeedsRepo(Boolean(result?.needsRepo));
      if (result?.needsRepo) { setBrief(null); return; }
      if (!result?.ok || !result.brief) {
        setError(result?.error ?? 'Unvibe could not read git changes.');
        setBrief(null);
        return;
      }
      setBrief(result.brief);
      setBranch(result.detached ? 'detached HEAD' : (result.branch ?? ''));
    } catch {
      setError('Unvibe could not complete this request. Try again.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadKnowledge();
    void build(false);
  }, [scope]);

  const understand = async () => {
    setBusy(true);
    try {
      const result = await window.unvibe.explainDiff({ brief: true, scope }) as { ok?: boolean; cancelled?: boolean; error?: string };
      if (!result?.ok && !result?.cancelled) setError(result?.error ?? 'Could not start that review.');
    } catch {
      setError('Unvibe could not complete this request. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="briefings">
      <div className="briefings__head">
        <div>
          <div className="kicker">Change Brief</div>
          <h1>Briefings</h1>
          <p>A clear recap of what changed in your project. Available offline from local git.</p>
        </div>
        <div className="briefings__actions">
          <button type="button" className="btn ghost" disabled={busy} onClick={() => void build(true)}>Choose repo</button>
          <button type="button" className="btn" disabled={busy} onClick={() => void build(false)}>{busy ? 'Reading…' : 'Refresh'}</button>
        </div>
      </div>

      <div className="briefings__scopes" role="tablist" aria-label="Git scope">
        {SCOPES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            disabled={busy}
            aria-selected={scope === item.id}
            className={scope === item.id ? 'on' : ''}
            onClick={() => setScope(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? <div className="briefings__empty" role="alert">{error}</div> : null}
      {busy && <p role="status">Reading your project…</p>}
      {needsRepo && !busy && (
        <section className="briefings__empty">
          <h2>Your next change, made clear.</h2>
          <p>Choose a local git project to see its recent changes. Reading a brief stays on this Mac; AI explanations ask for your consent separately.</p>
          <button className="btn" onClick={() => void build(true)}>Choose a project</button>
        </section>
      )}

      {brief && !brief.empty ? (
        <article className="briefings__card">
          <div className="briefings__meta">
            {brief.repo ? <span>{brief.repo}</span> : null}
            {branch ? <span>{branch}</span> : null}
            <strong>{brief.filesChanged} files changed</strong>
            <span>+{brief.insertions} / -{brief.deletions}</span>
            <span className="impact" data-level={brief.architectureImpact}>Architecture impact {brief.architectureImpact.toLowerCase()}</span>
          </div>
          <h2>Main changes</h2>
          <ul>
            {brief.mainChanges.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <h2>Things to understand before committing</h2>
          <ol>
            {brief.understandBeforeCommit.map((line) => <li key={line}>{line}</li>)}
          </ol>
          <p className="briefings__note">{brief.provenanceNote}</p>
          <button type="button" className="primary-btn" disabled={busy} onClick={() => void understand()}>Understand Change</button>
          <h2>Files</h2>
          <ul className="briefings__files">
            {brief.files.map((file) => (
              <li key={file.path}>
                <button type="button" className="briefings__file" onClick={() => setOpenFile(openFile === file.path ? null : file.path)}>
                  <span>{file.path}</span>
                  <span>+{file.insertions} / -{file.deletions}</span>
                </button>
                {openFile === file.path ? (
                  <p>Kind: {file.kind}. Open a Change Brief review to read the actual diff.</p>
                ) : null}
              </li>
            ))}
          </ul>
        </article>
      ) : !error && !needsRepo && !busy ? (
        <div className="briefings__empty">No documented changes in this git scope.</div>
      ) : null}

      <section className="briefings__knowledge">
        <div className="briefings__head">
          <div>
            <div className="kicker">Saved knowledge</div>
            <h2>On this Mac</h2>
            <p>AI-generated notes stay labelled until you confirm them. Freshness follows code change, not calendar time.</p>
          </div>
        </div>
        {knowledge.length === 0 ? (
          <div className="briefings__empty">No saved knowledge yet. Finish an explanation to create the first object.</div>
        ) : (
          <ul className="briefings__knowlist">
            {knowledge.slice(0, 20).map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.summary}</p>
                  <span>
                    {item.verificationStatus.replaceAll('_', ' ')} · {item.freshnessStatus.replaceAll('_', ' ')} ·{' '}
                    <time dateTime={item.updatedAt}>
                      {new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </time>
                  </span>
                </div>
                <div className="briefings__knowacts">
                  {item.freshnessStatus !== 'CURRENT' ? (
                    <button type="button" className="btn ghost" onClick={() => void window.unvibe.refreshKnowledge(item.id).then(() => loadKnowledge())}>Refresh</button>
                  ) : null}
                  {item.verificationStatus === 'AI_GENERATED' ? (
                    <button type="button" className="btn ghost" onClick={() => void window.unvibe.verifyKnowledge({ id: item.id, status: 'HUMAN_CONFIRMED' }).then(() => loadKnowledge())}>Confirm</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
