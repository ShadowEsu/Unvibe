import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';
import { prettyShortcut } from '../shared/prettyShortcut';
import { playUiTone, type ToneKind } from '../shared/tones';
import { UsageRings } from '../shared/usageRings';
import '../shared/tokens.css';

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
  quota?: { used: number; limit: number; remaining: number };
  selections?: { used: number; limit: number; remaining: number };
  heat: number[];
};

type PulsePhase = 'idle' | 'working' | 'ready' | 'understood' | 'error';

function CodeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 9-3 3 3 3" /><path d="m16 9 3 3-3 3" /><path d="m14 5-4 14" /></svg>;
}

function HomeIcon() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 11.2 12 4.8l7.5 6.4" /><path d="M7.2 10.2V19h9.6v-8.8" /></svg>;
}

function Wave() {
  return (
    <span className="strip__wave" aria-hidden="true">
      <i /><i /><i /><i /><i />
    </span>
  );
}

function Bar() {
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<PulsePhase>('idle');
  const [pulseLabel, setPulseLabel] = useState('Ready');
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const [hoverDelayMs, setHoverDelayMs] = useState(220);
  const [attached, setAttached] = useState(true);
  const [position, setPosition] = useState('top-center');
  const [barSize, setBarSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.3);
  const [soundStyle, setSoundStyle] = useState<'soft' | 'pixel'>('soft');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const expandedRef = useRef(false);
  const pointerInside = useRef(false);
  const actionLockUntil = useRef(0);
  const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeAnimationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const understoodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchPlayed = useRef(false);
  const lastHoverTone = useRef(0);
  const soundRef = useRef({ enabled: true, volume: 0.3, style: 'soft' as 'soft' | 'pixel' });
  soundRef.current = { enabled: soundEnabled, volume: soundVolume, style: soundStyle };
  const positionRef = useRef(position);
  positionRef.current = position;

  const tone = (kind: ToneKind) => {
    const next = soundRef.current;
    if (!next.enabled) return;
    playUiTone(kind, next.volume, next.style);
  };
  const playLaunchOnce = () => {
    if (launchPlayed.current) return;
    launchPlayed.current = true;
    tone('launch');
  };

  const refresh = () => {
    void window.unvibe.barSnapshot().then((value) => setSnapshot(value as Snapshot));
  };

  const applyPulse = (next: PulsePhase, label: string) => {
    if (understoodTimer.current && next === 'working') {
      clearTimeout(understoodTimer.current);
      understoodTimer.current = null;
    }
    setPhase(next);
    setPulseLabel(label);
    if (next === 'understood') {
      tone('success');
      refresh();
      if (understoodTimer.current) clearTimeout(understoodTimer.current);
      understoodTimer.current = setTimeout(() => {
        setPhase('idle');
        setPulseLabel('Ready');
      }, 2600);
    } else if (next === 'ready') {
      refresh();
      if (understoodTimer.current) clearTimeout(understoodTimer.current);
      understoodTimer.current = setTimeout(() => {
        setPhase('idle');
        setPulseLabel('Ready');
      }, 1800);
    } else if (next === 'idle') {
      refresh();
    } else if (next === 'error') {
      if (understoodTimer.current) clearTimeout(understoodTimer.current);
      understoodTimer.current = setTimeout(() => {
        setPhase('idle');
        setPulseLabel('Ready');
      }, 3200);
    }
  };

  useEffect(() => {
    refresh();
    void window.unvibe.getSettings().then((value) => {
      const settings = value as { barHoverPreview?: boolean; barHoverDelayMs?: number; barPosition?: string; barSize?: 'small' | 'medium' | 'large'; soundEffects?: boolean; soundVolume?: number; soundStyle?: 'soft' | 'pixel' };
      setHoverEnabled(Boolean(settings.barHoverPreview ?? true));
      setHoverDelayMs(Math.min(600, Math.max(120, settings.barHoverDelayMs ?? 220)));
      setAttached(settings.barPosition === 'top-center');
      setPosition(settings.barPosition ?? 'top-center');
      setBarSize(settings.barSize ?? 'medium');
      setSoundEnabled(settings.soundEffects ?? true);
      setSoundVolume(settings.soundVolume ?? 0.3);
      setSoundStyle(settings.soundStyle ?? 'soft');
      soundRef.current = {
        enabled: settings.soundEffects ?? true,
        volume: settings.soundVolume ?? 0.3,
        style: settings.soundStyle ?? 'soft',
      };
      playLaunchOnce();
    });
    const unsubscribe = window.unvibe.onBarNotify((msg) => {
      setNote(msg);
      refresh();
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setNote(''), 4000);
    });
    const unsubscribePulse = window.unvibe.onBarPulse((pulse) => {
      applyPulse((pulse.phase as PulsePhase) || 'idle', pulse.label || 'Ready');
    });
    const unsubscribeCollapse = window.unvibe.onBarCollapse(() => setPanelExpanded(false));
    const unsubscribeSettings = window.unvibe.onBarSettings((settings) => {
      if (settings.barPosition) { setAttached(settings.barPosition === 'top-center'); setPosition(settings.barPosition); }
      if (settings.barSize) setBarSize(settings.barSize);
      if (settings.barHoverPreview !== undefined) setHoverEnabled(settings.barHoverPreview);
      if (settings.barHoverDelayMs !== undefined) setHoverDelayMs(settings.barHoverDelayMs);
      if (settings.soundEffects !== undefined) setSoundEnabled(settings.soundEffects);
      if (settings.soundVolume !== undefined) setSoundVolume(settings.soundVolume);
      if (settings.soundStyle !== undefined) setSoundStyle(settings.soundStyle);
    });
    return () => {
      unsubscribe();
      unsubscribePulse();
      unsubscribeCollapse();
      unsubscribeSettings();
      if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      if (closeAnimationTimer.current) clearTimeout(closeAnimationTimer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
      if (understoodTimer.current) clearTimeout(understoodTimer.current);
    };
  }, []);

  const setPanelExpanded = (next: boolean, withSound = true) => {
    if (next) {
      if (closeAnimationTimer.current) {
        clearTimeout(closeAnimationTimer.current);
        closeAnimationTimer.current = null;
      }
      setClosing(false);
      if (expandedRef.current) return;
      expandedRef.current = true;
      setExpanded(true);
      refresh();
      window.unvibe.setBarExpanded(true);
      if (withSound) tone('open');
      return;
    }
    if (!expandedRef.current) return;
    if (closeAnimationTimer.current) return;
    setClosing(true);
    window.unvibe.setBarExpanded(false);
    const closeMs = positionRef.current.startsWith('bottom') ? 380 : 240;
    closeAnimationTimer.current = setTimeout(() => {
      expandedRef.current = false;
      closeAnimationTimer.current = null;
      setClosing(false);
      setExpanded(false);
    }, closeMs);
  };
  useEffect(() => {
    const onWindowKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !expandedRef.current) return;
      event.preventDefault();
      setPanelExpanded(false);
    };
    window.addEventListener('keydown', onWindowKey);
    return () => window.removeEventListener('keydown', onWindowKey);
  }, []);
  const open = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setPanelExpanded(true);
  };
  const openFromHover = () => {
    if (!hoverEnabled || expandedRef.current) return;
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    hoverOpenTimer.current = setTimeout(() => {
      if (document.querySelector('.strip')?.matches(':hover')) setPanelExpanded(true, true);
    }, hoverDelayMs);
  };
  const scheduleClose = () => {
    pointerInside.current = false;
    if (!hoverEnabled) return;
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    const lockedFor = Math.max(0, actionLockUntil.current - Date.now());
    collapseTimer.current = setTimeout(() => {
      const stillHovered = document.querySelector('.strip')?.matches(':hover') ?? false;
      pointerInside.current = stillHovered;
      if (!stillHovered) setPanelExpanded(false, false);
    }, Math.max(120, lockedFor + 40));
  };

  const act = (action: 'review' | 'home') => {
    tone('click');
    actionLockUntil.current = Date.now() + 1400;
    if (action === 'review') {
      applyPulse('working', 'Explaining');
      window.unvibe.reviewSelection();
    } else window.unvibe.openCompanion();
  };

  const enter = () => {
    pointerInside.current = true;
    playLaunchOnce();
    const now = Date.now();
    if (now - lastHoverTone.current > 450) {
      lastHoverTone.current = now;
      tone('hover');
    }
    openFromHover();
  };

  const bottom = position.startsWith('bottom');
  const shortcut = prettyShortcut(snapshot?.shortcut ?? 'Control+U');
  const heat = snapshot?.heat ?? [];
  const understood = snapshot?.understood ?? 0;
  const lines = snapshot?.linesUnderstood ?? 0;
  const left = snapshot?.quota?.remaining ?? 0;
  const working = phase === 'working';
  const justUnderstood = phase === 'understood';
  const statusText = note || pulseLabel;

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
    <div
      className={`strip strip--size-${barSize}${attached ? ' strip--attached' : ''}${bottom ? ' strip--bottom' : ''}${expanded ? ' strip--expanded' : ''}${closing ? ' strip--closing' : ''}${working ? ' strip--working' : ''}${justUnderstood ? ' strip--got' : ''}${phase === 'error' ? ' strip--note' : ''}`}
      style={{ paddingTop: attached && expanded ? Math.max(38, ((window.screen as Screen & { availTop?: number }).availTop ?? window.screenY + 38) - window.screenY) : 0 }}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onClick={(event) => { if (!(event.target as HTMLElement).closest('button, input, textarea, select, a, [role="tab"]')) setPanelExpanded(!expandedRef.current); }}
      onContextMenu={(event) => { event.preventDefault(); window.unvibe.barContextMenu({ hasRecent: Boolean(snapshot?.recent) }); }}
      onMouseEnter={enter}
      onMouseLeave={scheduleClose}
    >
      <div className="strip__main" title={statusText}>
        {bottom ? (
          <div className="strip__bottom-shell">
            <button className="strip__bottom-open" type="button" onClick={() => setPanelExpanded(!expandedRef.current)} aria-expanded={expanded}>
              <span className="strip__bottom-mark"><LogoMark size={18} stroke={2} tone="island" /></span>
              <span className="strip__bottom-copy">
                <b>Unvibe</b>
                <small><span aria-hidden="true">🔥</span> {working ? 'Explaining' : justUnderstood ? 'Saved' : 'Ready'}</small>
              </span>
              <span className="strip__bottom-chevron" aria-hidden="true">⌃</span>
            </button>
            <div className="strip__bottom-actions" aria-hidden={!expanded}>
              <button type="button" onClick={() => act('review')} title={`Explain selected code · ${shortcut}`}><CodeIcon /><span>Review</span></button>
              <button type="button" onClick={() => act('home')} title="Open your learning space"><HomeIcon /><span>Open</span></button>
            </div>
          </div>
        ) : (
          <>
            <div className="strip__wing strip__wing--left">
              <button className="chip chip--play" aria-label="Explain selected code" title={`Explain selected code · ${shortcut}`} onClick={() => act('review')}><CodeIcon /></button>
              <span className="mark" aria-hidden="true"><LogoMark size={16} stroke={2.05} tone="island" /></span>
              <span className="strip__word">Unvibe</span>
            </div>
            <span className="strip__camera-gap" aria-hidden="true" />
            <div className="strip__wing strip__wing--right">
              <span className="strip__flame" aria-hidden="true">🔥</span>
              {working ? (
                <span className="strip__live-status" aria-live="polite"><Wave />Explaining</span>
              ) : justUnderstood ? (
                <span className="strip__live-status strip__live-status--ok" aria-live="polite">Understood</span>
              ) : phase === 'error' ? (
                <span className="strip__live-status strip__live-status--err" aria-live="polite">{pulseLabel}</span>
              ) : phase === 'ready' ? (
                <span className="strip__live-status" aria-live="polite">Explained</span>
              ) : (
                <span className="strip__live-status" aria-live="polite">Ready</span>
              )}
              <button className="chip chip--home" aria-label="Open Unvibe" title="Open Unvibe" onClick={() => act('home')}><HomeIcon /></button>
            </div>
          </>
        )}
      </div>
      {expanded && !bottom && (
        <div className="strip__drawer">
          <div className="strip__drawer-head">
            <div>
              <strong>{working ? 'Explaining now' : justUnderstood ? 'Saved as understood' : 'Learning pulse'}</strong>
              <div className="strip__live"><i aria-hidden="true" />{statusText} · on this Mac</div>
            </div>
            <button className="strip__collapse" type="button" aria-label="Collapse Island" onClick={() => setPanelExpanded(false)}>–</button>
          </div>
          {working ? <div className="strip__working"><Wave /><span>Reading the selection and writing an explanation.</span></div> : null}
          <div className="strip__metric-grid">
            <article><b>{snapshot?.explanations ?? 0}</b><span>reviews</span></article>
            <article data-tone="understood"><b>{understood}</b><span>understood</span></article>
            <article data-tone="lines"><b>{lines}</b><span>lines</span></article>
            <article><b>{left}</b><span>AI left</span></article>
          </div>
          <div className="strip__learning-row">
            <div className="strip__recent">
              <span className="pixel-label">Latest</span>
              <strong>{snapshot?.recent?.title ?? 'Nothing explained yet'}</strong>
              <small>{snapshot?.recent?.detail ?? `Select code and press ${shortcut}`}</small>
            </div>
            <div className="strip__concepts">
              <span>Reviews</span><b>{snapshot?.explanations ?? 0}</b>
              <span>Revisit</span><b>{snapshot?.needsReview ?? 0}</b>
              <small>{snapshot?.conceptsSeen ? `${snapshot.conceptsSeen} concepts seen` : 'Concepts appear after reviews'}</small>
            </div>
          </div>
          {heat.length > 0 ? (
            <div className="strip__heat" aria-hidden="true">
              <span>14d</span>
              <div>{heat.map((level, i) => <i key={i} data-level={level} />)}</div>
            </div>
          ) : null}
          <div className="strip__usage-inline">
            <UsageRings
              ai={snapshot?.quota ?? { used: 0, limit: 30, remaining: 30 }}
              selections={snapshot?.selections}
              tiny
              onOpen={() => act('home')}
            />
          </div>
          <div className="strip__actions">
            <button type="button" onClick={() => act('review')}>Explain selection <kbd>{shortcut}</kbd></button>
            <button type="button" onClick={() => act('home')}>Open learning space</button>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Bar />);
