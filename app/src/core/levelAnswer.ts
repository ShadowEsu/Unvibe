import type { ExplanationLevel } from './protocol';

/** The answer to the one level question after the first-run sample (first-run spec, change 3). */
export type LevelAnswer = 'too_basic' | 'about_right' | 'too_advanced';

/** Expert is Pro, so the first-run question never steps into it. */
const FREE_LEVELS: readonly ExplanationLevel[] = ['new', 'beginner', 'intermediate', 'advanced'];

export function isLevelAnswer(value: unknown): value is LevelAnswer {
  return value === 'too_basic' || value === 'about_right' || value === 'too_advanced';
}

/** too basic: one level up; about right: keep; too advanced: one level down. Never into Expert. */
export function levelAfterAnswer(current: ExplanationLevel, answer: LevelAnswer): ExplanationLevel {
  if (answer === 'about_right') return current;
  if (current === 'expert') return answer === 'too_advanced' ? 'advanced' : 'expert';
  const index = FREE_LEVELS.indexOf(current);
  const next = answer === 'too_basic' ? index + 1 : index - 1;
  return FREE_LEVELS[Math.max(0, Math.min(FREE_LEVELS.length - 1, next))] ?? current;
}
