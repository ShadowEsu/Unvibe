import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';
import { SOUND_PALETTE } from '../../core/sound';
import type { Accent, SoundEvent } from '../../core/islandState';

type IslandView = {
  state: string;
  presentation: string;
  narration: string;
  accent: Accent;
  glance: boolean;
  dwellMs: number;
};

/** Synthesize a short island cue with the Web Audio API (original, restrained). */
function playIslandSound(event: SoundEvent): void {
  if (!event) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const spec = SOUND_PALETTE[event];
  if (!spec) return;
  try {
    const AudioCtor: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtor();
    spec.freqs.forEach((freq, i) => {
      const t0 = ctx.currentTime + (i * spec.stepMs) / 1000;
      const t1 = t0 + spec.durMs / 1000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(spec.gain, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = spec.type;
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    });
    const total = (spec.freqs.length * spec.stepMs + spec.durMs) / 1000 + 0.1;
    setTimeout(() => void ctx.close(), total * 1000 + 200);
  } catch {
    /* audio is optional — the island still works silently */
  }
}

type Snapshot = {
  shortcut: string;
  recent: { id: string; title: string; detail: string; level: string } | null;
  streak: number;
  explanations: number;
  paused: boolean;
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
  const [paused, setPaused] = useState(false);
  const [island, setIsland] = useState<IslandView | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const islandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = () => void window.unvibe.barSnapshot().then((value) => {
    const snap = value as Snapshot;
    setSnapshot(snap);
    setPaused(Boolean(snap.paused));
  });
  useEffect(() => {
    refresh();
    void window.unvibe.getSettings().then((value) => {
      const enabled = Boolean((value as { barHoverPreview?: boolean }).barHoverPreview ?? true);
      setHoverEnabled(enabled);
    });
    const unsubscribe = window.unvibe.onBarNotify((msg) => {
      setNote(msg);
      refresh();
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setNote(''), 4000);
    });
    const unpaused = window.unvibe.onBarPaused((next) => setPaused(next));
    const unstate = window.unvibe.onIslandState((view) => {
      const v = view as IslandView;
      setIsland(v);
      refresh();
      if (islandTimer.current) clearTimeout(islandTimer.current);
      // Transient notices (ready/saved/error…) linger their dwell, then return to dormant.
      if (v.dwellMs > 0) {
        islandTimer.current = setTimeout(() => {
          setIsland((cur) => (cur && cur.state === v.state ? { ...cur, state: 'idle', narration: 'Ready to understand', accent: 'idle', glance: false, dwellMs: 0 } : cur));
        }, v.dwellMs);
      }
    });
    const unsound = window.unvibe.onIslandSound((event) => playIslandSound(event as SoundEvent));
    return () => {
      unsubscribe();
      unpaused();
      unstate();
      unsound();
      if (collapseTimer.current) clearTimeout(collapseTimer.current);
      if (noteTimer.current) clearTimeout(noteTimer.current);
      if (islandTimer.current) clearTimeout(islandTimer.current);
    };
  }, []);

  const open = () => {
    if (!hoverEnabled) return;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    setExpanded(true);
    window.unvibe.setBarExpanded(true);
    refresh();
  };
  const scheduleClose = () => {
    if (!hoverEnabled) return;
    collapseTimer.current = setTimeout(() => {
      setExpanded(false);
      window.unvibe.setBarExpanded(false);
    }, 180);
  };

  const activeIsland = island && island.state !== 'idle' ? island : null;
  const accent: Accent = activeIsland?.accent ?? 'idle';
  const glancing = Boolean(activeIsland?.glance);
  const status = note || activeIsland?.narration || (paused ? 'Paused' : 'Ready to understand');
  const onContext = (e: MouseEvent) => {
    e.preventDefault();
    window.unvibe.barContextMenu();
  };

  return (
    <div
      className={`strip${expanded ? ' strip--expanded' : ''}${note ? ' strip--note' : ''}${paused ? ' strip--paused' : ''}${activeIsland ? ' strip--active' : ''}`}
      data-accent={accent}
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
      onContextMenu={onContext}
    >
      <div className="strip__main" title={activeIsland?.narration || note || (paused ? 'Unvibe is paused' : 'Unvibe is ready')}>
        <button className="chip chip--play" aria-label="Explain selected code" title="Explain selected code" onClick={() => window.unvibe.reviewSelection()}><PlayIcon /></button>
        <span className="mark" aria-hidden="true"><LogoMark size={15} stroke={2.1} /></span>
        {glancing && <span className={`dot dot--${accent}`} aria-hidden="true" />}
        <span className="strip__status" aria-live="polite">{status}</span>
        <span className="strip__privacy"><i />{paused ? 'paused' : 'local scan'}</span>
        <button className="chip chip--home" aria-label="Open Unvibe" title="Open Unvibe" onClick={() => window.unvibe.openCompanion()}><HomeIcon /></button>
      </div>
      {expanded && (
        <div className="strip__drawer">
          <div className="strip__recent">
            <span className="pixel-label">LAST LEARNING</span>
            <strong>{snapshot?.recent?.title ?? 'No explanations yet'}</strong>
            <small>{snapshot?.recent?.detail ?? 'Select code and start your first explanation.'}</small>
          </div>
          <div className="strip__stats" aria-label="Learning summary">
            <span><b>{snapshot?.streak ?? 0}</b> day streak</span>
            <span><b>{snapshot?.explanations ?? 0}</b> explained</span>
          </div>
          <div className="strip__actions">
            <button onClick={() => window.unvibe.reviewSelection()}>Understand code <kbd>{prettyShortcut(snapshot?.shortcut)}</kbd></button>
            <button onClick={() => window.unvibe.openCompanion()}>Open learning history →</button>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Bar />);
