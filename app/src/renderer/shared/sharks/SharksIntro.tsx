import { useEffect, useRef, useState } from 'react';
import { Buddy } from '../buddy';
import { SharksStart } from './sharksStart';

export type IntroPhase = 'swim' | 'leaving' | 'gone';

/**
 * The cold-launch stage (Design r2-motion SPEC §2): the G1 dark ground in both themes, the violet ascii-sharks on a
 * canvas, the lockup on a glass-2 pill. Timeline 1,900 ms: canvas in over 180, lockup 250-600, swim to 1,550, stage
 * out 1,550-1,900 while the app arrives under it (`onPhase('leaving')`), then `onPhase('gone')` and the owner
 * unmounts it: no canvas, no frame loop. Any pointer down or key down skips: the stage is out within 150 ms; the
 * click is swallowed by the stage, the key is not replayed. Blur or hidden removes it at once. Reduced motion: one
 * still frame held 400 ms, then a 200 ms fade.
 */
export function SharksIntro({ onPhase }: { onPhase: (phase: IntroPhase) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [exit, setExit] = useState<'' | 'timeout' | 'skip'>('');
  const phaseRef = useRef(onPhase);
  phaseRef.current = onPhase;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ended = false;
    let timer = 0;
    const end = (why: 'timeout' | 'skip' | 'hidden') => {
      if (ended) return;
      ended = true;
      if (why === 'hidden') {
        phaseRef.current('gone');
        return;
      }
      setExit(why);
      phaseRef.current('leaving');
      timer = window.setTimeout(() => phaseRef.current('gone'), reduced ? 200 : why === 'skip' ? 150 : 350);
    };
    const ocean = new SharksStart(canvas, { still: reduced, onEnd: end });
    if (reduced) timer = window.setTimeout(() => end('timeout'), 400);
    const skip = (event: Event) => {
      // The click lands on the stage and nowhere else; a key is consumed here, not replayed.
      event.preventDefault();
      event.stopPropagation();
      ocean.skip();
    };
    window.addEventListener('keydown', skip, true);
    window.addEventListener('pointerdown', skip, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', skip, true);
      window.removeEventListener('pointerdown', skip, true);
      ocean.destroy();
    };
  }, []);

  return (
    <div className={`sharks-intro${exit ? ` sharks-intro--out sharks-intro--out-${exit}` : ''}`} role="img" aria-label="Unvibe is starting" data-testid="sharks-intro">
      <canvas ref={canvasRef} className="sharks-intro__canvas" aria-hidden="true" />
      <div className="sharks-intro__lockup">
        <Buddy size={40} label="Vibe" />
        <span>Unvibe</span>
      </div>
    </div>
  );
}
