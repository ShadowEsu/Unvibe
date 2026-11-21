/** The bits of a clipboard a synthetic copy needs. */
export interface TextClipboard {
  readText(): string;
  writeText(text: string): void;
}

/**
 * A synthetic copy saves the person's clipboard, empties it and puts it back when it's done. Two copies at once (a
 * button press while the shortcut's copy still waits for an editor) would have the second save the first's empty
 * clipboard and put that back last, losing the person's clipboard for good (Security SHOULD-366d). So copies run one
 * at a time: each one saves and restores around its own run, after the one before it has put the clipboard back.
 */
export function clipboardHolder(clip: TextClipboard): <T>(run: () => Promise<T>) => Promise<T> {
  let queue: Promise<unknown> = Promise.resolve();
  return <T>(run: () => Promise<T>): Promise<T> => {
    const turn = queue.then(async () => {
      const previous = clip.readText();
      try {
        return await run();
      } finally {
        clip.writeText(previous);
      }
    });
    queue = turn.catch(() => undefined);
    return turn;
  };
}
