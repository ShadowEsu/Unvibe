/**
 * Pure decision logic for the widget's window-level keydown shortcuts.
 * Encodes Electron-style CommandOrControl semantics (meta OR ctrl) and a
 * form-field guard so panel shortcuts never hijack typing in inputs.
 */
export interface WidgetKeyInput {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  /** True when the event target is an input, textarea, select, or contenteditable. */
  inFormField: boolean;
}

export type WidgetKeyAction =
  | { type: 'close-widget' }
  | { type: 'collapse' }
  | { type: 'pick-level'; level: number }
  | { type: 'none' };

export function widgetKeyAction(input: WidgetKeyInput): WidgetKeyAction {
  const command = Boolean(input.metaKey || input.ctrlKey);
  // Closing the panel is standard window behavior and stays active while typing.
  if (command && input.key.toLowerCase() === 'w') return { type: 'close-widget' };
  if (input.inFormField) return { type: 'none' };
  if (input.key === 'Escape') return { type: 'collapse' };
  if (command && input.key >= '1' && input.key <= '5') {
    return { type: 'pick-level', level: Number(input.key) };
  }
  return { type: 'none' };
}
