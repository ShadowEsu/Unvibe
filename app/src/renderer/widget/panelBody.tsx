import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

/** Lines the code block shows before "Show all" (SPEC §4). */
export const CODE_PEEK_LINES = 3;

export function codeLineCount(code: string): number {
  return code.replace(/\n+$/, '').split('\n').length;
}

/**
 * The selected code above the explanation: 3 lines and "Show all N lines", the language on the right.
 * The whole selection is always in the DOM (folded only by CSS), so copy, search and screen readers get all of it.
 */
export function CodeBlock({ id, code, language, open, onToggle }: {
  id: string;
  code: string;
  language?: string;
  open: boolean;
  onToggle: () => void;
}) {
  const lines = codeLineCount(code);
  const folds = lines > CODE_PEEK_LINES;
  return (
    <section className={`code-context${folds && !open ? ' code-context--folded' : ''}`} aria-label="Selected code context">
      <pre id={id} tabIndex={0}><code>{code}</code></pre>
      {folds || language ? (
        <div className="code-context__more">
          {folds ? (
            <button type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
              {open ? 'Show less' : `Show all ${lines} lines`}
            </button>
          ) : <span />}
          {language ? <span className="code-context__lang">{language}</span> : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The panel's actions (SPEC §4): while the answer streams, only "Stop generating"; then one primary "Got it" with
 * "Explain differently" and "Test me" as quiet text. After Got it the button stays pressed and a second press does
 * nothing new (Design Q1).
 */
export function PanelActions({ streaming, busy, understood, testMeRef, onStop, onGotIt, onDifferent, onTestMe, children }: {
  streaming: boolean;
  busy: boolean;
  understood: boolean;
  /** Test me takes focus back when Test me closes. */
  testMeRef?: Ref<HTMLButtonElement>;
  onStop: () => void;
  onGotIt: () => void;
  onDifferent: () => void;
  onTestMe: () => void;
  children?: ReactNode;
}) {
  if (streaming) {
    return (
      <div className="p-actions">
        <button type="button" className="btn-quiet" onClick={onStop}>Stop generating</button>
        {children}
      </div>
    );
  }
  return (
    <div className="p-actions">
      <PrimaryButton pressed={understood} disabled={busy} aria-disabled={understood || undefined} onClick={() => { if (!understood) onGotIt(); }}>
        Got it
      </PrimaryButton>
      <button type="button" className="btn-quiet" disabled={busy} onClick={onDifferent}>Explain differently</button>
      <button ref={testMeRef} type="button" className="btn-quiet" disabled={busy} onClick={onTestMe}>Test me</button>
      {children}
    </div>
  );
}

/**
 * The panel's one violet key (SPEC §6: 3 px, instant down, 180 ms up). The label sits on a face that moves while the
 * lip under it stays put (Motion, app-0151 moment 2), so a release reveals the lip as the face rises.
 */
export function PrimaryButton({ pressed, children, ...button }: ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }) {
  return (
    <button type="button" {...button} className={`btn-primary${pressed ? ' btn-primary--pressed' : ''}`}>
      <span className="btn-primary__face">{children}</span>
    </button>
  );
}

/** How long the Got it toast stays (Design Q1), with or without motion. */
export const TOAST_MS = 2400;
/** Its exit (panelToastOut); under reduced motion it simply goes after this. */
export const TOAST_EXIT_MS = 160;
/** Vibe's happy squash (buddy.css, 240 ms): the toast rises after it, so the order reads press → squash → toast (SPEC §6). */
export const SQUASH_MS = 240;

/**
 * A short info line over the footer: the lime understood tick, never amber (Design Q1). It goes inside a live
 * region that is always there, so screen readers announce it.
 */
export function PanelToast({ text, leaving }: { text: string; leaving?: boolean }) {
  return (
    <div className={`panel-toast${leaving ? ' panel-toast--leaving' : ''}`}>
      <span className="panel-toast__tick" aria-hidden="true">✓</span>
      <span>{text}</span>
    </div>
  );
}
