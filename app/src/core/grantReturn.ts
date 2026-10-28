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
  return pending && recent(pending.at, now) ? pending.app : null;
}

/**
 * A clipboard explain (setup's paste or Explain my clipboard, or an editor link) asked for before
 * the person agreed to send their code. Nothing was read then; once they agree, the panel asks main
 * to run it. The same window applies, so a late agreement never sends a clipboard copied long after
 * the request.
 */
export interface HeldClipboardReview {
  /** An editor link asked: show the confirm sheet, and send nothing until Explain is pressed. */
  confirm: boolean;
  /** When it was asked for, in ms since the epoch. */
  at: number;
}

/** The held explain to run when the agreement lands at `now`, or null when there is none or it is too old. */
export function heldReviewToRun(held: HeldClipboardReview | null, now: number): HeldClipboardReview | null {
  return held && recent(held.at, now) ? held : null;
}

function recent(at: number, now: number): boolean {
  const age = now - at;
  return age >= 0 && age <= GRANT_RETURN_WINDOW_MS;
}
