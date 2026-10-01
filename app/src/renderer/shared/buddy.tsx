import { useEffect, useRef, useState } from 'react';

/**
 * Vibe, the face of Unvibe's AI. A small violet squircle with an antenna and expressive eyes.
 *
 * Moods map to what the AI is doing:
 * - idle: blinks and glances around (follows the pointer when `follow` is set)
 * - thinking: eyes look up, antenna pulses, thought dots rise (waiting for the first token)
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
          <linearGradient id="buddy-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b79bff" />
            <stop offset="0.55" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#5b34c9" />
          </linearGradient>
          <radialGradient id="buddy-shine" cx="0.3" cy="0.25" r="0.6">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="buddy__float">
          <g className="buddy__antenna">
            <path d="M24 9.5V5.5" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
            <circle className="buddy__bulb" cx="24" cy="4.2" r="2.4" />
          </g>
          <rect className="buddy__body" x="6" y="9" width="36" height="32" rx="12" fill="url(#buddy-body)" />
          <rect x="6" y="9" width="36" height="32" rx="12" fill="url(#buddy-shine)" />
          <rect className="buddy__face" x="11" y="15" width="26" height="18" rx="8" />
          {happy ? (
            <g className="buddy__eyes buddy__eyes--happy">
              <path d="M15.5 25.5c1.2-2.4 4.6-2.4 5.8 0" />
              <path d="M26.7 25.5c1.2-2.4 4.6-2.4 5.8 0" />
            </g>
          ) : (
            <g className="buddy__eyes">
              <g className="buddy__eye">
                <ellipse cx="18.4" cy="24" rx="3.4" ry="4" fill="#fff" />
                <circle className="buddy__pupil" cx="18.4" cy="24.4" r="1.9" />
              </g>
              <g className="buddy__eye">
                <ellipse cx="29.6" cy="24" rx="3.4" ry="4" fill="#fff" />
                <circle className="buddy__pupil" cx="29.6" cy="24.4" r="1.9" />
              </g>
              <rect className="buddy__lid buddy__lid--l" x="14.6" y="19.4" width="7.6" height="9.2" rx="3.8" />
              <rect className="buddy__lid buddy__lid--r" x="25.8" y="19.4" width="7.6" height="9.2" rx="3.8" />
            </g>
          )}
          <path className="buddy__mouth" d={mood === 'confused' ? 'M21.5 30.6c1.6-.9 3.4.9 5 0' : 'M21.6 29.8c1.4 1.3 3.4 1.3 4.8 0'} />
          <ellipse className="buddy__cheek" cx="13.6" cy="29" rx="1.8" ry="1.1" />
          <ellipse className="buddy__cheek" cx="34.4" cy="29" rx="1.8" ry="1.1" />
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
