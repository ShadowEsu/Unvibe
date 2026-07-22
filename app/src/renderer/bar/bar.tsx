import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';

type Snapshot = {
  shortcut: string;
  recent: { id: string; title: string; detail: string; level: string } | null;
  streak: number;
  explanations: number;
  understood: number;
  needsReview: number;
  linesUnderstood: number;
  conceptsSeen: number;
  conceptsStrong: number;
  usage: { label: string; pct: number } | null;
  heat: number[];
};

function PlayIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.2 5.4c-.7-.4-1.5.1-1.5.9v11.4c0 .8.8 1.3 1.5.9l9.8-5.7c.7-.4.7-1.4 0-1.8L8.2 5.4z" /></svg>;
}

function HomeIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 11.2 12 4.8l7.5 6.4" /><path d="M7.2 10.2V19h9.6v-8.8" /></svg>;
}

function prettyShortcut(value = 'CommandOrControl+U'): string {
  return value.replace('CommandOrControl+', '⌘').replace('Shift+', '⇧').replace('Alt+', '⌥');
}

/**
 * The learning strip is intentionally not a Dynamic Island clone. It is a small, persistent
 * Unvibe status surface that expands into recent learning and honest local-privacy context.
 */
function Bar() {
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const [hoverDelayMs, setHoverDelayMs] = useState(220);
  const [attached, setAttached] = useState(true);
  const [confirmation, setConfirmation] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const expandedRef = useRef(false);
  const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = () => {
    setLoading(true);
    void window.unvibe.barSnapshot().then((value) => setSnapshot(value as Snapshot)).finally(() => setLoading(false));
  };
  useEffect(() => {
    refresh();
    void window.unvibe.getSettings().then((value) => {
      const settings = value as { barHoverPreview?: boolean; barHoverDelayMs?: number; barPosition?: string };
      const enabled = Boolean(settings.barHoverPreview ?? true);
      setHoverEnabled(enabled);
      setHoverDelayMs(Math.min(600, Math.max(120, settings.barHoverDelayMs ?? 220)));
      setAttached(settings.barPosition === 'top-center');
    });
    const unsubscribe = window.unvibe.onBarNotify((msg) => {
      setNote(msg);
      refresh();
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setNote(''), 4000);
    });
    const unsubscribeCollapse = window.unvibe.onBarCollapse(() => setPanelExpanded(false));
    const unsubscribeSettings = window.unvibe.onBarSettings((settings) => {
      if (settings.barPosition) setAttached(settings.barPosition === 'top-center');
      if (settings.barHoverPreview !== undefined) setHoverEnabled(settings.barHoverPreview);
      if (settings.barHoverDelayMs !== undefined) setHoverDelayMs(settings.barHoverDelayMs);
    });
    return () => {
      unsubscribe();
      unsubscribeCollapse();
      unsubscribeSettings();
      if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, []);

  const setPanelExpanded = (next: boolean) => {
    // A native transparent window resize is comparatively expensive. Only ask
    // Electron to resize when the intended state really changed.
    if (expandedRef.current === next) return;
    expandedRef.current = next;
    setExpanded(next);
    window.unvibe.setBarExpanded(next);
    if (next) refresh();
  };
  const open = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setPanelExpanded(true);
  };
  const openFromHover = () => {
    if (!hoverEnabled || expandedRef.current) return;
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    hoverOpenTimer.current = setTimeout(open, hoverDelayMs);
  };
  const scheduleClose = () => {
    if (!hoverEnabled) return;
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => {
      setPanelExpanded(false);
    }, 520);
  };

  const act = (action: 'review' | 'home') => {
    const message = action === 'review' ? 'Selection capture started' : 'Opening your learning space';
    setConfirmation(message);
    window.setTimeout(() => setConfirmation(''), 1100);
    if (action === 'review') window.unvibe.reviewSelection();
    else window.unvibe.openCompanion();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      setPanelExpanded(false);
    }
    if (event.key === 'Enter' && !expanded) {
      event.preventDefault();
      open();
    }
  };

  return (
    <div className={`strip${attached ? ' strip--attached' : ''}${expanded ? ' strip--expanded' : ''}${note ? ' strip--note' : ''}`} tabIndex={0} onKeyDown={onKeyDown} onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) setPanelExpanded(!expandedRef.current); }} onContextMenu={(event) => { event.preventDefault(); window.unvibe.barContextMenu({ hasRecent: Boolean(snapshot?.recent) }); }} onMouseEnter={openFromHover} onMouseLeave={scheduleClose}>
      <div className="strip__main" title={note || 'Unvibe is ready'}>
        <button className="chip chip--play" aria-label="Explain selected code" title="Explain selected code" onClick={() => act('review')}><PlayIcon /></button>
        <span className="mark" aria-hidden="true"><LogoMark size={15} stroke={2.1} /></span>
        <span className="strip__status" aria-live="polite">{confirmation || note || 'Ready to understand'}</span>
        <span className="strip__privacy"><i />local scan</span>
        <button className="chip chip--home" aria-label="Open Unvibe" title="Open Unvibe" onClick={() => act('home')}><HomeIcon /></button>
      </div>
      {expanded && (
        <div className="strip__drawer">
          <div className="strip__drawer-head">
            <div><span className="pixel-label">LEARNING PULSE</span><strong>Your understanding, right now.</strong></div>
            {loading ? <div className="pixel-loader" aria-label="Refreshing learning stats">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div> : <span className="strip__live"><i />local data</span>}
          </div>
          <div className="strip__metric-grid" aria-label="Actual learning statistics">
            <article><b>{snapshot?.streak ?? 0}</b><span>day streak</span></article>
            <article><b>{snapshot?.understood ?? 0}</b><span>understood</span></article>
            <article><b>{snapshot?.linesUnderstood ?? 0}</b><span>lines learned</span></article>
            <article><b>{snapshot?.needsReview ?? 0}</b><span>to revisit</span></article>
          </div>
          <div className="strip__learning-row">
            <div className="strip__recent"><span className="pixel-label">LAST LEARNING</span><strong>{snapshot?.recent?.title ?? 'No explanations yet'}</strong><small>{snapshot?.recent?.detail ?? 'Select code and start your first explanation.'}</small></div>
            <div className="strip__concepts"><span><b>{snapshot?.conceptsSeen ?? 0}</b> concepts</span><span><b>{snapshot?.conceptsStrong ?? 0}</b> strong</span><small>{snapshot?.usage ? `${snapshot.usage.label} · ${snapshot.usage.pct}%` : 'No workflow data yet'}</small></div>
          </div>
          <div className="strip__heat" aria-label="Learning activity over the last 14 days"><span>14 DAYS</span><div>{(snapshot?.heat ?? Array(14).fill(0)).map((value, index) => <i key={index} data-level={value} />)}</div></div>
          <div className="strip__actions">
            <button onClick={() => act('review')}>{confirmation === 'Selection capture started' ? '✓ Capturing selection' : <>Understand code <kbd>{prettyShortcut(snapshot?.shortcut)}</kbd></>}</button>
            <button onClick={() => act('home')}>{confirmation === 'Opening your learning space' ? '✓ Opening Unvibe' : 'Open learning history →'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Bar />);
