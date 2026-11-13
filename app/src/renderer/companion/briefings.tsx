import { useEffect, useState, type ReactNode } from 'react';
import type { ChangeBrief, BriefScope } from '../../core/changeBrief';
import type { KnowledgeObject } from '../../core/knowledge';
import { buildAgentReview, type AgentReview } from '../../core/agentReview';
import { Buddy, setBuddyMood } from '../shared/buddy';
import { deviceName } from '../shared/platform';
import { CONSENT_PROVIDERS } from '../../core/consent';
import { BriefsProCard, briefsAiLabel } from './briefsPro';
import { renderSummary } from '../shared/richText';
import { InkTitle } from './inkTitle';

const SCOPES: Array<{ id: BriefScope; label: string }> = [
  { id: 'working', label: 'Working tree' },
  { id: 'staged', label: 'Staged' },
  { id: 'latest', label: 'Latest commit' },
  { id: 'branch', label: 'Branch vs base' },
];

/** Saved knowledge's status line in sentence case (Mono: no capital-letter labels). */
const VERIFIED_LABEL: Record<KnowledgeObject['verificationStatus'], string> = { AI_GENERATED: 'AI generated', HUMAN_CONFIRMED: 'Human confirmed', HUMAN_CORRECTED: 'Human corrected' };
const FRESHNESS_LABEL: Record<KnowledgeObject['freshnessStatus'], string> = { CURRENT: 'current', MAY_BE_STALE: 'may be stale', STALE: 'stale' };

/** `plan` is the account's plan once usage has loaded (null before); `onPlan` opens Plan & usage. */
export function Briefings({ plan, onPlan }: { plan: string | null; onPlan: () => void }) {
  const [scope, setScope] = useState<BriefScope>('working');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [branch, setBranch] = useState('');
  const [repoLabel, setRepoLabel] = useState('');
  const [brief, setBrief] = useState<ChangeBrief | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeObject[]>([]);
  const [needsRepo, setNeedsRepo] = useState(false);
  const [openFile, setOpenFile] = useState<string | null>(null);
  /** Which AI button a Free user pressed, so the Pro card shows right under it (QA P2: a line at the top went unseen). */
  const [needsPro, setNeedsPro] = useState<'review' | 'brief' | null>(null);
  const [proOpen, setProOpen] = useState(false);

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
        repoLabel?: string;
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
      setRepoLabel(result.repoLabel ?? '');
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

  useEffect(() => {
    void window.unvibe.billingStatus().then((status) => setProOpen(status.paymentsOpen)).catch(() => setProOpen(false));
  }, []);

  const understand = async (from: 'review' | 'brief') => {
    setBusy(true);
    setNeedsPro(null);
    try {
      const result = await window.unvibe.explainDiff({ brief: true, scope }) as { ok?: boolean; cancelled?: boolean; error?: string; proRequired?: boolean };
      if (result?.proRequired) setNeedsPro(from);
      else if (!result?.ok && !result?.cancelled) setError(result?.error ?? 'Could not start that review.');
    } catch {
      setError('Unvibe could not complete this request. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mbr">
      <section className="m-box mbr-toolbar">
        <div className="mbr-toolbar__text">
          <h1 className="mono-title"><InkTitle text="Brief" /></h1>
          <p className="mono-lead">A clear recap of what changed in your project. Available offline from local git.</p>
        </div>
        <div className="mbr-toolbar__tools">
          <div className="m-seg" role="tablist" aria-label="Git scope">
            {SCOPES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                disabled={busy}
                aria-selected={scope === item.id}
                className={`m-seg__item${scope === item.id ? ' is-on' : ''}`}
                onClick={() => setScope(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {needsRepo && !busy ? null : (
            <>
              <button type="button" className="m-btn m-btn--outlined m-btn--small" disabled={busy} onClick={() => void build(true)}>Choose repo</button>
              <button type="button" className="m-btn m-btn--outlined m-btn--small" disabled={busy} onClick={() => void build(false)}>{busy ? 'Reading…' : 'Refresh'}</button>
            </>
          )}
        </div>
      </section>

      {error ? <div className="m-box mbr-status" role="alert">{error}</div> : null}
      {busy && <p className="m-box mbr-status" role="status">Reading your project…</p>}
      {needsRepo && !busy && (
        <section className="m-box mbr-empty">
          <Buddy mood="sleepy" size={48} />
          <h2>Your next change, made clear.</h2>
          <p>Choose a local git project to see its recent changes. Reading a brief stays on this {deviceName}. Explain the change and Understand the brief send that git diff to {CONSENT_PROVIDERS.unvibe} (or your own key's provider), after you agree.</p>
          <button type="button" className="m-btn m-btn--filled" onClick={() => void build(true)}>Choose a project</button>
        </section>
      )}

      {brief && !brief.empty ? (
        <AgentReviewCard
          review={buildAgentReview(brief, knowledge)}
          repo={brief.repo}
          files={brief.filesChanged}
          insertions={brief.insertions}
          deletions={brief.deletions}
          busy={busy}
          explainLabel={briefsAiLabel('Explain the change', plan)}
          onExplain={() => void understand('review')}
          proCard={needsPro === 'review' ? <BriefsProCard proOpen={proOpen} onPlan={onPlan} /> : null}
          onRefreshKnowledge={(id) => void window.unvibe.refreshKnowledge(id).then(() => loadKnowledge())}
        />
      ) : null}

      {brief && !brief.empty ? (
        <>
          <div className="m-grid m-grid--half">
            <section className="m-box m-box--flush">
              <header className="m-box__title"><h2>Main changes</h2></header>
              <ul className="m-box__body mbr-list">
                {brief.mainChanges.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </section>
            <section className="m-box m-box--flush">
              <header className="m-box__title"><h2>Things to understand before committing</h2></header>
              <ol className="m-box__body mbr-list">
                {brief.understandBeforeCommit.map((line) => <li key={line}>{line}</li>)}
              </ol>
            </section>
          </div>
          <section className="m-box m-box--flush">
            <header className="m-box__title">
              <h2>Files</h2>
              <span className="m-box__meta mbr-meta">
                {repoLabel ? <span>{repoLabel}</span> : null}
                {branch ? <span>{branch}</span> : null}
                <span>Architecture impact {brief.architectureImpact.toLowerCase()}</span>
              </span>
            </header>
            <ul className="mbr-files">
              {brief.files.map((file) => (
                <li key={file.path} className="m-row mbr-file">
                  <button type="button" className="mbr-file__open" aria-expanded={openFile === file.path} onClick={() => setOpenFile(openFile === file.path ? null : file.path)}>
                    <code>{file.path}</code>
                    <span className="mbr-delta">+{file.insertions} / -{file.deletions}</span>
                  </button>
                  {openFile === file.path ? <p className="mbr-file__kind">Kind: {file.kind}. Explain the change to read the actual diff.</p> : null}
                </li>
              ))}
            </ul>
            <div className="m-box__body mbr-files__foot">
              <p className="mbr-note">{brief.provenanceNote}</p>
              <button type="button" className="m-btn m-btn--outlined" disabled={busy} onClick={() => void understand('brief')}>{briefsAiLabel('Understand the brief', plan)}</button>
            </div>
            {needsPro === 'brief' ? <div className="m-box__body"><BriefsProCard proOpen={proOpen} onPlan={onPlan} /></div> : null}
          </section>
        </>
      ) : !error && !needsRepo && !busy ? (
        <section className="m-box mbr-empty mbr-empty--quiet">
          <Buddy mood="sleepy" size={40} />
          <p>No documented changes in this git scope.</p>
        </section>
      ) : null}

      <section className="m-box m-box--flush">
        <header className="m-box__title"><h2>Saved knowledge</h2><span className="m-box__meta">On this {deviceName}</span></header>
        <p className="m-box__body mbr-note">AI-generated notes stay labelled until you confirm them. Freshness follows code change, not calendar time.</p>
        {knowledge.length === 0 ? (
          <p className="m-box__body mbr-note mbr-note--last">No saved knowledge yet. Finish an explanation to save the first note.</p>
        ) : (
          <ul className="mbr-knowlist">
            {knowledge.slice(0, 20).map((item) => (
              <li key={item.id} className="m-row mbr-know">
                <div className="m-row__main">
                  <strong className="m-row__title">{item.title}</strong>
                  <p className="mbr-know__summary">{renderSummary(item.summary)}</p>
                  <span className="m-row__meta">
                    {VERIFIED_LABEL[item.verificationStatus]} · {FRESHNESS_LABEL[item.freshnessStatus]} ·{' '}
                    <time dateTime={item.updatedAt}>
                      {new Date(item.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </time>
                  </span>
                </div>
                <div className="m-row__end mbr-know__acts">
                  {item.freshnessStatus !== 'CURRENT' ? (
                    <button type="button" className="m-btn m-btn--outlined m-btn--small" onClick={() => void window.unvibe.refreshKnowledge(item.id).then(() => loadKnowledge())}>Refresh</button>
                  ) : null}
                  {item.verificationStatus === 'AI_GENERATED' ? (
                    <button type="button" className="m-btn m-btn--outlined m-btn--small" onClick={() => void window.unvibe.verifyKnowledge({ id: item.id, status: 'HUMAN_CONFIRMED' }).then(() => loadKnowledge())}>Confirm</button>
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

const SIZE_LABEL: Record<AgentReview['size'], string> = { small: 'Small change', medium: 'Medium change', large: 'Big change' };

/**
 * After-Agent Review in Mono's rows: the headline with Vibe beside two number tiles; Review first beside What
 * matters; Areas touched beside Knowledge that may be stale.
 */
function AgentReviewCard({ review, repo, files, insertions, deletions, busy, explainLabel, onExplain, proCard, onRefreshKnowledge }: {
  review: AgentReview;
  repo: string;
  files: number;
  insertions: number;
  deletions: number;
  busy: boolean;
  explainLabel: string;
  onExplain: () => void;
  proCard: ReactNode;
  onRefreshKnowledge: (id: string) => void;
}) {
  const storageKey = `unvibe.agentReview.${repo}.${review.headline}`;
  const [checked, setChecked] = useState<number[]>(() => {
    try { return JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as number[]; } catch { return []; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(storageKey, JSON.stringify(checked)); } catch { /* storage blocked */ }
  }, [checked, storageKey]);
  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];
      if (next.length === review.reviewFirst.length && review.reviewFirst.length > 0) setBuddyMood('celebrate');
      return next;
    });
  };
  const done = review.reviewFirst.length > 0 && checked.length >= review.reviewFirst.length;
  const reviewed = `${checked.length} of ${review.reviewFirst.length}`;
  const areas = (
    <section className="m-box mbr-areas">
      <h2 className="mbr-areas__title">Areas touched</h2>
      <div className="mbr-chips">
        {review.areas.map((area) => (
          <span key={area.name} className={`m-chip${area.sensitive ? ' m-chip--outlined' : ''}`}>{area.name}<span className="mbr-chips__n">{area.files}</span></span>
        ))}
      </div>
      <p className="mbr-note">Built from local git on this computer. Unvibe ranks the real diff; it does not guess why the agent made each edit.</p>
    </section>
  );
  return (
    <>
      <div className="m-grid m-grid--23">
        <article className="m-box mbr-head" aria-label="After-agent review">
          <div className="mbr-head__row">
            <Buddy mood={done ? 'happy' : 'idle'} size={56} label="Vibe" />
            <div className="mbr-head__text">
              <p className="mbr-head__eyebrow">After-agent review</p>
              <h2 className="mbr-head__title">{review.headline}</h2>
              <p className="mbr-head__sub">{SIZE_LABEL[review.size]}{repo ? ` in ${repo.split(/[\\/]/).filter(Boolean).pop()}` : ''}. Here is what deserves your eyes first.</p>
            </div>
            <button type="button" className="m-btn m-btn--filled" disabled={busy} onClick={onExplain}>{explainLabel}</button>
          </div>
          {proCard}
        </article>
        <div className="m-grid m-grid--half">
          <div className="m-box m-tile">
            <span className="m-tile__num">{files}</span>
            <span className="m-tile__label">Files changed</span>
            <span className="m-tile__note">+{insertions} / -{deletions} lines</span>
          </div>
          <div className="m-box m-tile">
            <span className="m-tile__num">{reviewed}</span>
            <span className="m-tile__label">Reviewed</span>
            <span className="m-tile__note">in Review first</span>
          </div>
        </div>
      </div>
      <div className="m-grid m-grid--half">
        <section className="m-box m-box--flush">
          <header className="m-box__title"><h2>Review first</h2><span className="m-box__meta">{reviewed}</span></header>
          <ol className="m-box__body mbr-checks">
            {review.reviewFirst.map((line, index) => (
              <li key={line}>
                <label className={checked.includes(index) ? 'is-done' : ''}>
                  <input type="checkbox" checked={checked.includes(index)} onChange={() => toggle(index)} />
                  <span>{line}</span>
                </label>
              </li>
            ))}
          </ol>
          {done ? <p className="m-box__body mbr-note mbr-checks__done">All reviewed. Nice, you actually know what shipped.</p> : null}
        </section>
        <section className="m-box m-box--flush">
          <header className="m-box__title"><h2>What matters</h2><span className="m-box__meta">{review.whatMatters.length === 1 ? '1 file' : `${review.whatMatters.length} files`}</span></header>
          <ul className="mbr-matters">
            {review.whatMatters.map((file) => (
              <li key={file.path} className="mbr-matter" data-kind={file.kind}>
                <code>{file.path}</code>
                <span className="mbr-delta">+{file.insertions} / -{file.deletions}</span>
                <small>{file.reason}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {review.staleKnowledge.length ? (
        <div className="m-grid m-grid--32">
          {areas}
          <section className="m-box m-box--flush">
            <header className="m-box__title"><h2>Knowledge that may be stale</h2><span className="m-box__meta">{review.staleKnowledge.length}</span></header>
            <ul className="mbr-stale">
              {review.staleKnowledge.map((hit) => (
                <li key={hit.id} className="m-row">
                  <span className="m-row__main"><strong className="m-row__title">{hit.title}</strong><span className="m-row__meta">{hit.file}</span></span>
                  <span className="m-row__end"><button type="button" className="m-btn m-btn--outlined m-btn--small" onClick={() => onRefreshKnowledge(hit.id)}>Refresh</button></span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : areas}
    </>
  );
}
