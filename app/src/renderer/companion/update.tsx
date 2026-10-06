import { useEffect, useState } from 'react';
import { Buddy } from '../shared/buddy';
import { playTone } from '../shared/tones';

/** A small card when a newer Unvibe exists. One click downloads it, swaps the app and reopens. */
export function UpdateCard() {
  const [latest, setLatest] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');
  const [pct, setPct] = useState(0);
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const offAvailable = window.unvibe.onUpdateAvailable((info) => { if (info.latest) setLatest(info.latest); });
    const offProgress = window.unvibe.onUpdateProgress((value) => setPct(value));
    void window.unvibe.updateCheck().then((r) => {
      const info = r as { ok: boolean; available?: boolean; latest?: string };
      if (info.ok && info.available && info.latest) setLatest(info.latest);
    });
    return () => { offAvailable(); offProgress(); };
  }, []);

  if (!latest || hidden) return null;

  const update = async () => {
    setState('working'); setError(''); setPct(0);
    playTone('whoosh');
    const r = await window.unvibe.updateInstall() as { ok: boolean; error?: string };
    if (!r.ok) { setState('error'); setError(r.error ?? 'The update did not finish.'); }
  };

  return (
    <div className="update-card" role="status" aria-live="polite">
      <Buddy mood={state === 'working' ? 'thinking' : 'wave'} size={44} label="Vibe" />
      <div className="update-card__body">
        <strong>Unvibe {latest} is ready</strong>
        {state === 'working'
          ? <span>{pct < 100 ? `Downloading… ${pct}%` : 'Installing. Unvibe reopens in a moment.'}</span>
          : <span>{state === 'error' ? error : 'New stuff inside. Takes about a minute, your lessons stay.'}</span>}
        {state === 'working' ? <i className="update-card__bar"><b style={{ width: `${Math.max(4, pct)}%` }} /></i> : null}
      </div>
      {state !== 'working' ? (
        <div className="update-card__actions">
          <button type="button" className="field-btn inline" onClick={() => void update()}>{state === 'error' ? 'Try again' : 'Update now'}</button>
          <button type="button" className="update-card__later" onClick={() => setHidden(true)}>Later</button>
        </div>
      ) : null}
    </div>
  );
}
