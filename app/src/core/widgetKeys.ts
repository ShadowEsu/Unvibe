/**
 * Widget keyboard shortcuts, extracted into a pure module so the cross-platform
 * rules are testable without a DOM. The widget window has no native menu, so the
 * renderer owns its own close/collapse/level shortcuts.
 *
 * "Command" follows Electron's CommandOrControl semantics: meta on macOS, ctrl
 * elsewhere. Shortcuts that could collide with typing (Escape, level picks) are
 * suppressed while the focus is inside a form field.
 */

export interface WidgetKeyInput {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  /** True when the event target is an input, textarea, select, or contenteditable. */
  inFormField: boolean;
}

export type WidgetKeyAction =
  | { kind: 'close' }
  | { kind: 'toggle-collapse' }
  | { kind: 'pick-level'; levelIndex: number }
  | { kind: 'none' };

export function widgetKeyAction(input: WidgetKeyInput): WidgetKeyAction {
  const { key, metaKey, ctrlKey, inFormField } = input;
  const command = metaKey || ctrlKey;

  // Closing the panel is standard window behavior and stays active while typing.
  if (command && key === 'w') return { kind: 'close' };
  // Level picks must not fire mid-typing (e.g. in the follow-up box).
  if (command && key >= '1' && key <= '5' && !inFormField) {
    return { kind: 'pick-level', levelIndex: Number(key) - 1 };
  }
  // Escape collapses the panel — unless the user is typing in a form field.
  if (key === 'Escape' && !inFormField) return { kind: 'toggle-collapse' };
  return { kind: 'none' };
}
