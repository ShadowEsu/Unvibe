/** The bits of a clipboard a synthetic copy needs: its text, with any HTML and RTF beside it. */
export interface HeldClipboard {
  readText(): string;
  readHTML(): string;
  readRTF(): string;
  write(data: { text: string; html?: string; rtf?: string }): void;
}

/**
 * A synthetic copy saves the person's clipboard, empties it and puts it back when it's done. Two copies at once (a
 * button press while the shortcut's copy still waits for an editor) would have the second save the first's empty
 * clipboard and put that back last, losing the person's clipboard for good (Security SHOULD-366d). So copies run one
 * at a time: each one saves and restores around its own run, after the one before it has put the clipboard back.
 *
 * What's saved is the text with its HTML and RTF (a formatted copy keeps its formatting). Anything else on the clipboard
 * (an image, files) can't be put back, so auto mode doesn't read then (`autoClipboardReadable`). The clipboard goes back
 * only over what the copy itself left there (the emptied clipboard, or the text it copied): a copy the person made
 * while it ran stays (Security MUST-A3 on #384).
 */
export function clipboardHolder(clip: HeldClipboard): <T>(run: () => Promise<T>, copiedText: (result: T) => string | null | undefined) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(run: () => Promise<T>, copiedText: (result: T) => string | null | undefined): Promise<T> => {
    const turn = queue.then(async () => {
      const text = clip.readText();
      const html = clip.readHTML();
      const rtf = clip.readRTF();
      let copied: string | null | undefined;
      try {
        const result = await run();
        copied = copiedText(result);
        return result;
      } finally {
        const now = clip.readText();
        if (now === '' || (copied && now === copied)) clip.write({ text, ...(html ? { html } : {}), ...(rtf ? { rtf } : {}) });
      }
    });
    queue = turn.catch(() => undefined);
    return turn;
  };
}

/**
 * Formats auto mode may read over (Security MUST-A1 on #384): plain text, the HTML and RTF beside it (all three are put
 * back), and editors' own copy notes (VS Code's, which only steer a paste in the editor). Anything else, an image or
 * files above all, can't be put back, so auto mode leaves the clipboard alone and the button stays for a press.
 */
const AUTO_READABLE = /^(text\/plain|text\/html|text\/rtf|vscode-editor-data|application\/vnd\.code\.[\w.-]+)$/;

export function autoClipboardReadable(formats: readonly string[]): boolean {
  return formats.every((format) => AUTO_READABLE.test(format));
}
