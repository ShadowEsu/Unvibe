import { useEffect, useState, type FormEvent } from 'react';
import { Buddy, setBuddyMood } from '../shared/buddy';
import { playTone } from '../shared/tones';

const MAX_WORDS = 100;
export const FEEDBACK_ASKED_KEY = 'unvibe.feedbackAsked';

function words(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/** Stars plus up to 100 words. Shown once after the third explanation, and from the account menu. */
export function FeedbackCard({ onClose }: { onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const count = words(message);
  const tooLong = count > MAX_WORDS;

  useEffect(() => {
    try { window.localStorage.setItem(FEEDBACK_ASKED_KEY, '1'); } catch { /* storage blocked */ }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!rating || tooLong) return;
    setState('sending');
    setError('');
    const result = (await window.unvibe.sendFeedback({ rating, message })) as { ok?: boolean; error?: string };
    if (!result?.ok) {
      setState('error');
      setError(result?.error ?? 'Could not send feedback.');
      playTone('wrong');
      return;
    }
    setState('done');
    setBuddyMood('celebrate');
    window.setTimeout(onClose, 2200);
  };

  return (
    <div className="fbk-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="fbk" role="dialog" aria-modal="true" aria-labelledby="fbk-title">
        <button type="button" className="fbk__close" aria-label="Close" onClick={onClose}>×</button>
        {state === 'done' ? (
          <div className="fbk__done">
            <Buddy mood="celebrate" size={76} label="Vibe" />
            <h2 id="fbk-title">Thank <em>you!</em></h2>
            <p>Every note gets read by a human.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="fbk__head">
              <Buddy mood={rating >= 4 ? 'happy' : rating && rating <= 2 ? 'confused' : 'idle'} size={52} label="Vibe" />
              <div>
                <h2 id="fbk-title">How am I <em>doing?</em></h2>
                <p>Stars and a few words. That&rsquo;s it.</p>
              </div>
            </div>
            <div className="fbk__stars" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  className={(hover || rating) >= n ? 'is-on' : ''} onMouseEnter={() => setHover(n)}
                  onClick={() => { setRating(n); playTone(n >= 4 ? 'boop' : 'step'); }}>★</button>
              ))}
            </div>
            <textarea rows={4} maxLength={1200} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder={rating && rating <= 3 ? 'What would make it better?' : 'Anything you want to tell us? Up to 100 words.'} aria-label="Your feedback" />
            <p className={`fbk__count${tooLong ? ' is-over' : ''}`}>{count}/{MAX_WORDS} words</p>
            {state === 'error' ? <p className="field-err" role="alert">{error}</p> : null}
            <div className="fbk__actions">
              <button type="button" className="soft-btn" onClick={onClose}>Maybe later</button>
              <button type="submit" className="primary-btn" disabled={!rating || tooLong || state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
