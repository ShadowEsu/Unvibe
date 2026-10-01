import { useEffect, useRef, useState } from 'react';

/**
 * Vibe, the face of Unvibe's AI. A soft, squishy violet blob with big eyes that wobbles as it thinks.
 *
 * Moods map to what the AI is doing:
 * - idle: blinks and glances around (follows the pointer when `follow` is set)
 * - thinking: eyes look up, the blob wobbles faster, thought dots rise (waiting for the first token)
 * - reading: pupils sweep left to right like reading lines (tokens streaming)
 * - happy: smiling arc eyes and a small bounce (answer finished, quiz correct)
 * - celebrate: happy plus sparkles (milestones, onboarding done)
 * - confused: squint and a tilt (errors, limits)
 * - sleepy: heavy lids and a slow breath (long idle, offline)
 * - wave: a friendly hello bounce (greetings)
 */
export type BuddyMood = 'idle' | 'thinking' | 'reading' | 'happy' | 'celebrate' | 'confused' | 'sleepy' | 'wave';

interface BuddyProps {
  mood?: BuddyMood;
  size?: number;
  /** Track the pointer with the pupils while idle. */
  follow?: boolean;
  className?: string;
  label?: string;
}

const EVENT = 'unvibe:buddy';

/** Let any part of a window set the shared Vibe mood without prop drilling. */
export function setBuddyMood(mood: BuddyMood): void {
  window.dispatchEvent(new CustomEvent<BuddyMood>(EVENT, { detail: mood }));
}

/** Subscribe to the shared mood; falls back to `initial`. */
export function useBuddyMood(initial: BuddyMood = 'idle'): BuddyMood {
  const [mood, setMood] = useState<BuddyMood>(initial);
  useEffect(() => {
    const onMood = (event: Event) => setMood((event as CustomEvent<BuddyMood>).detail);
    window.addEventListener(EVENT, onMood);
    return () => window.removeEventListener(EVENT, onMood);
  }, []);
  return mood;
}

/** Map an AI or Island phase onto a Vibe mood. */
export function buddyMoodForPhase(phase: string): BuddyMood {
  switch (phase) {
    case 'loading':
    case 'working':
    case 'analyzing':
    case 'searching':
    case 'thinking':
    case 'contextualizing':
      return 'thinking';
    case 'generating':
    case 'streaming':
    case 'finalizing':
      return 'reading';
    case 'ready':
    case 'understood':
    case 'done':
      return 'happy';
    case 'error':
      return 'confused';
    case 'offline':
      return 'sleepy';
    default:
      return 'idle';
  }
}

export function Buddy({ mood = 'idle', size = 40, follow = false, className = '', label }: BuddyProps) {
  const rootRef = useRef<HTMLSpanElement>(null);

  // Pupils follow the pointer gently while idle.
  useEffect(() => {
    if (!follow || mood !== 'idle') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const node = rootRef.current;
        if (!node) return;
        const rect = node.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const dist = Math.max(1, Math.hypot(dx, dy));
        const reach = Math.min(1, dist / 260);
        node.style.setProperty('--look-x', `${((dx / dist) * 2.2 * reach).toFixed(2)}px`);
        node.style.setProperty('--look-y', `${((dy / dist) * 1.8 * reach).toFixed(2)}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
      rootRef.current?.style.removeProperty('--look-x');
      rootRef.current?.style.removeProperty('--look-y');
    };
  }, [follow, mood]);

  const happy = mood === 'happy' || mood === 'celebrate' || mood === 'wave';

  return (
    <span
      ref={rootRef}
      className={`buddy buddy--${mood} ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `Vibe is ${mood === 'idle' ? 'here' : mood}`}
    >
      <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
        <defs>
          <radialGradient id="buddy-body" cx="0.36" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#c9b8ff" />
            <stop offset="0.5" stopColor="#8f68f7" />
            <stop offset="1" stopColor="#5a33c8" />
          </radialGradient>
        </defs>
        <ellipse className="buddy__shadow" cx="24" cy="45" rx="12" ry="1.8" />
        <g className="buddy__float">
          <path className="buddy__body" d="M24 9C34 9 41 16 41 26C41 36 34 42 24 42C14 42 7 36 7 26C7 16 14 9 24 9Z" fill="url(#buddy-body)" />
          <ellipse className="buddy__gloss" cx="17" cy="15.5" rx="4.6" ry="2.6" transform="rotate(-24 17 15.5)" />
          {happy ? (
            <g className="buddy__eyes buddy__eyes--happy">
              <path d="M15.6 25.2c1.2-2.6 4.8-2.6 6 0" />
              <path d="M26.4 25.2c1.2-2.6 4.8-2.6 6 0" />
            </g>
          ) : (
            <g className="buddy__eyes">
              <g className="buddy__eye">
                <ellipse cx="18.6" cy="24" rx="3.1" ry="4.2" fill="#fff" />
                <circle className="buddy__pupil" cx="18.9" cy="24.6" r="1.9" />
              </g>
              <g className="buddy__eye">
                <ellipse cx="29.4" cy="24" rx="3.1" ry="4.2" fill="#fff" />
                <circle className="buddy__pupil" cx="29.7" cy="24.6" r="1.9" />
              </g>
              <rect className="buddy__lid buddy__lid--l" x="15" y="19.2" width="7.2" height="9.6" rx="3.6" />
              <rect className="buddy__lid buddy__lid--r" x="25.8" y="19.2" width="7.2" height="9.6" rx="3.6" />
            </g>
          )}
          <path className="buddy__mouth" d={mood === 'confused' ? 'M21.6 32c1.6-.9 3.2.9 4.8 0' : 'M22 31.2c1.2 1.1 2.8 1.1 4 0'} />
          <ellipse className="buddy__cheek" cx="13.8" cy="29.6" rx="2" ry="1.2" />
          <ellipse className="buddy__cheek" cx="34.2" cy="29.6" rx="2" ry="1.2" />
        </g>
        <g className="buddy__extras">
          <circle className="buddy__dot buddy__dot--1" cx="38" cy="10" r="1.6" />
          <circle className="buddy__dot buddy__dot--2" cx="42" cy="6" r="2" />
          <circle className="buddy__dot buddy__dot--3" cx="46" cy="2.4" r="2.4" />
          <path className="buddy__spark buddy__spark--1" d="M5 6l1 2.2L8.2 9 6 10 5 12.2 4 10 1.8 9 4 8.2z" />
          <path className="buddy__spark buddy__spark--2" d="M43 30l.8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8z" />
          <text className="buddy__z" x="38" y="12">z</text>
        </g>
      </svg>
    </span>
  );
}
