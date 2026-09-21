import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';
import { prettyShortcut } from '../shared/prettyShortcut';
import { playUiTone, type ToneKind } from '../shared/tones';
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

type PulsePhase =
  | 'idle' | 'working' | 'analyzing' | 'searching' | 'thinking'
  | 'generating' | 'contextualizing' | 'finalizing' | 'ready'
  | 'understood' | 'error' | 'offline';

function CodeIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 9-3 3 3 3" /><path d="m16 9 3 3-3 3" /><path d="m14 5-4 14" /></svg>;
}

function StatusDots() {
  return <span className="island__dots" aria-hidden="true"><i /><i /><i /><i /></span>;
}

const STATUS_WORD: Record<PulsePhase, string> = {
  idle: 'ready', working: 'working', analyzing: 'analyzing', searching: 'searching',
  thinking: 'thinking', generating: 'generating', contextualizing: 'defining',
  finalizing: 'finalizing', ready: 'ready', understood: 'ready', error: 'issue', offline: 'offline',
};

function notchSafeTop(): number {
  const display = window.screen as Screen & { availTop?: number };
  const inset = (display.availTop ?? window.screenY + 38) - window.screenY;
  return Math.max(34, Math.min(48, Math.round(inset || 38)));
}

function Bar() {
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<PulsePhase>('idle');
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const [hoverDelayMs, setHoverDelayMs] = useState(160);
  const [attached, setAttached] = useState(true);
  const [position, setPosition] = useState('top-center');
  const [barSize, setBarSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.3);
  const [soundStyle, setSoundStyle] = useState<'soft' | 'pixel'>('soft');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const expandedRef = useRef(false);
  const actionLockUntil = useRef(0);
  const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchPlayed = useRef(false);
  const soundRef = useRef({ enabled: true, volume: 0.3, style: 'soft' as 'soft' | 'pixel' });
  soundRef.current = { enabled: soundEnabled, volume: soundVolume, style: soundStyle };

  const tone = (kind: ToneKind) => {
    const sound = soundRef.current;
    if (sound.enabled) playUiTone(kind, sound.volume, sound.style);
  };
  const playLaunchOnce = () => {
    if (launchPlayed.current) return;
    launchPlayed.current = true;
    tone('launch');
  };
  const refresh = () => void window.unvibe.barSnapshot().then((value) => setSnapshot(value as Snapshot));
  const applyPulse = (next: PulsePhase) => {
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
    setPhase(next);
    if (next === 'understood') tone('success');
    if (next === 'ready' || next === 'understood') refresh();
    if (next === 'ready' || next === 'understood' || next === 'error' || next === 'offline') {
      phaseTimer.current = setTimeout(() => setPhase('idle'), next === 'error' || next === 'offline' ? 3200 : 1800);
    } else if (next === 'idle') refresh();
  };

  const setPanelExpanded = (next: boolean, withSound = true) => {
    if (next) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = null;
      setClosing(false);
      if (expandedRef.current) return;
      expandedRef.current = true;
      setExpanded(true);
      refresh();
      window.unvibe.setBarExpanded(true);
      if (withSound) tone('open');
      return;
    }
    if (!expandedRef.current || closeTimer.current) return;
    setClosing(true);
    window.unvibe.setBarExpanded(false);
    closeTimer.current = setTimeout(() => {
      expandedRef.current = false;
      closeTimer.current = null;
      setExpanded(false);
      setClosing(false);
    }, 220);
  };

  useEffect(() => {
    refresh();
    void window.unvibe.getSettings().then((value) => {
      const settings = value as { barHoverPreview?: boolean; barHoverDelayMs?: number; barPosition?: string; barSize?: 'small' | 'medium' | 'large'; soundEffects?: boolean; soundVolume?: number; soundStyle?: 'soft' | 'pixel' };
      setHoverEnabled(settings.barHoverPreview ?? true);
      setHoverDelayMs(Math.min(600, Math.max(120, settings.barHoverDelayMs ?? 160)));
      setAttached((settings.barPosition ?? 'top-center') === 'top-center');
      setPosition(settings.barPosition ?? 'top-center');
      setBarSize(settings.barSize ?? 'medium');
      setSoundEnabled(settings.soundEffects ?? true);
      setSoundVolume(settings.soundVolume ?? 0.3);
      setSoundStyle(settings.soundStyle ?? 'soft');
      soundRef.current = { enabled: settings.soundEffects ?? true, volume: settings.soundVolume ?? 0.3, style: settings.soundStyle ?? 'soft' };
      playLaunchOnce();
    });
    const offNotify = window.unvibe.onBarNotify((message) => {
      setNote(message);
      refresh();
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setNote(''), 4000);
    });
    const offPulse = window.unvibe.onBarPulse((pulse) => applyPulse((pulse.phase as PulsePhase) || 'idle'));
    const offCollapse = window.unvibe.onBarCollapse(() => setPanelExpanded(false, false));
    const offSettings = window.unvibe.onBarSettings((settings) => {
      if (settings.barPosition) { setAttached(settings.barPosition === 'top-center'); setPosition(settings.barPosition); }
      if (settings.barSize) setBarSize(settings.barSize);
      if (settings.barHoverPreview !== undefined) setHoverEnabled(settings.barHoverPreview);
      if (settings.barHoverDelayMs !== undefined) setHoverDelayMs(settings.barHoverDelayMs);
      if (settings.soundEffects !== undefined) setSoundEnabled(settings.soundEffects);
      if (settings.soundVolume !== undefined) setSoundVolume(settings.soundVolume);
      if (settings.soundStyle !== undefined) setSoundStyle(settings.soundStyle);
    });
    return () => {
      offNotify(); offPulse(); offCollapse(); offSettings();
      if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
      if (phaseTimer.current) clearTimeout(phaseTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && expandedRef.current) setPanelExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openFromHover = () => {
    if (!hoverEnabled || expandedRef.current) return;
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    hoverOpenTimer.current = setTimeout(() => {
      if (document.querySelector('.island')?.matches(':hover')) setPanelExpanded(true);
    }, hoverDelayMs);
  };
  const scheduleClose = () => {
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    if (!hoverEnabled) return;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    const lock = Math.max(0, actionLockUntil.current - Date.now());
    collapseTimer.current = setTimeout(() => {
      if (!document.querySelector('.island')?.matches(':hover')) setPanelExpanded(false, false);
    }, Math.max(140, lock + 40));
  };
  const act = (action: 'review' | 'home') => {
    tone('click');
    actionLockUntil.current = Date.now() + 1000;
    if (action === 'review') {
      applyPulse('contextualizing');
      window.unvibe.reviewSelection();
    } else window.unvibe.openCompanion();
  };

  const bottom = position.startsWith('bottom');
  const active = phase !== 'idle';
  const shortcut = prettyShortcut(snapshot?.shortcut ?? 'Control+U');
  const heat = (snapshot?.heat ?? []).slice(-14);
  const aiLeft = snapshot?.quota?.remaining;
  const selectLeft = snapshot?.selections?.remaining;
  const usagePct = snapshot?.usage?.pct ?? (snapshot?.quota?.limit ? Math.round((snapshot.quota.used / snapshot.quota.limit) * 100) : undefined);
  const value = (number: number | undefined) => number === undefined ? '–' : String(number);

  return (
    <div
      className={`island island--${barSize}${attached ? ' island--attached' : ''}${bottom ? ' island--bottom' : ''}${expanded ? ' island--expanded' : ''}${closing ? ' island--closing' : ''} island--phase-${phase}`}
      style={{ '--safe-top': `${attached ? notchSafeTop() : 0}px` } as React.CSSProperties}
      onMouseEnter={() => { playLaunchOnce(); openFromHover(); }}
      onMouseLeave={scheduleClose}
      onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) setPanelExpanded(!expandedRef.current); }}
      onContextMenu={(event) => { event.preventDefault(); window.unvibe.barContextMenu({ hasRecent: Boolean(snapshot?.recent) }); }}
      role="region"
      aria-label="Unvibe Island"
    >
      <div className="island__compact">
        <div className="island__wing island__wing--left">
          <span className="island__mark" aria-hidden="true"><LogoMark size={17} stroke={2.05} tone="island" /></span>
          <button className="island__tool" type="button" aria-label={`Understand selected code, ${shortcut}`} title={`Understand selected code · ${shortcut}`} onClick={() => act('review')}><CodeIcon /></button>
        </div>
        <span className="island__notch" aria-hidden="true" />
        <div className="island__wing island__wing--right" aria-live="polite">
          {active ? <><StatusDots /><span className="island__status">{STATUS_WORD[phase]}</span></> : <span className="island__streak"><b>{value(snapshot?.streak)}</b><span aria-hidden="true">🔥</span></span>}
        </div>
      </div>

      {expanded ? (
        <div className="island__overview">
          <header className="island__header">
            <div><strong>Unvibe</strong><span>your personal learning layer</span></div>
            <span className="island__header-streak"><b>{value(snapshot?.streak)}</b><span aria-hidden="true">🔥</span></span>
          </header>
          <div className="island__metrics" aria-label="Learning metrics">
            <span><b>{value(snapshot?.explanations)}</b> reviews</span>
            <span data-tone="green"><b>{value(snapshot?.understood)}</b> understood</span>
            <span data-tone="blue"><b>{value(snapshot?.linesUnderstood)}</b> lines</span>
            <span><b>{usagePct === undefined ? '–' : `${usagePct}%`}</b> usage</span>
          </div>
          <div className="island__activity"><span>14d</span><div>{Array.from({ length: 14 }, (_, index) => <i key={index} data-level={heat[index] ?? 0} />)}</div></div>
          <div className="island__allowance"><span><b>{value(aiLeft)}</b> AI</span><i /><span><b>{value(selectLeft)}</b> Select</span></div>
          <p className="island__hint">Select code · press {shortcut} · Unvibe explains</p>
          {note ? <p className="island__note">{note}</p> : null}
          <div className="island__actions">
            <button type="button" onClick={() => act('review')}>Understand change</button>
            <button type="button" onClick={() => act('home')}>Open Unvibe</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Bar />);
