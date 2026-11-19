import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { allowanceUsedPct } from '../../core/allowance';
import { Buddy } from '../shared/buddy';
import { isMac } from '../shared/platform';
import { prettyShortcut } from '../shared/prettyShortcut';
import { playUiTone, type ToneKind } from '../shared/tones';
import { trackWindowAway } from '../shared/windowAway';
import '../shared/tokens.css';

type Snapshot = {
  shortcut: string;
  recent: { id: string; title: string; detail: string; level: string } | null;
  explanations: number;
  understood: number;
  needsReview: number;
  linesUnderstood: number;
  conceptsSeen: number;
  conceptsStrong: number;
  quota?: { used: number; limit: number; remaining: number };
  selections?: { used: number; limit: number; remaining: number };
  heat: number[];
};

type PulsePhase =
  | 'idle' | 'loading' | 'working' | 'analyzing' | 'searching' | 'thinking'
  | 'generating' | 'contextualizing' | 'finalizing' | 'ready'
  | 'understood' | 'error' | 'offline';

function CodeIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m8 9-3 3 3 3" /><path d="m16 9 3 3-3 3" /><path d="m14 5-4 14" /></svg>;
}

function SettingsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3h3.4l.6 2.1 1.6.7 1.9-1 2.4 2.4-1 1.9.7 1.6 2.1.6v3.4l-2.1.6-.7 1.6 1 1.9-2.4 2.4-1.9-1-1.6.7-.6 2.1h-3.4l-.6-2.1-1.6-.7-1.9 1-2.4-2.4 1-1.9-.7-1.6-2.1-.6v-3.4l2.1-.6.7-1.6-1-1.9 2.4-2.4 1.9 1 1.6-.7z"/><circle cx="12" cy="12" r="2.7"/></svg>;
}

function TickIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>;
}

/**
 * Working (Mono): the three steps the overlay shows, one word each, and which of the three dots leads under reduced
 * motion (otherwise one dot at full strength steps across them). Done and problem phases have their own marks.
 */
const WORKING: Partial<Record<PulsePhase, { word: string; step: 0 | 1 | 2 }>> = {
  loading: { word: 'Reading', step: 0 },
  working: { word: 'Reading', step: 0 },
  contextualizing: { word: 'Reading', step: 0 },
  searching: { word: 'Checking', step: 1 },
  analyzing: { word: 'Checking', step: 1 },
  thinking: { word: 'Checking', step: 1 },
  generating: { word: 'Writing', step: 2 },
  finalizing: { word: 'Writing', step: 2 },
};

function Status({ phase }: { phase: PulsePhase }) {
  const working = WORKING[phase];
  if (working) {
    return (
      <span className="island__status" data-step={working.step}>
        <span className="island__dots" aria-hidden="true"><i /><i /><i /></span>
        {working.word}
      </span>
    );
  }
  if (phase === 'ready' || phase === 'understood') {
    return <span className="island__status"><span className="island__done" aria-hidden="true"><TickIcon /></span>{phase === 'ready' ? 'Ready' : 'Understood'}</span>;
  }
  return <span className="island__status island__status--problem"><span className="island__problem" aria-hidden="true" />{phase === 'offline' ? 'Offline' : 'Issue'}</span>;
}

type ThemePreference = 'light' | 'dark' | 'system';

/** The floating Island takes the app's theme ground (Mono); attached to the notch it is black in both. */
function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function notchSafeTop(): number {
  const display = window.screen as Screen & { availTop?: number };
  const inset = (display.availTop ?? window.screenY + 38) - window.screenY;
  return Math.max(38, Math.min(48, Math.round(inset || 38)));
}

function Bar() {
  const [note, setNote] = useState('');
  const [noteProblem, setNoteProblem] = useState(false);
  const [phase, setPhase] = useState<PulsePhase>('idle');
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(true);
  const [hoverDelayMs, setHoverDelayMs] = useState(160);
  const [attached, setAttached] = useState(isMac);
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
    let theme: ThemePreference = 'light';
    void window.unvibe.getSettings().then((value) => {
      const settings = value as { theme?: ThemePreference; barHoverPreview?: boolean; barHoverDelayMs?: number; barPosition?: string; barSize?: 'small' | 'medium' | 'large'; soundEffects?: boolean; soundVolume?: number; soundStyle?: 'soft' | 'pixel' };
      theme = settings.theme ?? 'light';
      applyTheme(theme);
      setHoverEnabled(settings.barHoverPreview ?? true);
      setHoverDelayMs(Math.min(600, Math.max(120, settings.barHoverDelayMs ?? 160)));
      setAttached(isMac && (settings.barPosition ?? 'top-center') === 'top-center');
      setPosition(settings.barPosition ?? 'top-center');
      setBarSize(settings.barSize ?? 'medium');
      setSoundEnabled(settings.soundEffects ?? true);
      setSoundVolume(settings.soundVolume ?? 0.3);
      setSoundStyle(settings.soundStyle ?? 'soft');
      soundRef.current = { enabled: settings.soundEffects ?? true, volume: settings.soundVolume ?? 0.3, style: settings.soundStyle ?? 'soft' };
      playLaunchOnce();
    });
    const offNotify = window.unvibe.onBarNotify((notice) => {
      setNote(notice.text);
      setNoteProblem(notice.problem);
      refresh();
      if (noteTimer.current) clearTimeout(noteTimer.current);
      // Long enough to read a three-line notice (F-18: they used to vanish after 4 s, unseen). Keep it
      // under notify.ts's 15 s gap: that gap is what stops an information notice replacing a problem.
      noteTimer.current = setTimeout(() => setNote(''), 9000);
    });
    const offPulse = window.unvibe.onBarPulse((pulse) => applyPulse((pulse.phase as PulsePhase) || 'idle'));
    const offCollapse = window.unvibe.onBarCollapse(() => setPanelExpanded(false, false));
    const offSettings = window.unvibe.onBarSettings((settings) => {
      if (settings.barPosition) { setAttached(isMac && settings.barPosition === 'top-center'); setPosition(settings.barPosition); }
      if (settings.barSize) setBarSize(settings.barSize);
      if (settings.barHoverPreview !== undefined) setHoverEnabled(settings.barHoverPreview);
      if (settings.barHoverDelayMs !== undefined) setHoverDelayMs(settings.barHoverDelayMs);
      if (settings.soundEffects !== undefined) setSoundEnabled(settings.soundEffects);
      if (settings.soundVolume !== undefined) setSoundVolume(settings.soundVolume);
      if (settings.soundStyle !== undefined) setSoundStyle(settings.soundStyle);
    });
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { if (theme === 'system') applyTheme('system'); };
    scheme.addEventListener('change', onScheme);
    return () => {
      offNotify(); offPulse(); offCollapse(); offSettings();
      scheme.removeEventListener('change', onScheme);
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

  // A notice's text shows under the compact Island without expanding it; main sizes the window to fit.
  useEffect(() => { window.unvibe.setBarNotice(Boolean(note)); }, [note]);

  const openFromHover = () => {
    // A notice is showing: hovering to read it must not swap it for the overview's one-line note.
    if (!hoverEnabled || expandedRef.current || note) return;
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
  const act = (action: 'review' | 'home' | 'settings') => {
    tone('click');
    actionLockUntil.current = Date.now() + 1000;
    if (action === 'review') {
      applyPulse('contextualizing');
      window.unvibe.reviewSelection();
    } else if (action === 'settings') window.unvibe.openSettings();
    else window.unvibe.openCompanion();
  };

  const bottom = position.startsWith('bottom');
  const active = phase !== 'idle';
  const shortcut = prettyShortcut(snapshot?.shortcut ?? 'Control+U');
  const heat = (snapshot?.heat ?? []).slice(-14);
  const aiLeft = snapshot?.quota?.remaining;
  const selectLeft = snapshot?.selections?.remaining;
  const usagePct = allowanceUsedPct(snapshot?.quota);
  const value = (number: number | undefined) => number === undefined ? '–' : String(number);

  return (
    <div
      className={`island island--${barSize}${attached ? ' island--attached' : ''}${bottom ? ' island--bottom' : ''}${expanded ? ' island--expanded' : ''}${closing ? ' island--closing' : ''}${note && !expanded ? ' island--notice' : ''} island--phase-${phase}`}
      style={{ '--safe-top': `${attached ? notchSafeTop() : 38}px` } as React.CSSProperties}
      onMouseEnter={() => { playLaunchOnce(); openFromHover(); }}
      onMouseLeave={scheduleClose}
      onClick={(event) => { if (!(event.target as HTMLElement).closest('button')) setPanelExpanded(!expandedRef.current); }}
      onContextMenu={(event) => { event.preventDefault(); window.unvibe.barContextMenu({ hasRecent: Boolean(snapshot?.recent) }); }}
      role="region"
      aria-label="Unvibe Island"
    >
      <div className="island__compact">
        <div className="island__wing island__wing--left">
          <span className="island__mark" aria-hidden="true"><Buddy mood={WORKING[phase] ? 'thinking' : phase === 'ready' || phase === 'understood' ? 'happy' : 'idle'} size={20} label="Vibe" /></span>
          <button className="island__tool" type="button" aria-label={`Understand selected code, ${shortcut}`} title={`Understand selected code · ${shortcut}`} onClick={() => act('review')}><CodeIcon /></button>
        </div>
        <span className="island__notch" aria-hidden="true" />
        <div className="island__wing island__wing--right" aria-live="polite">
          {active ? <Status phase={phase} /> : aiLeft === undefined ? null : <span className="island__left" title="AI explanations left"><b>{aiLeft}</b> left</span>}
        </div>
      </div>

      {/* Screen readers hear the notice from this always-mounted live region; the visible copies are hidden from them. */}
      <p className="island__sr" role="status">{note}</p>
      {note && !expanded ? <p key={note} className={`island__notice${noteProblem ? ' island__notice--problem' : ''}`} aria-hidden="true">{note}</p> : null}

      {expanded ? (
        <div className="island__overview">
          <header className="island__header">
            <div><strong>Unvibe</strong><span>Your learning, at a glance</span></div>
            <div className="island__header-actions">
              <button className="island__settings" type="button" aria-label="Island settings" title="Island settings" onClick={() => act('settings')}><SettingsIcon /></button>
            </div>
          </header>
          <div className="island__metrics" role="group" aria-label="Learning metrics">
            <span><b>{value(snapshot?.explanations)}</b> reviews</span>
            <span><b>{value(snapshot?.understood)}</b> understood</span>
            <span><b>{value(snapshot?.linesUnderstood)}</b> lines</span>
            <span><b>{usagePct === undefined ? '–' : `${usagePct}%`}</b> AI used</span>
          </div>
          <div className="island__activity" role="img" aria-label="Activity over the last 14 days"><span aria-hidden="true">14 days</span><div aria-hidden="true">{Array.from({ length: 14 }, (_, index) => <i key={index} data-level={heat[index] ?? 0} />)}</div></div>
          <div className="island__allowance"><span><b>{value(aiLeft)}</b> explanations left</span><i aria-hidden="true">·</i><span><b>{value(selectLeft)}</b> selections left</span></div>
          <p className="island__hint">Select code · press <kbd>{shortcut}</kbd> · Unvibe explains</p>
          {note ? <p className="island__note" aria-hidden="true">{note}</p> : null}
          <div className="island__actions">
            <button type="button" onClick={() => act('review')}>Understand change</button>
            <button type="button" onClick={() => act('home')}>Open Unvibe</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

trackWindowAway();
createRoot(document.getElementById('root')!).render(<Bar />);
