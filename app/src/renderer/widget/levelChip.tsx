import { useRef, type KeyboardEvent } from 'react';
import type { ExplanationLevel } from '../../core/protocol';
import { isProPlan } from '../../core/plan';
import { Icon } from './icons';
import { SegThumb } from '../shared/slidingThumb';

export const LEVELS: Array<{ id: ExplanationLevel; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
];

/** Expert is part of Pro, Teams and Full; every other plan sees it locked. */
export function expertLocked(plan?: string): boolean {
  return plan === undefined || !isProPlan(plan);
}

/**
 * Overlay B's one depth control (SPEC Depth): a 26 pt segmented row of all five, the current one an accent pill.
 * Expert always carries its "Pro" marker (Security N3); locked, it adds a lock and picks nothing. A radio group whose
 * arrows only move focus between depths that can be picked; Enter or Space (the button's click) picks. Picking starts
 * a new explanation, so stepping across depths must not start one per step (review SHOULD).
 */
export function DepthControl({ level, plan, disabled, onPick }: {
  level: ExplanationLevel;
  plan?: string;
  disabled: boolean;
  onPick: (id: ExplanationLevel) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const open = LEVELS.filter((l) => !(l.id === 'expert' && expertLocked(plan)));
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step || disabled) return;
    event.preventDefault();
    const focused = (event.target as HTMLElement).closest<HTMLElement>('[data-level]')?.dataset.level ?? level;
    const at = Math.max(0, open.findIndex((l) => l.id === focused));
    const next = open[(at + step + open.length) % open.length]!;
    refs.current[LEVELS.findIndex((l) => l.id === next.id)]?.focus();
  };
  return (
    <div className="ob-depth" role="radiogroup" aria-label="Explanation depth" onKeyDown={onKey}><SegThumb />
      {LEVELS.map((l, i) => {
        const locked = l.id === 'expert' && expertLocked(plan);
        const on = l.id === level;
        return (
          <button
            key={l.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-level={l.id}
            className={`ob-depth__item${on ? ' is-on' : ''}`}
            disabled={disabled || locked}
            title={locked ? 'Expert explanations are included with Unvibe Pro' : `Explain at ${l.label} depth`}
            onClick={() => { if (!on) onPick(l.id); }}
          >
            {l.label}
            {l.id === 'expert' ? (
              <span className="ob-pro">{locked ? <Icon name="lock" size={9} /> : null}Pro</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
