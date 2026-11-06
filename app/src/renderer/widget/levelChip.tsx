import type { ExplanationLevel } from '../../core/protocol';
import { isProPlan } from '../../core/plan';
import { MenuButton, type MenuItem } from './panelMenu';

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

/** The depth menu (Design Q12): all five, a lime tick on the current one; locked Expert shows a lock and "Pro" and opens nothing. */
export function levelItems(level: ExplanationLevel, plan: string | undefined, onPick: (id: ExplanationLevel) => void): MenuItem[] {
  return LEVELS.map((l) => {
    const locked = l.id === 'expert' && expertLocked(plan);
    return {
      id: l.id,
      label: l.label,
      checked: l.id === level,
      disabled: locked,
      locked,
      tag: locked ? 'Pro' : undefined,
      title: locked ? 'Expert explanations are included with Unvibe Pro' : `Explain at ${l.label} depth`,
      dataLevel: l.id,
      onSelect: () => onPick(l.id),
    };
  });
}

/** The panel's one depth control (SPEC §4): a chip "Beginner ▾" whose menu holds all five depths. */
export function LevelChip({ level, plan, disabled, onPick }: {
  level: ExplanationLevel;
  plan?: string;
  disabled: boolean;
  onPick: (id: ExplanationLevel) => void;
}) {
  const label = LEVELS.find((l) => l.id === level)?.label ?? level;
  return (
    <MenuButton className="depth-chip" items={levelItems(level, plan, onPick)} menuLabel="Explanation depth" ariaLabel={`Depth: ${label}`} align="start" disabled={disabled}>
      {label}
      <small aria-hidden="true">▾</small>
    </MenuButton>
  );
}
