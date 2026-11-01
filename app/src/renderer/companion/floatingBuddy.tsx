import { useEffect, useRef } from 'react';
import { Buddy, setBuddyMood, useBuddyMood } from '../shared/buddy';

const SLEEP_AFTER_MS = 120_000;

/**
 * Vibe in the bottom-right slot beside the Ask bar. It follows the pointer, waves when you open a
 * page (App sets the mood), dozes off when you step away, and mirrors whatever the AI is doing
 * elsewhere. It has no speech bubble: a bubble would sit on page content, and Today already greets
 * you (Design A7, P1). Clicking it opens Ask Vibe.
 */
export function FloatingBuddy({ onOpenChat }: { onOpenChat: () => void }) {
  const mood = useBuddyMood('idle');
  const lastActive = useRef(Date.now());

  // Doze after a quiet stretch, wake up on any movement.
  useEffect(() => {
    let sleeping = false;
    const wake = () => {
      lastActive.current = Date.now();
      if (sleeping) {
        sleeping = false;
        setBuddyMood('idle');
      }
    };
    const tick = window.setInterval(() => {
      if (!sleeping && Date.now() - lastActive.current > SLEEP_AFTER_MS) {
        sleeping = true;
        setBuddyMood('sleepy');
      }
    }, 10_000);
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('keydown', wake);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);

  return (
    <div className={`vibe-float vibe-float--${mood}`}>
      <button type="button" className="vibe-float__btn" onClick={onOpenChat} aria-label="Ask Vibe" title="Ask Vibe">
        <Buddy mood={mood} size={46} follow />
      </button>
    </div>
  );
}
