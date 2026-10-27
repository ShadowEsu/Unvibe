import { useEffect, useRef, useState } from 'react';
import { isWindows } from './platform';

/** First lines of what was pasted, shown in the target while the panel explains it. */
const PREVIEW_LINES = 6;

/**
 * One focused paste target: the user copies code anywhere and pastes it here, with no permission
 * needed. `onPaste` gets the pasted text (never empty); the target then shows its first lines with
 * "Explaining in the panel", and another paste replaces it. An empty paste shows the clipboard-empty
 * message instead. `onChooseFile` adds "or Choose a file…" under the target.
 */
export function PasteTarget({ hint, onPaste, onChooseFile, autoFocus = true }: {
  hint: string;
  onPaste: (text: string) => void;
  onChooseFile?: () => void;
  autoFocus?: boolean;
}) {
  const target = useRef<HTMLDivElement>(null);
  const handler = useRef(onPaste);
  handler.current = onPaste;
  const [preview, setPreview] = useState('');
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    if (autoFocus) target.current?.focus();
  }, [autoFocus]);
  // The target isn't editable, so the browser sends ⌘V / Ctrl+V to the document. Take it while the
  // target has focus, or when the paste lands inside it.
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const box = target.current;
      if (!box || (document.activeElement !== box && !box.contains(event.target as Node))) return;
      event.preventDefault();
      const text = event.clipboardData?.getData('text') ?? '';
      if (!text.trim()) {
        setEmpty(true);
        return;
      }
      setEmpty(false);
      setPreview(text.replace(/^\s*\n/, '').split(/\r?\n/).slice(0, PREVIEW_LINES).join('\n'));
      handler.current(text);
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, []);
  return (
    <div className="paste-target">
      <div ref={target} className={`paste-target__box${preview ? ' has-code' : ''}`} role="textbox" tabIndex={0}
        aria-label="Paste code here" aria-describedby={preview ? undefined : 'paste-target-hint'}>
        {preview ? (
          <>
            <pre>{preview}</pre>
            <span className="paste-target__pill" role="status"><i aria-hidden="true" />Explaining in the panel</span>
          </>
        ) : (
          <>
            <span className="paste-target__keys" aria-hidden="true">
              {(isWindows ? ['Ctrl', 'V'] : ['⌘', 'V']).map((key) => <span key={key} className="paste-target__key">{key}</span>)}
            </span>
            <b>Paste code here</b>
            <span id="paste-target-hint" className="paste-target__hint">{hint}</span>
          </>
        )}
      </div>
      {empty ? <p className="paste-target__error" role="alert">Your clipboard is empty. Copy some code first, then try again.</p> : null}
      {preview ? <p className="paste-target__or">Wrong code? Paste again.</p>
        : onChooseFile ? <p className="paste-target__or">or <button type="button" className="paste-target__link" onClick={onChooseFile}>Choose a file…</button></p>
          : null}
    </div>
  );
}
