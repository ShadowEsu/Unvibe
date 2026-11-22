import { autoClipboardReadable } from './clipboardHold';

/**
 * Auto mode's read (ledger 646). Unlike a press it runs while the person may be about to paste or type, so (QA C-3 row
 * 1 on #384, and Security's MUST-A1-A3 / SHOULD-384a):
 * - the clipboard is never emptied: one native call checks the source app and that the person is idle, sends the copy
 *   keystroke, and watches the clipboard's change count (Mac `changeCount`, Windows `GetClipboardSequenceNumber`), so a
 *   paste before the copy lands still gets the person's own clipboard;
 * - the keystroke goes only when no input arrived since the mouse-up's settle began (and none in the last 500 ms) and
 *   no modifier key is held; the native call reads the time of the last input and whether a modifier key is held right
 *   then, never what was typed;
 * - the person's clipboard goes back the moment the copy's text is read (clipboardHolder: only over the copy's own
 *   result);
 * - any input after the copy keystroke (the mark is sampled just after it, since the keystroke itself counts as input)
 *   and before that restore drops the result: no explanation, no request;
 * - nothing happens when the clipboard holds something that can't be put back (an image, files).
 */

export type AutoSkip = 'clipboard' | 'app' | 'busy';

export interface AutoReadResult {
  code: string | null;
  sourceApp?: string | null;
  skipped?: AutoSkip;
  error?: 'empty' | 'failed';
}

/**
 * The native call's one line: `skip app|busy [app name]`, or `copied|none <mark> [app name]`. `mark` is what the input
 * check after the restore compares against; the app name (Windows) may contain spaces.
 */
export type AutoNativeLine =
  | { kind: 'skip'; reason: 'app' | 'busy'; sourceApp: string | null }
  | { kind: 'copied' | 'none'; mark: string; sourceApp: string | null };

export function parseAutoLine(line: string): AutoNativeLine | null {
  const [kind, second, ...rest] = line.trim().split(/\s+/);
  if (kind === 'skip' && (second === 'app' || second === 'busy')) return { kind, reason: second, sourceApp: rest.join(' ') || null };
  if ((kind === 'copied' || kind === 'none') && second) return { kind, mark: second, sourceApp: rest.join(' ') || null };
  return null;
}

export interface AutoReadDeps {
  /** The clipboard's formats now (before anything runs). */
  formats(): readonly string[];
  readText(): string;
  /** The shared clipboard hold (saves first, restores only over the copy's own result). */
  hold<T>(run: () => Promise<T>, copiedText: (result: T) => string | null | undefined): Promise<T>;
  /** The native call: app check, idle check, keystroke, change-count watch; resolves with its first line. */
  native(app: string, settleStartedAt: number): Promise<string>;
  /** After the restore: did any input arrive since `mark`? */
  inputSince(mark: string): Promise<boolean>;
  wait(ms: number): Promise<unknown>;
}

/** Some editors clear the clipboard a beat before they write the text, so a changed but still empty clipboard is read again briefly. */
const TEXT_SETTLE_MS = 150;
const TEXT_POLL_MS = 5;

async function landedText(deps: AutoReadDeps): Promise<string> {
  for (let waited = 0; ; waited += TEXT_POLL_MS) {
    const text = deps.readText();
    if (text.trim().length > 0 || waited >= TEXT_SETTLE_MS) return text;
    await deps.wait(TEXT_POLL_MS);
  }
}

export async function autoRead(deps: AutoReadDeps, app: string, settleStartedAt: number): Promise<AutoReadResult> {
  if (!autoClipboardReadable(deps.formats())) return { code: null, skipped: 'clipboard' };
  const read = await deps.hold(async (): Promise<AutoReadResult & { mark?: string }> => {
    const line = parseAutoLine(await deps.native(app, settleStartedAt));
    if (!line) return { code: null, error: 'failed' };
    if (line.kind === 'skip') return { code: null, sourceApp: line.sourceApp, skipped: line.reason };
    // No change: the editor copied nothing, and the clipboard was never touched.
    if (line.kind === 'none') return { code: null, sourceApp: line.sourceApp, error: 'empty' };
    const text = await landedText(deps);
    return text.trim() ? { code: text, sourceApp: line.sourceApp, mark: line.mark } : { code: null, sourceApp: line.sourceApp, error: 'empty' };
  }, (result) => result.code);
  const { mark, ...result } = read;
  if (!result.code || !mark) return result;
  // The clipboard is back. If the person pressed anything since the mark (just after the copy keystroke), their paste or
  // key may have met the copy: drop it. A check that fails can't say, so it drops too.
  const acted = await deps.inputSince(mark).catch(() => true);
  return acted ? { code: null, sourceApp: result.sourceApp, skipped: 'busy' } : result;
}
