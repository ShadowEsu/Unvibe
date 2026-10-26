/**
 * The explain-after-grant return (first-run spec, change 2). A shortcut press while macOS had not
 * allowed Accessibility remembers the app it came from; once the grant arrives, Unvibe goes back
 * there and explains the selection. Only a recent press counts: a grant arriving much later would
 * otherwise copy whatever is selected in that app by then and send it with no further click.
 */

/** How long a press stays eligible for the automatic return. */
export const GRANT_RETURN_WINDOW_MS = 5 * 60_000;

export interface PendingGrant {
  app: string;
  /** When the shortcut was pressed, in ms since the epoch. */
  at: number;
}

/** The app to go back to when the grant shows up at `now`, or null when there is none or the press is too old. */
export function grantReturnApp(pending: PendingGrant | null, now: number): string | null {
  if (!pending) return null;
  const age = now - pending.at;
  return age >= 0 && age <= GRANT_RETURN_WINDOW_MS ? pending.app : null;
}
