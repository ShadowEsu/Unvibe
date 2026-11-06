/**
 * Settings › General's Accessibility row, without the UI (PermRow in companion.tsx draws it). Pure, so its states are
 * tested (test/settingsRows.test.ts).
 */

export interface AccessibilityState {
  granted: boolean;
  /** process.platform as main reports it: only 'darwin' has a grant to ask for. */
  platform: string;
}

export interface AccessibilityRow {
  /** The status chip; null until main has answered, so a Mac never flashes "Not needed" while it checks. */
  label: 'Allowed' | 'Not allowed yet' | 'Not needed' | null;
  tone: 'ok' | 'no' | 'na' | null;
  /** The row offers "Allow Accessibility" (and, once asked, the steps and the fix). */
  canAllow: boolean;
}

export function accessibilityRow(state: AccessibilityState | null): AccessibilityRow {
  if (!state) return { label: null, tone: null, canAllow: false };
  if (state.platform !== 'darwin') return { label: 'Not needed', tone: 'na', canAllow: false };
  return state.granted ? { label: 'Allowed', tone: 'ok', canAllow: false } : { label: 'Not allowed yet', tone: 'no', canAllow: true };
}
