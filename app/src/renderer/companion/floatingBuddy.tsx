import { useEffect, useRef, useState } from 'react';
import { Buddy, setBuddyMood, useBuddyMood } from '../shared/buddy';

const GREETED_KEY = 'unvibe.vibe.greetedOn';
const SLEEP_AFTER_MS = 120_000;

function greetingFor(name: string | undefined, now = new Date()): string {
  const hour = now.getHours();
  const part = hour < 5 ? 'Up late' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}.` : `${part}.`;
}

/**
 * Vibe floating in the corner of the companion. It follows the pointer, says hello once a
 * day, dozes off when you step away, and mirrors whatever the AI is doing elsewhere.
 * Clicking it opens chat.
 */
export function FloatingBuddy({ userName, onOpenChat, hidden }: { userName?: string; onOpenChat: () => void; hidden?: boolean }) {
  const mood = useBuddyMood('idle');
  const [bubble, setBubble] = useState('');
  const lastActive = useRef(Date.now());

  // Once-a-day greeting.
  useEffect(() => {
    const today = new Date().toDateString();
    let greeted = '';
    try { greeted = window.localStorage.getItem(GREETED_KEY) ?? ''; } catch { /* storage blocked */ }
    if (greeted === today) return;
    const show = window.setTimeout(() => {
      setBubble(greetingFor(userName));
      setBuddyMood('wave');
      try { window.localStorage.setItem(GREETED_KEY, today); } catch { /* storage blocked */ }
    }, 900);
    const hide = window.setTimeout(() => { setBubble(''); setBuddyMood('idle'); }, 6200);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [userName]);

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

  if (hidden) return null;

  return (
    <div className={`vibe-float vibe-float--${mood}`}>
      {bubble ? <div className="vibe-float__bubble" role="status">{bubble}</div> : null}
      <button type="button" className="vibe-float__btn" onClick={onOpenChat} aria-label="Ask Vibe" title="Ask Vibe">
        <Buddy mood={mood} size={46} follow />
      </button>
    </div>
  );
}
