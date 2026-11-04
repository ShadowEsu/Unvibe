/**
 * BRANCH-ONLY (app/glass, ledger 436): Liquid Glass through Glisse, at the two levels Design
 * shoots before anything ships. Not for a release build.
 *
 * Main reads UNVIBE_GLASS (subtle or full, default full) and sends it with app:info; loadGlassLevel()
 * puts it on <html data-glass>.
 * - subtle (L1): every Glisse control where the app has that control, plus glass on the floating
 *   chrome (top bar, ask dock, sheets, menus, toasts, the panel header and rail).
 * - full (L2): adds the panel shell, content cards, list containers and Glisse inputs.
 * Reading text, code, consent and legal copy stay on solid plates at both levels.
 *
 * Which surfaces are glass is the `from` prop on each GlassLayer, and the host rules in glass.css,
 * so moving a surface between levels is a one-word change.
 */
import { forwardRef, useSyncExternalStore, type InputHTMLAttributes } from 'react';
import { Glass, Input } from 'glisse';

export type GlassLevel = 'subtle' | 'full';

let current: GlassLevel | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setGlassLevel(level: GlassLevel): void {
  current = level;
  document.documentElement.dataset.glass = level;
  for (const listener of listeners) listener();
}

/** Asks main for the level once per window; app:info carries it like the other env-derived values. */
export function loadGlassLevel(): void {
  void window.unvibe.appInfo().then((info) => setGlassLevel(info.glass === 'subtle' ? 'subtle' : 'full'));
}

/** The level once main has answered; null before that and in server renders (tests). */
export function useGlassLevel(): GlassLevel | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** True once the window's level includes surfaces marked `from` (full includes subtle). */
export function useGlassFrom(from: GlassLevel): boolean {
  const level = useGlassLevel();
  return level !== null && (from === 'subtle' || level === 'full');
}

/**
 * A Glisse Glass pane drawn behind its parent's content, so the parent keeps its own element,
 * landmark role and handlers. glass.css makes the parent the stacking context and clears its fill.
 * `kind` sets the fill and blur: bar (chrome with text), sheet (dialogs, menus), card, shell.
 */
export function GlassLayer({ from = 'subtle', kind }: { from?: GlassLevel; kind: 'bar' | 'sheet' | 'card' | 'shell' }) {
  if (!useGlassFrom(from)) return null;
  return <Glass aria-hidden="true" className={`glass-layer glass-layer--${kind}`} />;
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'> & {
  value: string;
  onValueChange: (value: string) => void;
};

/** A text field: Glisse Input at the full level (inputs are L2 in Design's spec), the plain input below it. */
export const GlassField = forwardRef<HTMLInputElement, FieldProps>(function GlassField({ value, onValueChange, className, ...props }, ref) {
  if (useGlassFrom('full')) return <Input ref={ref} className={`glass-field${className ? ` ${className}` : ''}`} value={value} onValueChange={onValueChange} {...props} />;
  return <input ref={ref} className={className} value={value} onChange={(event) => onValueChange(event.target.value)} {...props} />;
});
